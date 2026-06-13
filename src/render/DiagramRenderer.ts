import { Application, Assets, Sprite, Graphics, Text, Texture } from "pixi.js";
import { animMagOffset, animTintOffset } from "@explain/helpers/RealtimeChannels";
import type {
  AnimFrame,
  ChartFrame,
  ChannelsPayload,
  RendererAdapter,
} from "./types";

// PixiJS (v8) adapter for the sprite diagram. The VIEWER half of the diagram:
// compartments are sprites scaled by volume and tinted by oxygenation (to2);
// connectors are static paths recolored/faded by flow. Editor interactions are
// Phase E. Per-frame updates come from the RealtimeBus anim snapshot and never
// touch Vue reactivity.
//
// Geometry/colour math is ported from the old Quasar app's ui_elements/
// Compartment.js + Connector.js (Pixi v7 → v8: async Application.init,
// Assets.load, Graphics build-then-stroke, Container.tint for recolour).

const DEG = Math.PI / 180;

interface CompNode {
  x: number;
  y: number;
  posType: string;
  dgs: number;
  sprite: Sprite;
  label: Text | null; // caption, follows the sprite
  layout: any;
}

interface ConnNode {
  name: string;
  graphics: Graphics;
  layout: any;
  from: string;
  to: string;
  arrow: Sprite; // moving flow indicator
  pos: number; // normalized position along the path [0,1)
  geom: any; // {type:'straight',x1,y1,x2,y2} | {type:'arc',cx,cy,r,from,to}
}

// flow-arrow tuning (fraction of path advanced per unit flow per frame).
// Calibrated for Resistor.flow in L/s (~0.003-0.05 L/s): at ~0.01 L/s and
// ~60 fps the arrow traverses a connector in ~1 s, faster on high-flow vessels.
const ARROW_SPEED_STRAIGHT = 2.0;
const ARROW_SPEED_ARC = 2.0;
// Fixed opacity for the flow indicator. Visibility does not track flow
// magnitude — direction/speed of travel already conveys flow; tying opacity to
// it just made the arrows flicker. The path's own alpha still fades with flow.
const ARROW_ALPHA = 0.9;
// Sprite scale for the flow indicator. The arrow must be wider than the path it
// rides (path width is ~5-7 px) so it reads as a distinct marker, not a bump in
// the line. arrow.png is ~318 px, so 0.06 ≈ 19 px.
const ARROW_SCALE = 0.045;
// arrow.png points "up" (-y) at rotation 0, so a sprite aligned to a path
// heading needs this offset added to the path's direction angle.
const ARROW_ROT_OFFSET = Math.PI / 2;
// Connector paths are a fixed neutral dark grey backbone — they do not recolour
// or fade with flow. Flow is conveyed by the moving arrow (which takes the
// upstream component's colour).
const CONNECTOR_COLOR = 0x444444;
// Filled disc drawn behind everything at the layout circle, so the inside of
// the component ring reads lighter than the (transparent) page background.
const DISC_COLOR = 0x262626;
// Editor alignment grid (toggleable). Subtle lines; snapping uses gridSize.
const GRID_COLOR = 0x3a3a3a;
const GRID_ALPHA = 0.6;
const GRID_SIZE_DEFAULT = 20;
// Margin (px at scaling 1) reserved between the layout ring and the panel edge
// for the component sprites/labels that sit ON the ring (anchor 0.5, so they
// extend ~half their size outward). The ring fills the panel minus this.
const RING_MARGIN = 60;

export class DiagramRenderer implements RendererAdapter {
  private el: HTMLElement;
  private diagram: any;
  private app: Application | null = null;
  private ready = false;

  private comps: Record<string, CompNode> = {};
  private conns: ConnNode[] = [];
  private animIndex: Record<string, number> = {};
  private bgDisc: Graphics | null = null; // lighter backdrop under the ring
  private gridG: Graphics | null = null; // editor alignment grid overlay
  private gridOn = false;
  private gridSize = GRID_SIZE_DEFAULT;

  // stage geometry (computed once at build)
  private xCenter = 0;
  private yCenter = 0;
  private ringR = 0; // layout-circle radius (px), fits the smaller dimension
  private xOffset = 0;
  private yOffset = 0;
  private scaling = 1;
  private speed = 1;
  private maxTo2 = 7.1;
  private ro: ResizeObserver | null = null;

  // editor state (Phase E)
  private editMode = false;
  private selected: string | null = null;
  private selectedKind: "comp" | "conn" | null = null;
  private selectionG: Graphics | null = null;
  private dragging: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private dragStartX = 0; // pointer pos at press, to tell a click from a drag
  private dragStartY = 0;
  private dragMoved = false;
  private wasSelected = false; // was the pressed component already selected?
  private onSelectCb:
    | ((name: string | null, comp: any, kind: "comp" | "conn" | null) => void)
    | null = null;
  // fired after a structural edit that changes the animation binding
  // (add/connect/delete/models) so the host can push the diagram to the worker.
  private onChangeCb: (() => void) | null = null;
  private connectMode = false;
  private connectFrom: string | null = null;

