import { defineStore } from "pinia";
import { ref } from "vue";
import { useExplain } from "@/composables/useExplain";

// Chat with the "explain-labs_claude" bot (built specifically for this project).
// Talks to the dev-server proxy at /api/chat (see vite.config.ts), which injects
// the API key server-side. Each turn carries a compact snapshot of the current
// simulated patient so the bot can answer about "this patient".

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  failed?: boolean;
}

interface MonitorParam {
  label: string;
  unit?: string;
  factor?: number;
  rounding?: number;
  props?: string[];
  weight_based?: boolean;
}

export const useChatStore = defineStore("chat", () => {
  const messages = ref<ChatMessage[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const conversationId = ref<string | null>(null);

  // Pull the same monitor groups the right-column panel shows, format the latest
  // slow-stream sample exactly like NumericReadoutPanel, and return a plain-text
  // block. Returns "" when nothing is loaded yet.
  function buildContext(): string {
    const { model, modelState, slowValues, watchSlow } = useExplain();
    const lines: string[] = [];

    const state = modelState.value as any;
    if (state) {
      const bits: string[] = [];
      if (typeof state.weight === "number") bits.push(`weight ${state.weight.toFixed(3)} kg`);
      if (typeof state.gestational_age === "number")
        bits.push(`gestational age ${state.gestational_age} wk`);
      if (typeof state.age === "number") bits.push(`age ${state.age} d`);
      if (bits.length) lines.push(bits.join(", "));
    }

    const monitors = (model as any).loadedFileData?.configuration?.monitors ?? {};
    const groups = Object.entries<any>(monitors).filter(([, m]) => m?.enabled !== false);

    // make sure every path we want is on the slow watchlist (engine dedups)
    const paths = new Set<string>();
    for (const [, m] of groups)
      for (const p of (m.parameters ?? []) as MonitorParam[])
        for (const path of p.props ?? []) paths.add(path);
    if (paths.size) watchSlow([...paths]);

    const arr = slowValues.value as any[];
    const latest = Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
    const weight =
      typeof state?.weight === "number" && state.weight > 0 ? state.weight : 1;

    const fmt = (p: MonitorParam): string | null => {
      const ps = p.props ?? [];
      if (!ps.length || !latest) return null;
      const vals = ps.map((path) => {
        let v = latest[path];
        if (typeof v !== "number") return "—";
        v *= p.factor ?? 1;
        if (p.weight_based) v /= weight;
        return v.toFixed(p.rounding ?? 0);
      });
      if (vals.every((v) => v === "—")) return null;
      return `${p.label}: ${vals.join("/")}${p.unit ? " " + p.unit : ""}`;
    };

    for (const [key, m] of groups) {
      const rows = ((m.parameters ?? []) as MonitorParam[])
        .map(fmt)
        .filter((s): s is string => !!s);
      if (rows.length) lines.push(`${m.title ?? key}: ${rows.join(", ")}`);
    }

    return lines.join("\n");
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading.value) return;
    error.value = null;
    messages.value.push({ role: "user", text: trimmed });
    isLoading.value = true;

    try {
      const context = buildContext();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          context,
          conversation_id: conversationId.value,
        }),
      });
      // a missing endpoint (stale dev server) falls through to the SPA → HTML,
      // so guard against a non-JSON body before trusting res.ok.
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || typeof body.answer !== "string") {
        throw new Error(
          body?.error ||
            `chat endpoint unavailable (status ${res.status}) — restart the dev server (npm run dev)`,
        );
      }
      conversationId.value = body.conversation_id ?? conversationId.value;
      messages.value.push({ role: "assistant", text: body.answer });
    } catch (e) {
      error.value = (e as Error).message;
      messages.value.push({
        role: "assistant",
        text: `⚠️ ${(e as Error).message}`,
        failed: true,
      });
    } finally {
      isLoading.value = false;
    }
  }

  function newConversation() {
    messages.value = [];
    conversationId.value = null;
    error.value = null;
  }

  return { messages, isLoading, error, conversationId, sendMessage, newConversation };
});
