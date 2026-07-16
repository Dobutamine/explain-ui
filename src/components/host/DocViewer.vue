<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import MarkdownIt from "markdown-it";
import Tree from "primevue/tree";
import Button from "primevue/button";
import type { TreeNode } from "primevue/treenode";

// In-app documentation viewer (center-pane "docs" tab). Reads two trees at
// build time via import.meta.glob — keys give us the nav up front, values
// lazily load each file's raw markdown only when opened. Rendered with the
// same markdown-it approach as ChatPanel (html:false is the XSS guard), minus
// the chat-only `breaks:true`. Both trees stay the single source of truth —
// no copy step, and Vite bundles each .md as a lazy chunk so this works in
// dev and prod alike.
//
// The engine's physiological reference lives in the explain-engine submodule,
// beside the code it documents, so it resolves for anyone who clones that repo
// on its own. Consequence: a checkout without `git submodule update --init`
// leaves explain-engine/ empty and the Engine group simply won't appear.
const docModules = import.meta.glob(
  ["/docs/**/*.md", "/explain-engine/docs/**/*.md"],
  {
    query: "?raw",
    import: "default",
  }
) as Record<string, () => Promise<string>>;

// Engine docs are keyed by their real submodule path; present them as "engine/".
const ENGINE_DOCS = "/explain-engine/docs/";

const md = new MarkdownIt({ html: false, linkify: true });

// External links open in a new tab, safely. Internal (relative) links are
// intercepted on click below, so the target here is harmless for them.
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet("target", "_blank");
  tokens[idx].attrSet("rel", "noopener noreferrer");
  return defaultLinkOpen(tokens, idx, options, env, self);
};

// --- Nav tree ------------------------------------------------------------
// Derive a readable label from a file path. PascalCase class docs (Heart,
// BloodCapacitance) read fine as-is; ALL_CAPS / snake_case meta docs
// (UI_ARCHITECTURE, MODEL_DEFINITIONS, TESTING) become Title Case.
function labelFor(key: string): string {
  const stem = (key.split("/").pop() ?? "").replace(/\.md$/, "");
  if (stem === "README") return "Index";
  if (stem.includes("_") || stem === stem.toUpperCase()) {
    return stem
      .split("_")
      .map((w) => (w === "UI" ? "UI" : w.charAt(0) + w.slice(1).toLowerCase()))
      .join(" ");
  }
  return stem;
}

const GROUPS = [
  { key: "g-overview", label: "Overview", match: (k: string) => k === "/docs/README.md" },
  { key: "g-ui", label: "UI", match: (k: string) => k.startsWith("/docs/ui/") },
  { key: "g-engine", label: "Engine", match: (k: string) => k.startsWith(ENGINE_DOCS) },
];

const allKeys = Object.keys(docModules);
const nodes: TreeNode[] = GROUPS.map((g) => {
  const children = allKeys
    .filter(g.match)
    .map((k) => ({ key: k, label: labelFor(k), icon: "pi pi-file", data: k }))
    // README first within a group, then alphabetical by label.
    .sort((a, b) => {
      const ar = a.key.endsWith("/README.md") ? 0 : 1;
      const br = b.key.endsWith("/README.md") ? 0 : 1;
      return ar - br || a.label.localeCompare(b.label);
    });
  return { key: g.key, label: g.label, selectable: false, children };
}).filter((g) => g.children.length > 0);

const expandedKeys = ref<Record<string, boolean>>(
  Object.fromEntries(GROUPS.map((g) => [g.key, true]))
);
const selectionKeys = ref<Record<string, boolean>>({});

// --- Active document -----------------------------------------------------
const activeKey = ref<string>("/docs/README.md");
const html = shallowRef<string>("");
const sidebarOpen = ref(true);
const contentEl = ref<HTMLDivElement | null>(null);