  constructor(el: HTMLElement, diagramDefinition: any) {
    this.el = el;
    this.diagram = diagramDefinition;
  }

  /** Async setup: create the Pixi app, preload sprites, build the scene. */
  async init() {
    const settings = this.diagram?.settings ?? {};
    this.app = new Application();
    await this.app.init({
      resizeTo: this.el,
      antialias: true,
      autoDensity: true,
      resolution: globalThis.devicePixelRatio || 1,
      // transparent canvas so the page background shows through and the diagram
      // matches the surrounding UI (incl. theme changes)
      backgroundAlpha: 0,
    });
    this.el.appendChild(this.app.canvas);
    this.app.stage.sortableChildren = true;

    // stage-level pointer handling for editor drag
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on("pointermove", (e: any) => this.onDragMove(e));
    this.app.stage.on("pointerup", () => this.onDragEnd());
    this.app.stage.on("pointerupoutside", () => this.onDragEnd());

    this.xOffset = numberOr(settings.xOffset, 0);
    this.yOffset = numberOr(settings.yOffset, 0);
    this.scaling = numberOr(settings.scaling, 1);
    this.speed = numberOr(settings.speed, 1);
    this.maxTo2 = numberOr(settings.max_to2, 7.1);
    this.gridOn = settings.grid === true;
    this.gridSize = settings.gridSize > 0 ? settings.gridSize : GRID_SIZE_DEFAULT;
    this.recomputeGeometry();

    await this.preloadTextures();
    this.drawBackdrop();
    this.drawGrid();
    this.buildCompartments();
    this.buildConnectors();
    this.ready = true;

    // recompute layout when the canvas resizes
    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(this.el);
  }

  private async preloadTextures() {
    const pictos = new Set<string>(["gfx/arrow.png"]); // flow indicator
    for (const comp of Object.values<any>(this.diagram?.components ?? {})) {
      let p = comp.picto || "container.png";
      if (!p.includes("gfx/")) p = "gfx/" + p;
      pictos.add(p);
    }
    await Assets.load([...pictos]);
  }

  /** Recompute stage centre and the layout-circle radius. The ring fills the
   *  panel exactly: based on the SMALLER half-dimension (so the circle fits even
   *  when the panel is much wider than it is tall) minus a margin that reserves
   *  room for the sprites/labels sitting on the ring. The scenario `radius`
   *  setting is intentionally NOT applied here — it would shrink the diagram. */
  private recomputeGeometry() {
    if (!this.app) return;
    this.xCenter = (this.app.screen.width || this.el.clientWidth) / 2;
    this.yCenter = (this.app.screen.height || this.el.clientHeight) / 2;
    const fill = Math.min(this.xCenter, this.yCenter) - RING_MARGIN * this.scaling;
    this.ringR = Math.max(20, fill);
  }

  /** Lighter filled disc under the component ring. Sits behind everything; its
   *  centre/radius track the layout circle, so it is redrawn on resize. */
  private drawBackdrop() {
    if (!this.app) return;
    if (!this.bgDisc) {
      this.bgDisc = new Graphics();
      this.bgDisc.zIndex = -1000; // behind paths, sprites and labels
      this.bgDisc.eventMode = "none";
      this.app.stage.addChild(this.bgDisc);
    }
    const cx = this.xCenter + this.xOffset;
    const cy = this.yCenter + this.yOffset;
    const r = this.ringR;
    this.bgDisc.clear();
    this.bgDisc.circle(cx, cy, r).fill({ color: DISC_COLOR, alpha: 1 });
  }

  /** Editor alignment grid. Drawn over the backdrop but under paths/sprites;
   *  cleared when off. Covers the whole canvas, so redrawn on resize. */
  private drawGrid() {
    if (!this.app) return;
    if (!this.gridG) {
      this.gridG = new Graphics();
      this.gridG.zIndex = -900; // above the disc, below paths
      this.gridG.eventMode = "none";
      this.app.stage.addChild(this.gridG);
    }
    const g = this.gridG;
    g.clear();
    if (!this.gridOn || this.gridSize <= 0) return;
    const w = this.app.screen.width || this.el.clientWidth;
    const h = this.app.screen.height || this.el.clientHeight;
    for (let x = 0; x <= w; x += this.gridSize) g.moveTo(x, 0).lineTo(x, h);
    for (let y = 0; y <= h; y += this.gridSize) g.moveTo(0, y).lineTo(w, y);
    g.stroke({ width: 1, color: GRID_COLOR, alpha: GRID_ALPHA });
  }

  /** Snap a coordinate to the grid when the grid is on (used while dragging). */
  private snap(v: number): number {
    if (!this.gridOn || this.gridSize <= 0) return v;
    return Math.round(v / this.gridSize) * this.gridSize;
  }

