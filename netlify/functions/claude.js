import { requireAuth, json } from "./_auth.js";
import { readJSON, writeJSON } from "./_blobs.js";
import { OPS } from "./_prompts.js";
import { getAccessToken, googleServers } from "./_google.js";
import { anthropicKey } from "./_key.js";

const DAILY_CALL_CAP = 250; // blunt guard against runaway spend

const today = () => new Date().toISOString().slice(0, 10);

async function underCap() {
  const key = `ratelimit:${today()}`;
  const n = (await readJSON("cockpit", key, 0)) || 0;
  if (n >= DAILY_CALL_CAP) return false;
  await writeJSON("cockpit", key, n + 1);
  return true;
}

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const { clean: apiKey } = anthropicKey();
  if (!apiKey) return json({ error: "No Anthropic key set. Add ANTHROPIC_API_KEY_NEWSDESK on this site." }, 500);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  // Operation allowlist. The browser names an operation, it never sends prompt text.
  const op = OPS[body.op];
  if (!op) return json({ error: "Unknown operation" }, 400);
  if (!(await underCap())) return json({ error: "Daily call limit reached. Resets at midnight UTC." }, 429);

  const args = {
    kind: typeof body.kind === "string" ? body.kind.slice(0, 40) : "",
    extra: typeof body.extra === "string" ? body.extra.slice(0, 500) : "",
    archive: typeof body.archive === "string" ? body.archive.slice(0, 8000) : "",
    story: body.story && typeof body.story === "object" ? body.story : null,
    threads: Array.isArray(body.threads) ? body.threads.slice(0, 40) : [],
    dateStr: new Date().toDateString(),
  };
  if (body.op === "generate" && !["post", "script", "substack", "ideas", "sponsor", "foundrae"].includes(args.kind)) {
    return json({ error: "Unknown generator" }, 400);
  }

  const wantsGoogle = typeof op.google === "function" ? op.google(args) : op.google;
  let servers = [];
  if (wantsGoogle) {
    const token = await getAccessToken();
    if (!token) return json({ error: "Google is not connected. Connect it in Settings, then try again." }, 428);
    servers = googleServers(token);
  }

  const payload = {
    model: "claude-sonnet-4-6",
    max_tokens: op.maxTokens,
    system: op.system(args),
    messages: [{ role: "user", content: op.user(args) }],
  };
  if (op.search) payload.tools = [{ type: "web_search_20250305", name: "web_search" }];
  if (servers.length) payload.mcp_servers = servers;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "mcp-client-2025-04-04",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let hint = "";
    try {
      const e = await res.json();
      hint = e?.error?.message ? String(e.error.message).slice(0, 200) : "";
    } catch {
      /* ignore */
    }
    if (res.status === 401) hint = "Anthropic rejected the API key. Check it is a full key from console.anthropic.com, pasted with no spaces or quotes, and not revoked.";
    if (res.status === 429) hint = "Anthropic rate limit or credit exhausted. Check your plan usage.";
    return json({ error: `Anthropic returned ${res.status}. ${hint}` }, 502);
  }

  const data = await res.json();
  const blocks = data.content || [];
  return json({
    text: blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim(),
    calls: blocks.filter((b) => b.type === "mcp_tool_use").length,
    failed: blocks.filter((b) => b.type === "mcp_tool_result" && b.is_error).length,
  });
};