// "engine / Heart" style breadcrumb for the current doc.
function crumbFor(key: string): string {
  return key
    .replace(ENGINE_DOCS, "engine/")
    .replace(/^\/docs\//, "")
    .replace(/\.md$/, "")
    .split("/")
    .map((seg, i, arr) => (i === arr.length - 1 ? labelFor(seg + ".md") : seg))
    .join(" / ");
}

async function loadDoc(key: string) {
  const loader = docModules[key];
  if (!loader) return;
  activeKey.value = key;
  selectionKeys.value = { [key]: true };
  const raw = await loader();
  html.value = md.render(raw);
  contentEl.value?.scrollTo(0, 0);
}

function onSelect(node: TreeNode) {
  if (typeof node.data === "string") loadDoc(node.data);
}

// Intercept clicks on rendered links: keep cross-doc navigation inside the
// viewer; let external links open a new tab; ignore links to non-doc files
// (e.g. ../../explain-engine/Model.js source links) so nothing 404s.
function onLinkClick(e: MouseEvent) {
  const a = (e.target as HTMLElement)?.closest("a");
  if (!a) return;
  const href = a.getAttribute("href");
  if (!href) return;
  if (/^https?:\/\//i.test(href)) return; // external → allow default (new tab)
  e.preventDefault();
  if (href.startsWith("#")) return; // in-page anchor → no-op (no heading ids in v1)
  // Resolve the relative href against the current doc's path.
  const resolved = new URL(href, "file://" + activeKey.value).pathname;
  if (resolved.endsWith(".md") && docModules[resolved]) loadDoc(resolved);
}

onMounted(() => loadDoc(activeKey.value));
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <Button
        type="button"
        size="small"
        text
        severity="secondary"
        :aria-label="sidebarOpen ? 'Hide contents' : 'Show contents'"
        v-tooltip.top="sidebarOpen ? 'Hide contents' : 'Show contents'"
        @click="sidebarOpen = !sidebarOpen"
      >
        <i class="pi pi-bars"></i>
      </Button>
      <span class="text-sm opacity-70 truncate">{{ crumbFor(activeKey) }}</span>
    </div>

    <div class="flex gap-3" style="height: 65vh; min-height: 480px">
      <aside
        v-show="sidebarOpen"
        class="w-56 shrink-0 overflow-y-auto rounded border border-surface-700 bg-surface-900"
      >
        <Tree
          :value="nodes"
          selectionMode="single"
          v-model:selectionKeys="selectionKeys"
          v-model:expandedKeys="expandedKeys"
          @node-select="onSelect"
          class="text-sm"
        />
      </aside>

      <div
        ref="contentEl"
        class="md-body flex-1 min-w-0 overflow-y-auto rounded border border-surface-700 bg-surface-900 p-4"
        @click="onLinkClick"
        v-html="html"
      ></div>
    </div>
  </div>
</template>

<style scoped>
/* Markdown content styling. Tailwind's preflight strips list markers and
   heading sizes, so restore a compact, readable set here. Scoped + :deep()
   because the HTML is injected via v-html. Mirrors ChatPanel's .md-body block;
   extract to a shared stylesheet if a third consumer appears. */
.md-body :deep(> *:first-child) {
  margin-top: 0;
}
.md-body :deep(> *:last-child) {
  margin-bottom: 0;
}
.md-body :deep(p) {
  margin: 0.4rem 0;
}
.md-body :deep(ul),
.md-body :deep(ol) {
  margin: 0.4rem 0;
  padding-left: 1.25rem;
}
.md-body :deep(ul) {
  list-style: disc;
}
.md-body :deep(ol) {
  list-style: decimal;
}
.md-body :deep(li) {
  margin: 0.15rem 0;
}
.md-body :deep(li > ul),
.md-body :deep(li > ol) {
  margin: 0.15rem 0;
}
.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3),
.md-body :deep(h4) {
  font-weight: 600;
  line-height: 1.25;
  margin: 0.8rem 0 0.4rem;
}
.md-body :deep(h1) {
  font-size: 1.3rem;
}
.md-body :deep(h2) {
  font-size: 1.15rem;
}
.md-body :deep(h3),
.md-body :deep(h4) {
  font-size: 1.02rem;
}
.md-body :deep(a) {
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.md-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  background: rgb(0 0 0 / 0.3);
  padding: 0.1em 0.3em;
  border-radius: 0.25rem;
}
.md-body :deep(pre) {
  margin: 0.4rem 0;
  padding: 0.5rem 0.6rem;
  background: rgb(0 0 0 / 0.35);
  border-radius: 0.375rem;
  overflow-x: auto;
}
.md-body :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 0.8rem;
  line-height: 1.4;
}
.md-body :deep(blockquote) {
  margin: 0.4rem 0;
  padding-left: 0.6rem;
  border-left: 3px solid rgb(255 255 255 / 0.2);
  opacity: 0.85;
}
.md-body :deep(table) {
  border-collapse: collapse;
  margin: 0.4rem 0;
  font-size: 0.85em;
}
.md-body :deep(th),
.md-body :deep(td) {
  border: 1px solid rgb(255 255 255 / 0.15);
  padding: 0.2rem 0.4rem;
  text-align: left;
}
.md-body :deep(hr) {
  border: none;
  border-top: 1px solid rgb(255 255 255 / 0.15);
  margin: 0.8rem 0;
}
</style>