  /** Show/hide the alignment grid (also enables snap-to-grid while dragging). */
  setGrid(on: boolean) {
    this.gridOn = on;
    if (this.diagram?.settings) this.diagram.settings.grid = on;
    this.drawGrid();
  }

  /** Change the grid spacing (px) and snap granularity. */
  setGridSize(size: number) {
    if (!(size > 0)) return;
    this.gridSize = size;
    if (this.diagram?.settings) this.diagram.settings.gridSize = size;
    this.drawGrid();
  }

  private buildCompartments() {
    for (const [name, comp] of Object.entries<any>(this.diagram?.components ?? {})) {
      if (comp.type === "Connector") continue;
      if (comp.enabled === false) continue; // disabled components are not drawn
      this.makeCompartment(name, comp);
    }
  }

  private makeCompartment(name: string, comp: any) {
    const layout = comp.layout;
    let picto = comp.picto || "container.png";
    if (!picto.includes("gfx/")) picto = "gfx/" + picto;

    const sprite = Sprite.from(picto);
    sprite.anchor.set(layout.sprite.anchor.x, layout.sprite.anchor.y);
    sprite.alpha = layout.general.alpha;
    sprite.rotation = layout.sprite.rotation;
    sprite.zIndex = layout.general.z_index;
    sprite.tint = layout.general.tinting ? 0x151a7b : layout.sprite.color;

    const { x, y } = this.placeAt(layout);
    sprite.x = x;
    sprite.y = y;

    // initial visible scale before the first frame arrives
    const r0 = radiusFromVolume(0.15);
    sprite.scale.set(
      r0 * layout.sprite.scale.x * this.scaling,
      r0 * layout.sprite.scale.y * this.scaling,
    );

    sprite.eventMode = "static";
    sprite.cursor = "pointer";
    sprite.on("pointerdown", (e: any) => this.onSpriteDown(name, e));

    this.app!.stage.addChild(sprite);

    // caption: a Text that rides above the sprite. label.pos_x/pos_y are pixel
    // offsets from the sprite centre; size is the font size in px.
    let label: Text | null = null;
    if (comp.label) {
      label = this.buildLabelText(comp, layout);
      this.app!.stage.addChild(label);
    }

    this.comps[name] = {
      x,
      y,
      posType: layout.sprite.pos.type,
      dgs: layout.sprite.pos.dgs,
      sprite,
      label,
      layout,
    };
    this.positionLabel(this.comps[name]);
  }

  /** Place a compartment's caption at its sprite centre plus the configured
   *  pixel offset. Called whenever the sprite moves. */
  private positionLabel(node: CompNode) {
    const t = node.label;
    if (!t) return;
    const l = node.layout.label || {};
    t.x = node.sprite.x + numberOr(l.pos_x, 0) * this.scaling;
    t.y = node.sprite.y + numberOr(l.pos_y, 0) * this.scaling;
    t.rotation = numberOr(l.rotation, 0);
  }

  /** Build the caption Text for a component from its current label layout. */
  private buildLabelText(comp: any, layout: any): Text {
    const l = layout.label || {};
    const t = new Text({
      text: String(comp.label),
      style: {
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: (numberOr(l.size, 10) || 10) * this.scaling,
        fill: l.color || "#ffffff",
        align: "center",
      },
    });
    t.anchor.set(0.5, 0.5);
    t.eventMode = "none";
    t.zIndex = layout.general.z_index + 2; // above sprite and arrow
    return t;
  }

  /** Set a component's caption text live, creating/removing the Text as needed. */
  setLabel(name: string, text: string) {
    const comp = this.diagram?.components?.[name];
    const node = this.comps[name];
    if (!comp || !node) return;
    comp.label = text;
    if (!text) {
      if (node.label) {
        this.app?.stage.removeChild(node.label);
        node.label = null;
      }
      return;
    }
    if (node.label) {
      node.label.text = text;
    } else {
      node.label = this.buildLabelText(comp, node.layout);
      this.app?.stage.addChild(node.label);
    }
    this.positionLabel(node);
  }

  /** Set which engine model(s) a component/connector represents. Affects the
   *  exported definition and the next engine build (the live anim binding is
   *  fixed at build time), not the current frame stream. */
  setModels(name: string, models: string[]) {
    const comp = this.diagram?.components?.[name];
    if (!comp) return;
    comp.models = [...models];
    this.onChangeCb?.();
  }

  /** Toggle oxygenation tinting for a component/connector. Affects both the live
   *  sprite tint and the animation binding (tint source), so it re-binds. */
  setTinting(name: string, on: boolean) {
    this.applyLayoutPatch(name, { general: { tinting: on } });
    this.onChangeCb?.();
  }

  /** Swap a component's sprite image (picto) live. */
  async setPicto(name: string, picto: string) {
    const comp = this.diagram?.components?.[name];
    const node = this.comps[name];
    if (!comp || !node || !picto) return;
    const path = picto.includes("gfx/") ? picto : "gfx/" + picto;
    comp.picto = picto.replace("gfx/", "");
    await Assets.load(path);
    node.sprite.texture = Texture.from(path);
  }

