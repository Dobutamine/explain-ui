import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { useExplain } from "@/composables/useExplain";
import {
  parseCommands,
  validateCommand,
  executeCommand,
  type BotCommand,
  type NormalizedCommand,
  type CommandScope,
} from "@/services/botCommands";

// Chat with the "explain-labs_claude" bot (built specifically for this project).
// Talks to the dev-server proxy at /api/chat (see vite.config.ts), which injects
// the API key server-side. Each turn carries a compact snapshot of the current
// simulated patient so the bot can answer about "this patient".
//
// The bot can also propose ACTIONS on the model by embedding fenced
// ```explain-command``` JSON blocks in its reply. We parse + validate those here
// (see services/botCommands.ts) and attach them to the assistant message as
// PendingCommands; the user applies them with a click (confirm-before-apply).

// A bot-proposed action attached to an assistant message.
export interface PendingCommand {
  cmd: BotCommand;
  status: "pending" | "applied" | "dismissed" | "invalid";
  description: string;
  error?: string;
  normalized?: NormalizedCommand;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  failed?: boolean;
  commands?: PendingCommand[];
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
  // Audit of actions the user applied from the bot's suggestions, echoed back
  // into the next context block so the bot knows its proposals took effect.
  const appliedLog = ref<{ description: string; ts: number }[]>([]);

  // When on, valid bot commands execute the moment the reply arrives (no click).
  // Off by default (confirm-before-apply); persisted so a trusted session sticks.
  const autoApply = ref(localStorage.getItem("explain.chat.autoApply") === "1");
  watch(autoApply, (v) => localStorage.setItem("explain.chat.autoApply", v ? "1" : "0"));

  // Command surface: "full" = any settable registry field; "guided" = the curated
  // 26-command allowlist (safe demos). Default full; persisted.
  const commandScope = ref<CommandScope>(
    localStorage.getItem("explain.chat.scope") === "guided" ? "guided" : "full",
  );
  watch(commandScope, (v) => localStorage.setItem("explain.chat.scope", v));

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

    // Live model map: every instance grouped by model_type, so the bot can map a
    // natural-language target onto the right instance name (then look up its
    // settable fields in the command catalog). Only changes on scenario load.
    if (state?.models) {
      const byType = new Map<string, string[]>();
      for (const [name, m] of Object.entries<any>(state.models)) {
        const t = m?.model_type ?? "?";
        (byType.get(t) ?? byType.set(t, []).get(t)!).push(name);
      }
      if (byType.size) {
        lines.push("Models in scenario (instance names by model_type), targetable by commands:");
        for (const t of [...byType.keys()].sort())
          lines.push(`- ${t}: ${byType.get(t)!.sort().join(", ")}`);
      }
    }

    // Tell the bot which of its proposed actions the user has actually applied
    // (most recent first), so it can reason about cause/effect across turns.
    const recent = appliedLog.value.slice(-8).reverse();
    if (recent.length) {
      const now = Date.now();
      lines.push("Applied from your suggestions:");
      for (const a of recent) lines.push(`- ${a.description} (${ago(now - a.ts)} ago)`);
    }

    return lines.join("\n");
  }

  // compact relative-time label: 12s / 3m / 1h
  function ago(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m`;
    return `${Math.round(m / 60)}h`;
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
      pushAssistantReply(body.answer);
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

  // Turn a raw bot reply into an assistant message: strip out any command
  // blocks, validate each against the live model, and attach them as
  // PendingCommands. The visible text is the prose with the blocks removed.
  function pushAssistantReply(answer: string) {
    const { modelState } = useExplain();
    const { clean, commands, parseErrors } = parseCommands(answer);

    const pending: PendingCommand[] = commands.map((cmd) => {
      const v = validateCommand(cmd, modelState.value, commandScope.value);
      return {
        cmd,
        description: v.description,
        normalized: v.normalized,
        error: v.error,
        status: v.ok ? ("pending" as const) : ("invalid" as const),
      };
    });

    if (parseErrors.length) error.value = `bot sent a malformed command block (${parseErrors.length})`;

    messages.value.push({
      role: "assistant",
      text: clean || (commands.length ? "" : answer),
      commands: pending.length ? pending : undefined,
    });

    // Auto-apply mode: run every valid command immediately (invalid ones are
    // skipped by applyCommand and stay visible with their reason).
    if (autoApply.value && pending.length) applyAll(messages.value.length - 1);
  }

  // Apply a single pending command to the live engine (confirm-before-apply).
  function applyCommand(messageIndex: number, cmdIndex: number) {
    const pc = messages.value[messageIndex]?.commands?.[cmdIndex];
    if (!pc || pc.status !== "pending" || !pc.normalized) return;
    const explain = useExplain();
    try {
      executeCommand(pc.normalized, explain);
      pc.status = "applied";
      appliedLog.value.push({ description: pc.description, ts: Date.now() });
    } catch (e) {
      pc.status = "invalid";
      pc.error = (e as Error).message;
    }
  }

  function dismissCommand(messageIndex: number, cmdIndex: number) {
    const pc = messages.value[messageIndex]?.commands?.[cmdIndex];
    if (pc && pc.status === "pending") pc.status = "dismissed";
  }

  function applyAll(messageIndex: number) {
    const cmds = messages.value[messageIndex]?.commands ?? [];
    cmds.forEach((_, i) => applyCommand(messageIndex, i));
  }

  function newConversation() {
    messages.value = [];
    conversationId.value = null;
    error.value = null;
    appliedLog.value = [];
  }

  return {
    messages,
    isLoading,
    error,
    conversationId,
    autoApply,
    commandScope,
    sendMessage,
    newConversation,
    applyCommand,
    dismissCommand,
    applyAll,
  };
});
