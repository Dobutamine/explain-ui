import { defineConfig, loadEnv, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import fs from "node:fs";
import path from "node:path";

// Dev-only endpoint: POST /api/save-snapshot { name, data } writes a named
// scenario file into public/model_definitions/ and registers it in index.json,
// so snapshots become first-class scenarios selectable from the dropdown.
// DELETE /api/delete-snapshot removes a file and its index entry.
function snapshotApi(): Plugin {
  const dir = fileURLToPath(new URL("./public/model_definitions", import.meta.url));
  const idxPath = path.join(dir, "index.json");
  const safeName = (name: unknown) =>
    path.basename(String(name ?? "").trim().replace(/[^a-zA-Z0-9._-]/g, "_"));
  const readIndex = (): string[] => {
    try {
      return JSON.parse(fs.readFileSync(idxPath, "utf8"));
    } catch {
      return [];
    }
  };

  // POST-with-JSON-body middleware helper
  const jsonPost = (
    handler: (body: any, reply: (code: number, obj: unknown) => void) => void,
  ) => {
    return (req: any, res: any, next: () => void) => {
      if (req.method !== "POST") return next();
      let raw = "";
      req.on("data", (c: Buffer) => (raw += c));
      req.on("end", () => {
        const reply = (code: number, obj: unknown) => {
          res.statusCode = code;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(obj));
        };
        try {
          handler(JSON.parse(raw || "{}"), reply);
        } catch (e) {
          reply(500, { ok: false, error: String(e) });
        }
      });
    };
  };

  return {
    name: "snapshot-api",
    configureServer(server) {
      server.middlewares.use(
        "/api/save-snapshot",
        jsonPost(({ name, data }, reply) => {
          const safe = safeName(name);
          if (!safe) return reply(400, { ok: false, error: "invalid name" });
          fs.writeFileSync(path.join(dir, `${safe}.json`), JSON.stringify(data, null, 2));
          const idx = readIndex();
          if (!idx.includes(safe)) {
            idx.push(safe);
            idx.sort();
            fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2));
          }
          reply(200, { ok: true, name: safe });
        }),
      );

      server.middlewares.use(
        "/api/delete-snapshot",
        jsonPost(({ name }, reply) => {
          const safe = safeName(name);
          if (!safe) return reply(400, { ok: false, error: "invalid name" });
          const file = path.join(dir, `${safe}.json`);
          if (fs.existsSync(file)) fs.unlinkSync(file);
          const idx = readIndex().filter((n) => n !== safe);
          fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2));
          reply(200, { ok: true, name: safe });
        }),
      );
    },
  };
}

// Dev-only proxy: POST /api/chat { prompt, conversation_id?, context? } forwards
// to the "explain-labs_claude" bot (a Claude bot built specifically for this
// project, on the Tailnet port 8090) and echoes its reply back. The bot URL +
// API key are read from server-side env (EXPLAIN_BOT_URL / EXPLAIN_BOT_API_KEY)
// and NEVER exposed to the browser bundle — same reason the cradle-webapp proxies
// through a Next.js route instead of calling the bot directly. `env` is the
// loadEnv() result so values in .env.local are picked up without a VITE_ prefix
// (a VITE_ prefix would leak them into the client build).
function explainBotApi(env: Record<string, string>): Plugin {
  const baseUrl = env.EXPLAIN_BOT_URL || process.env.EXPLAIN_BOT_URL || "";
  const apiKey = env.EXPLAIN_BOT_API_KEY || process.env.EXPLAIN_BOT_API_KEY || "";

  return {
    name: "explain-bot-api",
    configureServer(server) {
      server.middlewares.use("/api/chat", (req: any, res: any, next: () => void) => {
        if (req.method !== "POST") return next();
        let raw = "";
        req.on("data", (c: Buffer) => (raw += c));
        req.on("end", async () => {
          const reply = (code: number, obj: unknown) => {
            res.statusCode = code;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(obj));
          };
          if (!baseUrl || !apiKey) {
            return reply(400, {
              error:
                "explain bot not configured — set EXPLAIN_BOT_URL and EXPLAIN_BOT_API_KEY in .env.local and restart the dev server",
            });
          }
          try {
            const { prompt, conversation_id, context } = JSON.parse(raw || "{}");
            // Prepend the live patient-state block so the bot can answer about
            // "this patient". The bot treats the whole string as the user turn.
            const fullPrompt = context
              ? `Current simulated patient state:\n${context}\n\n---\n\n${prompt ?? ""}`
              : (prompt ?? "");
            const upstream = await fetch(`${baseUrl}/v1/ask`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
              body: JSON.stringify({
                prompt: fullPrompt,
                ...(conversation_id ? { conversation_id } : {}),
              }),
            });
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader(
              "content-type",
              upstream.headers.get("content-type") ?? "application/json",
            );
            res.end(text);
          } catch (e) {
            reply(502, { error: `explain bot unreachable: ${String(e)}` });
          }
        });
      });
    },
  };
}

// COOP/COEP make `crossOriginIsolated === true`, which activates
// SharedArrayBuffer — the preferred realtime data-plane transport
// (ChannelWriter auto-falls back to transferable ArrayBuffers when these
// headers are absent, so the app still works without them).
const crossOriginIsolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig(({ mode }) => {
  // Load all env (no prefix filter) so server-side-only EXPLAIN_BOT_* vars in
  // .env.local reach the chat proxy without being exposed to the client bundle.
  const env = loadEnv(mode, process.cwd(), "");
  return {
  plugins: [vue(), tailwindcss(), snapshotApi(), explainBotApi(env)],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@explain": fileURLToPath(new URL("./explain", import.meta.url)),
    },
  },
  // the ModelEngine worker is spawned as an ES module
  worker: { format: "es" },
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  };
});
