import { requireAuth, json } from "./_auth.js";
import { readJSON, writeJSON } from "./_blobs.js";
import { OPS } from "./_prompts.js";
import { getAccessToken, googleServers, opusServer } from "./_google.js";
import { anthropicKey } from "./_key.js";
import { fetchBriefing } from "./_workspace.js";
import { containsClientMaterial, applyOverrides, haltMessage } from "./_contracts.js";
import { listProjects, listClips } from "./_opus.js";

/**
 * Netlify runs any *-background function asynchronously with a long budget,
 * returning 202 straight away. The wire and the sweep both take far longer
 * than a synchronous function is allowed to live, so the work happens here
 * and the answer lands in blob storage for /api/job to collect.
 */

const DAILY_CALL_CAP = 250;
const JOB_TTL_NOTE = "Jobs are read once by the client and left to expire.";

const day = () => new Date().toISOString().slice(0, 10);

async function underCap() {
  const key = `ratelimit:${day()}`;
  const n = (await readJSON("cockpit", key, 0)) || 0;
  if (n >= DAILY_CALL_CAP) return false;
  await writeJSON("cockpit", key, n + 1);
  return true;
}

const finish = (id, patch) => writeJSON("cockpit", `job:${id}`, { updated: Date.now(), ...patch });

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const id = String(body.jobId || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
  if (!id) return json({ error: "Missing jobId" }, 400);

  const op = OPS[body.op];
  if (!op) {
    await finish(id, { status: "error", error: "Unknown operation" });
    return json({ accepted: false }, 400);
  }

  await finish(id, { status: "running" });

  try {
    if (!(await underCap())) throw new Error("Daily call limit reached. Resets at midnight UTC.");

    const { clean: apiKey } = anthropicKey();
    if (!apiKey) throw new Error("No Anthropic key set on this site.");

    const args = {
      kind: typeof body.kind === "string" ? body.kind.slice(0, 40) : "",
      extra: typeof body.extra === "string" ? body.extra.slice(0, 500) : "",
      archive: typeof body.archive === "string" ? body.archive.slice(0, 8000) : "",
      story: body.story && typeof body.story === "object" ? body.story : null,
      threads: Array.isArray(body.threads) ? body.threads.slice(0, 40) : [],
      thread: typeof body.thread === "string" ? body.thread.slice(0, 200) : "",
      draft: typeof body.draft === "string" ? body.draft.slice(0, 20000) : "",
      history: Array.isArray(body.history) ? body.history.slice(-14) : [],
      dateStr: new Date().toDateString(),
    };
    if (body.op === "generate" && !["post", "script", "substack", "ideas", "sponsor", "foundrae"].includes(args.kind)) {
      throw new Error("Unknown generator");
    }

 // Guardrail 4, enforced in code rather than trusted to a prompt.
    // Client material must never become public video metadata.
    //
    // The matcher cannot tell Phoebe Buffay from Phoebe Johnson. Rather than
    // teach it to guess, a person can clear a specific term by saying why —
    // and that reason is recorded, per term, before anything is generated.
    if (body.op === "metadata" || body.op === "selection") {
      const hits = containsClientMaterial(args.draft);
      if (hits.length) {
        const { cleared, blocked } = applyOverrides(hits, body.overrides);

        if (blocked.length) {
          const e = new Error(haltMessage(blocked));
          e.blocked = blocked;              // so the UI can offer the field
          throw e;
        }

        // Nothing blocked, but the record matters more than the pass.
        for (const c of cleared) {
          await writeJSON("cockpit", `override:${Date.now()}:${c.term}`, {
            term: c.term, reason: c.reason, op: body.op,
            at: new Date().toISOString(),
            excerpt: String(args.draft || "").slice(0, 400),
          });
        }
      }

      if ((args.draft || "").trim().split(/\s+/).length < 500) {
        throw new Error(
          "Halted. Transcript is under 500 words. Guardrail 2 says do not infer clip boundaries from titles or virality scores alone."
        );
      }
    }

    const wantsGoogle = typeof op.google === "function" ? op.google(args) : op.google;
    let servers = [];
    if (wantsGoogle) {
      const token = await getAccessToken();
      if (!token) throw new Error("Google is not connected. Connect it in the footer, then try again.");
      servers = googleServers(token);
    }

    if (op.opus) {
      const o = opusServer();
      if (!o) throw new Error("OPUS_API_KEY is not set on this site. Add it in Netlify and redeploy.");
      servers = [...servers, o];
    }

    // The clip queue reads Opus itself, then hands the model plain data.
    if (body.op === "clips") {
      const projects = await listProjects();
      const chosen = projects.slice(0, 4);
      const library = [];
      for (const p of chosen) {
        const id = p.project_id || p.projectId || p.id;
        try {
          await new Promise((r) => setTimeout(r, 250));   // 30 req/min ceiling
          // listProjects returns snake_case project_id, so use the resolved id.
          const clips = await listClips(id);
          library.push({
            projectId: id,
            title: p.title,
            created: p.created_at || p.createdAt,
            clips: clips.slice(0, 12).map((c) => ({
              // curationId is the clip identifier the posting endpoints want.
              // `id` is the composite "projectId.curationId" and publishing
              // rejects it with "Clip not found". There is no clipId field.
              clipId: c.curationId,
              rank: c.rank,
              score: c.score,
              hookScore: c.judgeResult && c.judgeResult.hookScore,
              seconds: c.durationMs ? Math.round(c.durationMs / 1000) : null,
              opusTitle: c.title,
              // The actual words in the clip. Judge on this, not on Opus's title.
              transcript: (c.text || "").replace(/__silence/g, " ").replace(/\s+/g, " ").slice(0, 500),
            })).filter((c) => c.clipId),
          });
        } catch (e) {
          library.push({ projectId: id, title: p.title, error: String(e.message) });
        }
      }
      if (!library.length) throw new Error("Opus returned no projects. Check /api/opus-test for the exact status.");
      args.data = { library };
    }

    // The sweep reads Google itself, then hands the model plain data and no tools.
    if (body.op === "sweep") {
      const token = await getAccessToken();
      if (!token) throw new Error("Google is not connected. Use CONNECT GOOGLE in the footer.");
      args.data = await fetchBriefing(token);
    }

    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: op.maxTokens,
      system: op.system(args),
      // Multi turn ops build their own message list; single shot ops get one turn.
      messages: op.messages ? op.messages(args) : [{ role: "user", content: op.user(args) }],
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
      if (res.status === 401) hint = "Anthropic rejected the API key.";
      if (res.status === 429) hint = "Anthropic rate limit or credit exhausted.";
      throw new Error(`Anthropic returned ${res.status}. ${hint}`);
    }

    const data = await res.json();
    const blocks = data.content || [];
    await finish(id, {
      status: "done",
      text: blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim(),
      calls: blocks.filter((b) => b.type === "mcp_tool_use").length,
      failed: blocks.filter((b) => b.type === "mcp_tool_result" && b.is_error).length,
      note: JOB_TTL_NOTE,
    });
  } catch (e) {
    await finish(id, { status: "error", error: String(e.message || e).slice(0, 300) });
  }

  return json({ accepted: true });
};