  private placeAt(layout: any): { x: number; y: number } {
    const pos = layout.sprite.pos;
    if (pos.type === "arc") {
      return {
        x: this.xCenter + this.xOffset + Math.cos(pos.dgs * DEG) * this.ringR,
        y: this.yCenter + this.yOffset + Math.sin(pos.dgs * DEG) * this.ringR,
      };
    }
    // "rel"
    return {
      x: this.xCenter + this.xOffset + pos.x * this.ringR,
      y: this.yCenter + this.yOffset + pos.y * this.ringR,
    };
  }

  private buildConnectors() {
    for (const [name, comp] of Object.entries<any>(this.diagram?.components ?? {})) {
      if (comp.type !== "Connector") continue;
      if (comp.enabled === false) continue; // disabled connectors are not drawn
      this.makeConnector(name, comp);
    }
  }

  private makeConnector(name: string, comp: any) {
    const from = this.comps[comp.dbcFrom];
    const to = this.comps[comp.dbcTo];
    if (!from || !to) return; // can't route without both endpoints

    const g = new Graphics();
    g.zIndex = comp.layout.general.z_index;
    g.alpha = comp.layout.general.alpha;
    const geom = this.drawPath(g, comp.layout, from, to);
    // make the path selectable in the editor (hit area set in drawPath)
    g.eventMode = "static";
    g.cursor = "pointer";
    g.on("pointerdown", (e: any) => this.onConnDown(name, e));
    this.app!.stage.addChildAt(g, 0); // paths under sprites

    const arrow = Sprite.from("gfx/arrow.png");
    arrow.anchor.set(0.5, 0.5);
    arrow.scale.set(ARROW_SCALE * this.scaling);
    arrow.zIndex = comp.layout.general.z_index + 1;
    arrow.alpha = ARROW_ALPHA;
    arrow.eventMode = "none";
    this.app!.stage.addChild(arrow);

    this.conns.push({
      name,
      graphics: g,
      layout: comp.layout,
      from: comp.dbcFrom,
      to: comp.dbcTo,
      arrow,
      pos: 0,
      geom,
    });
  }

  private drawPath(g: Graphics, layout: any, from: CompNode, to: CompNode): any {
    g.clear();
    const width = numberOr(Number(layout.path.width), 5) * this.scaling;
    const pathType = layout.path.type;
    let geom: any;

    if (pathType === "straight") {
      g.moveTo(from.x, from.y).lineTo(to.x, to.y);
      geom = { type: "straight", x1: from.x, y1: from.y, x2: to.x, y2: to.y };
    } else if (from.posType === "arc" && to.posType === "arc") {
      // arc along the main layout circle between the two angular positions
      const c = from.dgs > to.dgs ? 360 : 0;
      const a0 = from.dgs * DEG;
      const a1 = (to.dgs + c) * DEG;
      const r = this.ringR;
      const cx = this.xCenter + this.xOffset;
      const cy = this.yCenter + this.yOffset;
      g.arc(cx, cy, r, a0, a1, pathType === "arc_r");
      geom = { type: "arc", cx, cy, r, from: a0, to: a1 };
    } else {
      // chord-arc: circle of radius r passing through both endpoint sprites
      const r = this.ringR;
      const { cx, cy } = circleCenterThrough(from.x, from.y, to.x, to.y, r);
      const a1 = angleOnCircle(cx, cy, from.x, from.y);
      const a2 = angleOnCircle(cx, cy, to.x, to.y);
      g.arc(cx, cy, r, a1, a2, false);
      geom = { type: "arc", cx, cy, r, from: a1, to: a2 };
    }
    // fixed neutral grey backbone; never recoloured per frame
    g.stroke({ width, color: CONNECTOR_COLOR, alpha: 1 });
    // hit area: a fat polyline along the path so the thin stroke is easy to
    // click in the editor (stroke-only Graphics aren't hit-tested by default).
    g.hitArea = new PolylineHitArea(samplePath(geom), Math.max(width, 12));
    return geom;
  }

  private onConnDown(name: string, e: any) {
    if (!this.editMode || this.connectMode) return;
    e.stopPropagation?.();
    // clicking the already-selected connector toggles the selection off
    if (this.selected === name && this.selectedKind === "conn") {
      this.clearSelection();
    } else {
      this.select(name, "conn");
    }
  }

  // ---- RendererAdapter ----

  onRegistry(payload: ChannelsPayload) {
    this.animIndex = {};
    const comps = payload?.anim?.components ?? [];
    for (const c of comps) this.animIndex[c.name] = c.index;
    if (payload?.anim?.layout?.max_to2) this.maxTo2 = payload.anim.layout.max_to2;
  }

