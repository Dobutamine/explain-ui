import { defineStore } from "pinia";
import { shallowRef } from "vue";
import type { DiagramRenderer } from "@/render/DiagramRenderer";

// Bridge between the chat store (engine-only) and the live diagram editor.
//
// The DiagramRenderer instance is owned locally by Diagram.vue's <script setup>;
// it isn't a global. This tiny store lets Diagram.vue publish the active renderer
// while it's mounted, so the bot-command pipeline can drive diagram edits without
// the renderer becoming a global singleton.
//
// Diagram and Chat are sibling tabs in the same (non-lazy) center Tabs group, so
// the renderer normally stays mounted while the user chats. When it's absent
// (renderer torn down), diagram commands surface as an actionable invalid card
// ("open the Diagram tab to apply") rather than failing silently.
export const useDiagramStore = defineStore("diagram", () => {
  const activeRenderer = shallowRef<DiagramRenderer | null>(null);

  function register(r: DiagramRenderer) {
    activeRenderer.value = r;
  }

  // Only clear if the unregistering renderer is still the active one (guards
  // against a remount registering a new renderer before the old one unmounts).
  function unregister(r: DiagramRenderer) {
    if (activeRenderer.value === r) activeRenderer.value = null;
  }

  function getDiagram(): any | null {
    return activeRenderer.value?.getDiagram() ?? null;
  }

  return { activeRenderer, register, unregister, getDiagram };
});
