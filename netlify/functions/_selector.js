/**
 * netlify/functions/_selector.js
 *
 * Candidate selection for the clip desk. Pure functions, no I/O — the caller
 * fetches from Opus, this decides what survives.
 *
 * Written against the real shapes in _opus.js and the mapping already in
 * claude-background.js. Field names matter here: the identifier is
 * `curationId`, NOT `id` — `id` is the composite "projectId.curationId" and
 * the posting endpoints reject it with "Clip not found".
 *
 * Raw clip from listClips():
 *   curationId          the identifier publishing wants
 *   rank, score         Opus's own ordering
 *   judgeResult.hookScore
 *   durationMs          milliseconds, not seconds
 *   title               Opus's generated title — judge on `text` instead
 *   text                the actual transcript, with __silence markers
 */

export const DEFAULTS = {
  count: 12,
  minScore: 75,
  minSeconds: 12,
  maxSeconds: 90,
  perThemeCap: 2,
};

/**
 * Themes are matched against the TRANSCRIPT, not Opus's title.
 * Opus titles are generated marketing copy and cluster on the same few
 * phrasings; the transcript is what was actually said.
 */
const THEMES = [
  ["heritage",    ["heritage", "history", "years", "founded", "factory", "manufactur", "craft", "family", "buyout", "generation"]],
  ["product",     ["gore-tex", "goretex", "boot", "jacket", "waterproof", "footwear", "apparel", "leather", "material", "quality"]],
  ["channel",     ["retail", "pop-up", "popup", "wholesale", "stockist", "omni", "store", "shop floor", "third party"]],
  ["crossborder", ["ireland", "irish", "uk ", "europe", "international", "export", "global", "cross-border", "market by market"]],
  ["tech",        ["ai ", "platform", "replatform", "seo", "integration", "data", "software", "system", "digital"]],
  ["craftwork",   ["career", "junior", "senior", "hiring", "hire", "skills", "leadership", "manage", "team", "learn"]],
  ["events",      ["event", "network", "conference", "trade show", "eventing", "sailing", "race"]],
  ["strategy",    ["margin", "growth", "strategy", "discount", "sales", "profit", "cost", "price", "weather"]],
];

const clean = (s) => String(s || "").replace(/__silence/g, " ").replace(/\s+/g, " ").trim();

export function themeOf(clip) {
  const hay = `${clean(clip.text)} ${clean(clip.title)}`.toLowerCase();
  for (const [name, keys] of THEMES) if (keys.some((k) => hay.includes(k))) return name;
  return "general";
}

/**
 * Normalise a raw Opus clip into the shape claude-background.js already sends
 * to the model. Kept identical so the prompt contract does not change.
 */
export function normalise(clip, project) {
  return {
    clipId: clip.curationId,
    projectId: project.projectId,
    projectTitle: project.title,
    rank: clip.rank,
    score: clip.score,
    hookScore: clip.judgeResult && clip.judgeResult.hookScore,
    seconds: clip.durationMs ? Math.round(clip.durationMs / 1000) : null,
    opusTitle: clip.title,
    transcript: clean(clip.text).slice(0, 500),
  };
}

/**
 * Hook leads, not the composite score.
 *
 * Opus's `score` blends coherence and trend, which reward a tidy generic clip.
 * The first seconds decide whether anyone watches. Score only breaks ties.
 */
export function rankKey(c) {
  return (c.hookScore ?? 0) * 1000 + (c.score ?? 0);
}

const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);

/**
 * @param {Array} pool  normalised clips, already excluding anything seen
 * @returns {{ candidates: Array, diagnostics: Object }}
 */
export function selectCandidates(pool, opts = {}) {
  const o = { ...DEFAULTS, ...opts };

  const eligible = pool.filter((c) => {
    if (!c.clipId) return false;                       // no curationId, cannot publish
    if ((c.score ?? 0) < o.minScore) return false;
    const s = c.seconds ?? 0;
    return s >= o.minSeconds && s <= o.maxSeconds;
  });

  const buckets = new Map();
  for (const c of eligible) {
    const t = themeOf({ text: c.transcript, title: c.opusTitle });
    if (!buckets.has(t)) buckets.set(t, []);
    buckets.get(t).push(c);
  }
  for (const list of buckets.values()) list.sort((a, b) => rankKey(b) - rankKey(a));

  // Round-robin across themes so a day's picks aren't three versions of one
  // idea. Rotating the starting bucket by day-of-year stops Monday always
  // opening on heritage.
  const order = [...buckets.keys()].sort();
  const shift = order.length ? dayOfYear(opts.today || new Date()) % order.length : 0;
  const rotated = [...order.slice(shift), ...order.slice(0, shift)];

  const picked = [];
  const taken = new Map();
  for (let round = 0; round < o.perThemeCap; round++) {
    for (const t of rotated) {
      if (picked.length >= o.count) break;
      const bucket = buckets.get(t) || [];
      const n = taken.get(t) || 0;
      if (n >= bucket.length) continue;
      picked.push(bucket[n]);
      taken.set(t, n + 1);
    }
  }

  // Backfill on rank if theme caps left us short.
  if (picked.length < o.count) {
    const have = new Set(picked.map((c) => c.clipId));
    picked.push(
      ...eligible
        .filter((c) => !have.has(c.clipId))
        .sort((a, b) => rankKey(b) - rankKey(a))
        .slice(0, o.count - picked.length)
    );
  }

  return {
    candidates: picked,
    diagnostics: {
      poolSize: pool.length,
      eligible: eligible.length,
      themes: [...buckets.keys()],
      returned: picked.length,
    },
  };
}