  onFrame(_chart: ChartFrame | null, anim: AnimFrame | null) {
    if (!this.ready || !anim) return;
    const frame = anim.frame;

    // compartments: scale by volume, tint by to2
    for (const name in this.comps) {
      const idx = this.animIndex[name];
      if (idx === undefined) continue;
      const node = this.comps[name];
      const mag = frame[animMagOffset(idx)];
      const tint = frame[animTintOffset(idx)];
      const r = radiusFromVolume(mag > 0 ? mag : 0.15);
      node.sprite.scale.set(
        r * node.layout.sprite.scale.x * this.scaling,
        r * node.layout.sprite.scale.y * this.scaling,
      );
      if (node.layout.general.tinting) node.sprite.tint = colorFromTo2(tint, this.maxTo2);
    }

    // connectors: the path stays a fixed neutral grey; only the arrow moves and
    // takes its colour from the upstream component (tint source = dbcFrom's to2).
    for (const conn of this.conns) {
      const idx = this.animIndex[conn.name];
      if (idx === undefined) continue;
      const flow = frame[animMagOffset(idx)];
      const tint = frame[animTintOffset(idx)];
      this.advanceArrow(conn, flow, tint);
    }
  }

  // move a connector's flow indicator along its path, speed/direction by flow;
  // colour it from the upstream component (tint = dbcFrom's to2)
  private advanceArrow(conn: ConnNode, flow: number, tint: number) {
    const g = conn.geom;
    const a = conn.arrow;
    if (!g) return;

    if (g.type === "straight") {
      conn.pos = wrap01(conn.pos + flow * ARROW_SPEED_STRAIGHT * this.speed);
      a.x = g.x1 + (g.x2 - g.x1) * conn.pos;
      a.y = g.y1 + (g.y2 - g.y1) * conn.pos;
      let rot = Math.atan2(g.y2 - g.y1, g.x2 - g.x1) + ARROW_ROT_OFFSET;
      if (flow < 0) rot += Math.PI;
      a.rotation = rot;
    } else {
      const range = g.to - g.from || 1e-6;
      conn.pos = wrap01(conn.pos + (flow * ARROW_SPEED_ARC * this.speed) / Math.abs(range));
      const ang = g.from + range * conn.pos;
      a.x = g.cx + g.r * Math.cos(ang);
      a.y = g.cy + g.r * Math.sin(ang);
      // tangent to the circle at `ang` is ang + π/2; add the sprite offset too
      let rot = ang + Math.PI / 2 + ARROW_ROT_OFFSET;
      if (flow < 0) rot += Math.PI;
      a.rotation = rot;
    }
    // colour the arrow from the upstream component it flows out of, so it stands
    // out against the neutral-grey path; fall back to white if this connector
    // isn't tinted.
    a.tint = conn.layout.general.tinting ? colorFromTo2(tint, this.maxTo2) : 0xffffff;
  }

  // recompute positions/paths when the canvas resizes
  private onResize() {
    if (!this.app || !this.ready) return;
    this.recomputeGeometry();
    this.drawBackdrop();
    this.drawGrid();
    for (const name in this.comps) {
      const node = this.comps[name];
      const p = this.placeAt(node.layout);
      node.x = p.x;
      node.y = p.y;
      node.sprite.x = p.x;
      node.sprite.y = p.y;
      this.positionLabel(node);
    }
    for (const conn of this.conns) {
      const f = this.comps[conn.from];
      const t = this.comps[conn.to];
      if (f && t) conn.geom = this.drawPath(conn.graphics, conn.layout, f, t);
    }
    this.drawSelection();
  }

  // ---- Editor (Phase E) ----

  setEditMode(on: boolean) {
    this.editMode = on;
    if (!on) {
      this.dragging = null;
      this.clearSelection();
    }
  }

  setSelectCallback(fn: (name: string | null, comp: any, kind: "comp" | "conn" | null) => void) {
    this.onSelectCb = fn;
  }

  /** Notified after a structural edit (add/connect/delete/setModels) so the
   *  host can re-bind the live animation by pushing the diagram to the engine. */
  setChangeCallback(fn: () => void) {
    this.onChangeCb = fn;
  }

  /** Return the (mutated) diagram definition for serialization/export. */
  getDiagram() {
    return this.diagram;
  }

