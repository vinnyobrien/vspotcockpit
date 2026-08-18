import { requireAuth, json } from "./_auth.js";
import { readJSON, writeJSON } from "./_blobs.js";
import { OPS } from "./_prompts.js";
import { getAccessToken, googleServers, opusServer } from "./_google.js";
import { anthropicKey } from "./_key.js";
import { fetchBriefing } from "./_workspace.js";
import { containsClientMaterial, applyOverrides, haltMessage } from "./_contracts.js";
import { listProjects, listClips } from "./_opus.js";
import { selectCandidates, normalise } from "./_selector.js";          // NEW
import { recentMeetings, firefliesConfigured } from "./_fireflies.js";  // NEW

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
      // NEW. Was missing entirely, which is why the clip desk had no memory
      // and returned the same six clips every day.
      exclude: Array.isArray(body.exclude) ? body.exclude.slice(0, 600).map(String) : [],
      // THE CAST. correspondent is the locked character block from the state
      // register. It is the one field that must never be model-generated, so it
      // is passed through verbatim rather than reconstructed. material is the
      // editor's reading; priorArt is what the network already published, which
      // is what stops a correspondent restating a thread it already ran.
      correspondent:
        body.correspondent && typeof body.correspondent === "object" ? body.correspondent : null,
      material: typeof body.material === "string" ? body.material.slice(0, 20000) : "",
      priorArt: typeof body.priorArt === "string" ? body.priorArt.slice(0, 8000) : "",
      dateStr: new Date().toDateString(),
    };
    if (body.op === "generate" && !["post", "script", "substack", "ideas", "sponsor", "foundrae"].includes(args.kind)) {
      throw new Error("Unknown generator");
    }

    // A cast run without a full correspondent block produces a script in a
    // generic presenter voice. It reads plausibly, fails the canon gate later,
    // and by then a person has spent time on it. Fail here, where it is free.
    if (body.op === "cast") {
      const c = args.correspondent;
      const missing = ["name", "voice", "stance", "refuse", "signoff"].filter((k) => !c || !c[k]);
      if (missing.length) {
        throw new Error(`cast needs a full correspondent block. Missing: ${missing.join(", ")}.`);
      }
      if (!args.material.trim()) throw new Error("cast needs material. Nothing to read.");
    }

    // Guardrail 4, enforced in code rather than trusted to a prompt.
    // Client material must never become public video metadata.
    if (body.op === "metadata" || body.op === "selection") {
      const hits = containsClientMaterial(args.draft);
      if (hits.length) {
        // The matcher cannot tell Phoebe Buffay from Phoebe Johnson. Rather
        // than teach it to guess, a person clears a specific term by saying
        // why — and that reason is recorded before anything is generated.
        const { cleared, blocked } = applyOverrides(hits, body.overrides);
        if (blocked.length) {
          const e = new Error(haltMessage(blocked));
          e.blocked = blocked;
          throw e;
        }
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

    /* ── clips ───────────────────────────────────────────────────────────
       Was: projects.slice(0, 4), then clips.slice(0, 12) per project, with
       no exclusion of anything already proposed. Four projects out of eight,
       top twelve by Opus rank, no memory — the same six clips, daily.

       Now: every project, hard-filter against `exclude`, then rotate across
       themes. The model never sees a clip it isn't allowed to pick, because
       a filter cannot forget and a prompt can.

       The `library` shape is preserved exactly so _prompts.js is untouched.
       ─────────────────────────────────────────────────────────────────── */
    if (body.op === "clips") {
      const projects = await listProjects();
      if (!projects.length) {
        throw new Error("Opus returned no projects. Check /api/opus-test for the exact status.");
      }

      const used = new Set(args.exclude);
      const pool = [];
      const errors = [];

      for (const p of projects) {
        try {
          // Opus allows 30 requests a minute. Pacing a nine-project read to
          // about two seconds keeps a pull well clear of the ceiling.
          await new Promise((r) => setTimeout(r, 250));
          const clips = await listClips(p.projectId);
          for (const c of clips) {
            if (!c.curationId || used.has(String(c.curationId))) continue;
            pool.push(normalise(c, p));
          }
        } catch (e) {
          errors.push({ projectId: p.projectId, title: p.title, error: String(e.message) });
        }
      }

      if (!pool.length) {
        throw new Error(
          errors.length
            ? `No clips available. ${errors[0].error}`
            : "Every clip in the library has already been proposed. Clear clips-seen to start again."
        );
      }

      const wanted = Math.min(Math.max(parseInt(args.extra, 10) || 12, 1), 24);
      const { candidates, diagnostics } = selectCandidates(pool, { count: wanted });

      // Regroup into the shape _prompts.js already expects.
      const byProject = new Map();
      for (const c of candidates) {
        if (!byProject.has(c.projectId)) {
          byProject.set(c.projectId, { projectId: c.projectId, title: c.projectTitle, clips: [] });
        }
        byProject.get(c.projectId).clips.push({
          clipId: c.clipId,
          rank: c.rank,
          score: c.score,
          hookScore: c.hookScore,
          seconds: c.seconds,
          opusTitle: c.opusTitle,
          transcript: c.transcript,
        });
      }

      args.data = { library: [...byProject.values(), ...errors], diagnostics };
    }

    /* ── commitments ─────────────────────────────────────────────────────
       Yesterday's meetings, flattened into actionables. 36 hours so a Monday
       morning still catches Friday afternoon.
       Requires a `commitments` entry in OPS — see the note below.
       ─────────────────────────────────────────────────────────────────── */
    if (body.op === "commitments") {
      if (!firefliesConfigured()) throw new Error("FIREFLIES_API_KEY is not set on this site.");
      const meetings = await recentMeetings(36);
      if (!meetings.length) throw new Error("No meetings in the last 36 hours.");
      args.data = { meetings };
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
    await finish(id, {
      status: "error",
      error: String(e.message || e).slice(0, 400),
      // Present only on a confidentiality halt, so the UI can offer a reason
      // field per term rather than a dead end.
      blocked: e.blocked || null,
    });
  }

  return json({ accepted: true });
};
