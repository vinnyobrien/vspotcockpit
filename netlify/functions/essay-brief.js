import { requireAuth, json } from "./_auth.js";
import { readJSON } from "./_blobs.js";

/**
 * /api/essay-brief?thread=<slug>  or  ?q=<terms>
 *
 * Assembles a grounded brief for a new piece BEFORE the model is called.
 * Deterministic: no model call, no scoring by vibes. SubEditor.jsx is the
 * shape being copied — checks, weights, severity flags, nothing generative.
 *
 * The Essay room should call this first, then pass `brief` into the existing
 * `essay` op in _prompts.js. Grounding the prompt in what has already been
 * written is the whole point; without it the model reinvents arguments that
 * ran in 2019.
 *
 * Returns:
 *   thread      counts by year, last published, staleness in days
 *   priors      up to 6 prior pieces, newest first, with URLs for callbacks
 *   warnings    reissue clusters, backdated pieces, saturation, silence
 *   conceits    formats already spent, so a sixth annual does not repeat one
 *   voice       the measured targets a draft is held to
 */

const SLUG = /^[a-z0-9-]{1,90}$/;

// Editorial constants. These are judgement, not measurement, so they live here
// in the open rather than being inferred from counts.
const CONCEITS_SPENT = [
  { conceit: "Christmas songs", piece: "2023 A year in Christmas Songs", year: 2023 },
  { conceit: "airline safety announcement, two-class cabin", piece: "First class used to be just a better meal", year: 2023 },
  { conceit: "90s film quotes", piece: "2024 stick a fork in yourself, you're done", year: 2024 },
  { conceit: "10 Things I Hate About You", piece: "10 Things I Hate About You: A love letter to ecomm and retail", year: 2024 },
  { conceit: "gaslighting", piece: "2025 Gaslit everyone", year: 2025 },
];

const RUNNING_FORMATS = [
  "Numbered Watson Weekend episode wrap (guest framing, What We Learned, Thinking about me thinking about you, From the Backlot, next week, credits, sponsor)",
  "Struggle Bus guest write-up (bio, what we learned, producers' reflection, historical digression, sponsors)",
  "Behind the Music special (one retailer as a music documentary)",
  "Le Sunday Supplement (three papers, full credit, chapter timestamps, recommend don't summarise)",
  "ALREADY FILMED (Silicon Valley as documentary delivered early)",
  "Book-as-frame (Kevin Kelly, Tim Marshall, Naomi Klein, Bill Bryson)",
  "Film or song title carrying the whole piece",
];

// Measured from the corpus. The 2022-2024 window is the punctuation model
// because it is the only period where the no-em-dash rule nearly held.
const VOICE_TARGETS = {
  sentenceVariation: 0.78,
  meanSentenceWords: 15.2,
  medianSentenceWords: 13,
  shortSentencePct: 18.8,
  emDashesPer10k: { target: 6.7, current: 18.1, note: "2022-2024 is the model. Current work runs nearly 3x that." },
  enDashesPer10k: { target: 7.6, current: 11.8 },
  rules: [
    "No em-dashes.",
    "Conclusions first.",
    "UK and Irish spelling.",
    "No corporate jargon.",
    "Pop culture in the structure, not sprinkled through the body.",
  ],
};

const STALE_DAYS = 180;
const SATURATED = 12; // pieces on one thread in a rolling year

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const thread = (url.searchParams.get("thread") || "").trim();
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  if (thread && !SLUG.test(thread)) return json({ error: "Bad request" }, 400);
  if (!thread && q.length < 3) return json({ error: "Give a thread or a query" }, 400);

  const [index, map] = await Promise.all([
    readJSON("cockpit", "linkedin:index", []),
    readJSON("cockpit", "linkedin:map", null),
  ]);
  if (!index.length) return json({ error: "Archive not seeded" }, 503);

  // Candidate set. Thread filter is exact; query matches title and excerpt only,
  // deliberately, so this stays off the 1.6 MB full key.
  let pool = index;
  if (thread) pool = pool.filter((p) => (p.threads || []).includes(thread));
  if (q) {
    pool = pool.filter(
      (p) =>
        String(p.title).toLowerCase().includes(q) ||
        String(p.excerpt || "").toLowerCase().includes(q)
    );
  }
  pool = pool.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const canonical = pool.filter((p) => !p.republishOf);
  const last = canonical[0] || null;
  const staleDays = last
    ? Math.round((Date.now() - new Date(last.date).getTime()) / 86400000)
    : null;

  const byYear = {};
  for (const p of canonical) byYear[p.year] = (byYear[p.year] || 0) + 1;

  const thisYear = new Date().getFullYear();
  const warnings = [];

  if (!canonical.length) {
    warnings.push({
      severity: "high",
      code: "no-priors",
      message: "Nothing in the LinkedIn archive matches. Check the Substack archive before assuming this is new ground.",
    });
  }
  if (staleDays !== null && staleDays > STALE_DAYS) {
    warnings.push({
      severity: "info",
      code: "stale",
      message: `Last piece here was ${staleDays} days ago. A revisit rather than a new argument may be the stronger move.`,
    });
  }
  if ((byYear[thisYear] || 0) >= SATURATED) {
    warnings.push({
      severity: "medium",
      code: "saturated",
      message: `${byYear[thisYear]} pieces already this year on this thread. Diminishing returns; consider an adjacent angle.`,
    });
  }
  for (const p of pool) {
    if (p.republishOf) {
      warnings.push({
        severity: "high",
        code: "reissue-in-set",
        message: `"${p.title}" (${String(p.date).slice(0, 10)}) is a reissue of an earlier piece. Do not cite its date as the date of the argument.`,
      });
    }
    if ((p.lagDays || 0) > 365) {
      warnings.push({
        severity: "medium",
        code: "backdated",
        message: `"${p.title}" was written ${p.lagDays} days before it was published. Its publication date is not the date of the thinking.`,
      });
    }
  }

  const priors = canonical.slice(0, 6).map((p) => ({
    id: p.id,
    title: p.title,
    date: String(p.date).slice(0, 10),
    words: p.words,
    url: p.url,
    threads: p.threads,
    excerpt: p.excerpt,
    // Everything predates the Provenance Standard, so a callback declares this.
    provenance: p.provenance,
  }));

  return json({
    query: { thread: thread || null, q: q || null },
    thread: {
      slug: thread || null,
      canonicalPieces: canonical.length,
      byYear,
      lastPublished: last ? String(last.date).slice(0, 10) : null,
      staleDays,
      coOccursWith: map
        ? Object.entries(map.coOccurrence || {})
            .filter(([k]) => k.split("|").includes(thread))
            .slice(0, 4)
            .map(([k, n]) => ({ pair: k, n }))
        : [],
    },
    priors,
    warnings,
    conceits: { spent: CONCEITS_SPENT, runningFormats: RUNNING_FORMATS },
    voice: VOICE_TARGETS,
    brief: [
      priors.length
        ? `You have written ${canonical.length} piece(s) on this ground, most recently "${priors[0].title}" on ${priors[0].date}.`
        : "No prior LinkedIn piece matches this ground.",
      "Open with the conclusion. Do not restate the archive; extend it.",
      "Name and link any piece you call back to.",
      "No em-dashes. UK and Irish spelling.",
    ].join(" "),
  });
};