  /** Apply a layout patch to a component or connector and re-render it live. */
  applyLayoutPatch(name: string, patch: any) {
    const comp = this.diagram?.components?.[name];
    if (!comp) return;
    deepMerge(comp.layout, patch);
    // connectors have no sprite: update the path graphics + arrow instead
    const conn = this.conns.find((c) => c.name === name);
    if (conn) {
      const l = conn.layout;
      conn.graphics.alpha = l.general.alpha;
      conn.graphics.zIndex = l.general.z_index;
      conn.arrow.zIndex = l.general.z_index + 1;
      if (!l.general.tinting) conn.arrow.tint = 0xffffff;
      const f = this.comps[conn.from];
      const t = this.comps[conn.to];
      if (f && t) conn.geom = this.drawPath(conn.graphics, l, f, t);
      this.drawSelection();
      return;
    }
    const node = this.comps[name];
    if (node) {
      const l = node.layout;
      node.sprite.alpha = l.general.alpha;
      node.sprite.zIndex = l.general.z_index;
      node.sprite.rotation = l.sprite.rotation;
      if (!l.general.tinting) node.sprite.tint = l.sprite.color;
      const p = this.placeAt(l);
      node.sprite.x = p.x;
      node.sprite.y = p.y;
      node.x = p.x;
      node.y = p.y;
      node.posType = l.sprite.pos.type;
      node.dgs = l.sprite.pos.dgs;
      if (node.label) {
        node.label.text = String(comp.label ?? "");
        node.label.style.fontSize = (numberOr(l.label?.size, 10) || 10) * this.scaling;
        node.label.style.fill = l.label?.color || "#ffffff";
      }
      this.positionLabel(node);
      this.rerouteConnectors(name);
      this.drawSelection();
    }
  }

  private onSpriteDown(name: string, e: any) {
    if (!this.editMode) return;
    e.stopPropagation?.();
    if (this.connectMode) {
      // first click picks the source, second click creates the connection
      if (!this.connectFrom) {
        this.connectFrom = name;
        this.select(name);
      } else {
        if (name !== this.connectFrom) this.createConnection(this.connectFrom, name);
        this.connectFrom = null;
      }
      return;
    }
    const node = this.comps[name];
    // remember whether this component was already selected, so a plain click
    // (no drag) on it toggles the selection off in onDragEnd.
    this.wasSelected = this.selected === name && this.selectedKind === "comp";
    this.dragging = name;
    this.dragMoved = false;
    this.dragStartX = e.global.x;
    this.dragStartY = e.global.y;
    this.dragOffsetX = node.sprite.x - e.global.x;
    this.dragOffsetY = node.sprite.y - e.global.y;
    this.select(name);
  }

  private onDragMove(e: any) {
    if (!this.dragging) return;
    // ignore sub-pixel jitter so a click isn't mistaken for a drag
    if (Math.hypot(e.global.x - this.dragStartX, e.global.y - this.dragStartY) > 3) {
      this.dragMoved = true;
    }
    const node = this.comps[this.dragging];
    node.sprite.x = this.snap(e.global.x + this.dragOffsetX);
    node.sprite.y = this.snap(e.global.y + this.dragOffsetY);
    node.x = node.sprite.x;
    node.y = node.sprite.y;
    this.positionLabel(node);
    this.rerouteConnectors(this.dragging);
    this.drawSelection();
  }

  private onDragEnd() {
    if (!this.dragging) return;
    const name = this.dragging;
    // a plain click (no drag) on an already-selected component deselects it
    if (this.wasSelected && !this.dragMoved) {
      this.dragging = null;
      this.clearSelection();
      return;
    }
    const node = this.comps[name];
    const cx = this.xCenter + this.xOffset;
    const cy = this.yCenter + this.yOffset;
    const r = this.ringR;
    // snap to the layout circle if released near it, else commit as relative.
    // When the grid is on, grid-snapping wins — skip the circle snap so the
    // position stays on the grid.
    const dist = Math.abs(Math.hypot(node.sprite.x - cx, node.sprite.y - cy) - r);
    if (!this.gridOn && dist < 15) {
      const dgs = (Math.atan2(node.sprite.y - cy, node.sprite.x - cx) * 180) / Math.PI;
      node.layout.sprite.pos = { type: "arc", x: 0, y: 0, dgs };
      node.posType = "arc";
      node.dgs = dgs;
      const p = this.placeAt(node.layout);
      node.sprite.x = p.x;
      node.sprite.y = p.y;
      node.x = p.x;
      node.y = p.y;
    } else {
      node.layout.sprite.pos = { type: "rel", x: (node.sprite.x - cx) / r, y: (node.sprite.y - cy) / r, dgs: 0 };
      node.posType = "rel";
    }
    this.positionLabel(node);
    this.rerouteConnectors(name);
    this.drawSelection();
    this.dragging = null;
    this.onSelectCb?.(name, this.diagram.components[name], "comp");
  }

  private select(name: string, kind: "comp" | "conn" = "comp") {
    this.selected = name;
    this.selectedKind = kind;
    this.drawSelection();
    this.onSelectCb?.(name, this.diagram.components[name], kind);
  }

  /** Clear the current selection (used by Escape / leaving edit mode). */
  clearSelection() {
    this.selected = null;
    this.selectedKind = null;
    this.connectFrom = null;
    this.drawSelection();
    this.onSelectCb?.(null, null, null);
  }

  /** Delete the selected component (sprite + attached connectors) and its
   *  entry in diagram_definition. */
  deleteSelected() {
    if (this.selected) this.removeByName(this.selected, this.selectedKind);
  }

  /** Delete a component or connector by name (sprite/graphics + attached
   *  connectors) and its entry in diagram_definition. Used by the editor
   *  (deleteSelected) and by programmatic/bot edits. `kind` is inferred from the
   *  diagram when omitted, so callers needn't track the selection. */
  removeByName(name: string, kind?: "comp" | "conn" | null) {
    if (!name || !this.app || !this.diagram?.components?.[name]) return;
    const k = kind ?? (this.diagram.components[name].type === "Connector" ? "conn" : "comp");
    if (k === "conn") {
      this.conns = this.conns.filter((c) => {
        if (c.name !== name) return true;
        this.app!.stage.removeChild(c.graphics);
        this.app!.stage.removeChild(c.arrow);
        return false;
      });
      delete this.diagram.components[name];
      if (this.selected === name) this.clearSelection();
      this.onChangeCb?.();
      return;
    }
    const node = this.comps[name];
    if (node) {
      this.app.stage.removeChild(node.sprite);
      if (node.label) this.app.stage.removeChild(node.label);
      delete this.comps[name];
    }
    this.conns = this.conns.filter((c) => {
      if (c.from === name || c.to === name) {
        this.app!.stage.removeChild(c.graphics);
        this.app!.stage.removeChild(c.arrow);
        return false;
      }
      return true;
    });
    delete this.diagram.components[name];
    if (this.selected === name) this.clearSelection();
    this.onChangeCb?.();
  }

  private drawSelection() {
    if (!this.app) return;
    if (!this.selectionG) {
      this.selectionG = new Graphics();
      this.selectionG.zIndex = 9999;
      this.selectionG.eventMode = "none";
      this.app.stage.addChild(this.selectionG);
    }
    const g = this.selectionG;
    g.clear();
    if (!this.selected) return;
    if (this.selectedKind === "conn") {
      const conn = this.conns.find((c) => c.name === this.selected);
      if (!conn?.geom) return;
      // trace the path with a translucent cyan highlight under the backbone
      const geom = conn.geom;
      if (geom.type === "straight") {
        g.moveTo(geom.x1, geom.y1).lineTo(geom.x2, geom.y2);
      } else {
        const pts = samplePath(geom);
        g.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      }
      const w = numberOr(Number(conn.layout.path.width), 5) * this.scaling;
      g.stroke({ width: w + 6, color: 0x22d3ee, alpha: 0.5 });
      return;
    }
    const node = this.comps[this.selected];
    if (!node) return;
    const b = node.sprite.getBounds();
    g.rect(b.x, b.y, b.width, b.height).stroke({ width: 2, color: 0x22d3ee });
  }

  setConnectMode(on: boolean) {
    this.connectMode = on;
    this.connectFrom = null;
  }

  /** Add a new compartment bound to a model, placed at center. Note: newly added
   *  components are static until the engine is rebuilt with the exported diagram
   *  (the anim registry is fixed at model-build time). */
  async addCompartment(modelName: string, picto?: string) {
    if (!this.app || !this.diagram?.components) return null;
    const name = this.uniqueName(modelName || "NEW");
    const comp = defaultCompartment(modelName, picto);
    this.diagram.components[name] = comp;
    await Assets.load(["gfx/" + comp.picto]);
    this.makeCompartment(name, comp);
    this.select(name, "comp");
    this.onChangeCb?.();
    return name;
  }

  private createConnection(fromName: string, toName: string): string | null {
    if (!this.diagram?.components) return null;
    const name = this.uniqueName(fromName + "_" + toName);
    const comp = defaultConnector(fromName, toName);
    this.diagram.components[name] = comp;
    this.makeConnector(name, comp);
    this.select(name, "conn");
    this.onChangeCb?.();
    return name;
  }

  /** Create a connector between two existing components by name (programmatic
   *  equivalent of connect-mode's two clicks), optionally binding engine
   *  model(s) and applying a path patch. Returns the new connector name, or null
   *  if either endpoint is missing. */
  connect(
    from: string,
    to: string,
    opts?: { models?: string[]; path?: { type?: string; width?: number } },
  ): string | null {
    if (!this.comps[from] || !this.comps[to]) return null;
    const name = this.createConnection(from, to);
    if (!name) return null;
    if (opts?.models) this.setModels(name, opts.models);
    if (opts?.path) this.applyLayoutPatch(name, { path: opts.path });
    return name;
  }

  private uniqueName(base: string): string {
    let n = base || "NEW";
    let i = 1;
    while (this.diagram.components[n] || this.comps[n]) n = `${base}_${i++}`;
    return n;
  }

  private rerouteConnectors(name: string) {
    for (const conn of this.conns) {
      if (conn.from !== name && conn.to !== name) continue;
      const f = this.comps[conn.from];
      const t = this.comps[conn.to];
      if (f && t) conn.geom = this.drawPath(conn.graphics, conn.layout, f, t);
    }
  }

  dispose() {
    this.ready = false;
    if (this.ro) {
      this.ro.disconnect();
      this.ro = null;
    }
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    this.comps = {};
    this.conns = [];
    this.selectionG = null;
    this.bgDisc = null;
    this.gridG = null;
  }
}

function wrap01(v: number): number {
  return ((v % 1) + 1) % 1;
}

function defaultCompartment(modelName: string, picto?: string) {
  return {
    type: "Compartment",
    label: modelName || "",
    picto: (picto || "container.png").replace("gfx/", ""),
    enabled: true,
    models: modelName ? [modelName] : [],
    dbcFrom: "",
    dbcTo: "",
    layout: {
      general: { animatedBy: "vol", z_index: 10, alpha: 1, tinting: true },
      path: { type: "straight", width: 5, color: "#666666" },
      sprite: {
        color: "#ffffff",
        pos: { type: "rel", x: 0, y: 0, dgs: 0 },
        scale: { x: 1, y: 1 },
        anchor: { x: 0.5, y: 0.5 },
        rotation: 0,
      },
      label: { pos_x: 0, pos_y: 0, size: 10, rotation: 0, color: "#ffffff" },
    },
  };
}

function defaultConnector(from: string, to: string) {
  return {
    type: "Connector",
    label: "",
    picto: "container.png",
    enabled: true,
    models: [],
    dbcFrom: from,
    dbcTo: to,
    layout: {
      general: { animatedBy: "flow", z_index: 8, alpha: 1, tinting: true },
      path: { type: "straight", width: 7, color: "#666666" },
      sprite: {
        color: "#ffffff",
        pos: { type: "rel", x: 0, y: 0, dgs: 0 },
        scale: { x: 1, y: 1 },
        anchor: { x: 0.5, y: 0.5 },
        rotation: 0,
      },
      label: { pos_x: 0, pos_y: 0, size: 10, rotation: 0, color: "#ffffff" },
    },
  };
}

function numberOr(v: any, fallback: number): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

// shallow-recursive merge of a layout patch into the target (objects merged,
// primitives/arrays replaced).
function deepMerge(target: any, patch: any) {
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (v && typeof v === "object" && !Array.isArray(v) && typeof target[k] === "object") {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

function radiusFromVolume(vol: number): number {
  const cubic = vol / ((4.0 / 3.0) * Math.PI);
  return Math.cbrt(cubic);
}

function colorFromTo2(to2: number, maxTo2: number): number {
  if (Number.isNaN(to2)) return 0x666666;
  let v = to2 > maxTo2 ? maxTo2 : to2;
  let remap = (v / maxTo2) * (1 - -5) + -5; // remap [0,maxTo2] -> [-5,1]
  if (remap < 0) remap = 0;
  const red = Math.round(remap * 250) & 0xff;
  const green = Math.round(remap * 50) & 0xff;
  const blue = Math.round(70 + remap * 75) & 0xff;
  return (red << 16) | (green << 8) | blue;
}

// center of a circle of radius r passing through (x1,y1) and (x2,y2)
function circleCenterThrough(x1: number, y1: number, x2: number, y2: number, r: number) {
  const q = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) || 1;
  const x3 = (x1 + x2) / 2;
  const y3 = (y1 + y2) / 2;
  const h = Math.sqrt(Math.max(0, r * r - (q / 2) ** 2));
  return {
    cx: x3 + h * ((y1 - y2) / q),
    cy: y3 + h * ((x2 - x1) / q),
  };
}

function angleOnCircle(cx: number, cy: number, x: number, y: number): number {
  return Math.atan2(y - cy, x - cx);
}

// Sample a connector path geometry into a flat [x0,y0,x1,y1,...] point list.
// Straight paths are 2 points; arcs are tessellated into ~24 segments.
function samplePath(geom: any): number[] {
  if (!geom) return [];
  if (geom.type === "straight") return [geom.x1, geom.y1, geom.x2, geom.y2];
  const steps = 24;
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = geom.from + (geom.to - geom.from) * (i / steps);
    pts.push(geom.cx + geom.r * Math.cos(a), geom.cy + geom.r * Math.sin(a));
  }
  return pts;
}

// A Pixi-compatible hit area (anything with contains(x,y)) that tests whether a
// point lies within `tol` px of a polyline — used to make thin connector
// strokes comfortably clickable in the editor.
class PolylineHitArea {
  private pts: number[];
  private tol: number;
  constructor(pts: number[], tol: number) {
    this.pts = pts;
    this.tol = tol;
  }
  contains(x: number, y: number): boolean {
    const t2 = this.tol * this.tol;
    for (let i = 0; i + 3 < this.pts.length; i += 2) {
      if (distToSeg2(x, y, this.pts[i], this.pts[i + 1], this.pts[i + 2], this.pts[i + 3]) <= t2)
        return true;
    }
    return false;
  }
}

// squared distance from point (px,py) to segment (ax,ay)-(bx,by)
function distToSeg2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
}
