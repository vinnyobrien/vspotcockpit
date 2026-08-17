/**
 * netlify/functions/_selector.js
 *
 * Candidate selection for the clip desk. Pure functions, no I/O — the caller
 * fetches from Opus, this decides what survives.
 *
 * Returns two tiers. Tier one is the day's proposal. Tier two is the wider
 * funnel: everything that clears a real editorial floor but did not make the
 * first cut. The caller can show tier two behind a "more" control without a
 * second Opus read.
 *
 * Field names matter here: the identifier is `curationId`, NOT `id` — `id` is
 * the composite "projectId.curationId" and the posting endpoints reject it
 * with "Clip not found".
 *
 * WHAT CHANGED, AND WHY
 *
 * 1. Rotation now rotates DEPTH, not just order. The previous version shifted
 *    which theme opened the round-robin, but `taken` always started at zero,
 *    so bucket[0] and bucket[1] were selected every single day. The twelve
 *    were reshuffled, never replaced. This is the whole bug.
 *
 * 2. Judge sub-scores are read defensively. The API has returned these both
 *    nested under `judgeResult` and flat as `hook_score`. When the read missed,
 *    `hookScore` fell to undefined, `rankKey` collapsed to the composite score
 *    alone, and the composite score is Opus rank in disguise — near enough one
 *    point per rank. Ranking on it reproduces Opus's own order every time.
 *
 * 3. The theme map was written for the Dubarry episode. Gore-tex, boots,
 *    sailing and leather do not appear in an AI and marketplace corpus, so
 *    those buckets sat empty and the live buckets were two or three deep.
 *    Worse, "heritage" matched on the token "years", and first-match-wins
 *    meant it hoovered up anything where someone said "a few years ago".
 *    Themes are now scored by match count, not first hit.
 */

export const DEFAULTS = {
  count: 12,          // tier one size
  tier2Count: 18,     // tier two size, deliberately larger
  minSeconds: 12,
  maxSeconds: 90,
  minScore: 60,       // safety floor only, see note on rankKey
  perThemeCap: 2,
  tier1: { minHook: 8, minCoherence: 8 },
  tier2: { minHook: 6, minCoherence: 6 },
};

/**
 * Themes are matched against the TRANSCRIPT, not Opus's title. Opus titles are
 * generated marketing copy and cluster on the same few phrasings; the
 * transcript is what was actually said.
 *
 * Keys are deliberately distinctive. Common words that appear in any business
 * conversation ("years", "team", "data", "system") are excluded — they classify
 * nothing and they starve every other bucket.
 */
const THEMES = [
  ["ai",          ["llm", "large language", "chatgpt", "openai", "anthropic", "claude", "gemini", "model", "agentic", "artificial intelligence", "machine learning", "prompt"]],
  ["search",      ["seo", "organic traffic", "ai overview", "publisher", "serp", "google search", "zero click", "discoverability", "indexed"]],
  ["adtech",      ["ad spend", "google ads", "sponsored", "paid media", "roas", "cpc", "ad placement", "advertising", "attribution", "campaign"]],
  ["marketplace", ["amazon", "temu", "shein", "ebay", "etsy", "depop", "resale", "third party seller", "marketplace", "buy box"]],
  ["platform",    ["shopify", "netsuite", "replatform", "migration", "headless", "integration", "erp", "checkout", "api", "stack"]],
  ["crossborder", ["ireland", "irish", "europe", "european", "cross-border", "export", "duty", "duties", "tariff", "customs", "market by market", "us versus", "stateside"]],
  ["operations",  ["logistics", "fulfilment", "fulfillment", "warehouse", "returns", "reverse logistics", "carrier", "shipping", "inventory", "stock"]],
  ["margin",      ["margin", "discount", "profitability", "unit economics", "cash flow", "cost base", "pricing", "markdown", "gross"]],
  ["retailfloor", ["pop-up", "popup", "wholesale", "stockist", "shop floor", "brick and mortar", "physical store", "clienteling", "footfall"]],
  ["craft",       ["hiring", "junior", "career", "leadership", "founder", "burnout", "mentor", "apprentice", "imposter"]],
  ["culture",     ["curiosity", "lifelong", "hindsight", "introvert", "attention", "reflective", "slow down", "momentum", "optimism", "cynical"]],
];

const clean = (s) => String(s || "").replace(/__silence/g, " ").replace(/\s+/g, " ").trim();

/**
 * Highest match count wins, not first hit. A clip mentioning Amazon twice and
 * pricing once is a marketplace clip, regardless of THEMES ordering.
 */
export function themeOf(clip) {
  const hay = `${clean(clip.text)} ${clean(clip.title)}`.toLowerCase();
  let best = "general";
  let bestHits = 0;
  for (const [name, keys] of THEMES) {
    let hits = 0;
    for (const k of keys) if (hay.includes(k)) hits++;
    if (hits > bestHits) { best = name; bestHits = hits; }
  }
  return best;
}

/** The API has moved these around. Read every shape it has used. */
const judge = (clip, flat, nested) => {
  const j = clip.judgeResult || clip.judge_result || {};
  const v = j[nested] ?? clip[flat] ?? clip[nested];
  return typeof v === "number" ? v : null;
};

/**
 * Normalise a raw Opus clip into the shape claude-background.js already sends
 * to the model. The original four fields are unchanged so the prompt contract
 * holds; the extra sub-scores are additive.
 */
export function normalise(clip, project) {
  return {
    clipId: clip.curationId || clip.clip_id || clip.clipId,
    projectId: project.projectId || project.project_id,
    projectTitle: project.title,
    rank: clip.rank,
    score: clip.score,
    hookScore: judge(clip, "hook_score", "hookScore"),
    coherenceScore: judge(clip, "coherence_score", "coherenceScore"),
    connectionScore: judge(clip, "connection_score", "connectionScore"),
    trendScore: judge(clip, "trend_score", "trendScore"),
    seconds: clip.durationMs ? Math.round(clip.durationMs / 1000)
           : clip.duration_sec ? Math.round(clip.duration_sec)
           : null,
    opusTitle: clip.title,
    transcript: clean(clip.text).slice(0, 500),
  };
}

/**
 * Hook leads, coherence breaks the tie, composite score breaks it again.
 *
 * Deliberately NOT weighted on trendScore. Trend is Opus guessing at what the
 * algorithm rewards this week. For commentary that gets threaded across weeks
 * it is noise, and it is the field that buries genuinely strong clips: hook 9,
 * coherence 9, trend 6 lands at rank 17 and never surfaces.
 *
 * Composite `score` is used only as a final tiebreak. It moves one point per
 * rank, so on its own it just replays Opus's ordering.
 */
export function rankKey(c) {
  return (c.hookScore ?? 0) * 10000 + (c.coherenceScore ?? 0) * 100 + (c.score ?? 0) / 100;
}

const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);

const passesShape = (c, o) => {
  if (!c.clipId) return false;                        // no curationId, cannot publish
  if ((c.score ?? 0) < o.minScore) return false;
  const s = c.seconds ?? 0;
  return s >= o.minSeconds && s <= o.maxSeconds;
};

const passesGate = (c, gate) =>
  (c.hookScore ?? 0) >= gate.minHook && (c.coherenceScore ?? 0) >= gate.minCoherence;

/**
 * Round-robin across themes, offset into each bucket by the day.
 *
 * `offset` is what stops the same twelve returning. Without it the loop always
 * reads position 0 and 1 of every bucket, and the only thing that changes
 * between Monday and Tuesday is the order they appear on screen.
 */
function spread(buckets, o, offset, count, exclude) {
  const order = [...buckets.keys()].sort();
  if (!order.length) return [];

  const shift = offset % order.length;
  const rotated = [...order.slice(shift), ...order.slice(0, shift)];

  // Enough rounds to reach count even when only two or three themes are live.
  const rounds = Math.max(o.perThemeCap, Math.ceil(count / order.length));

  const picked = [];
  const seen = new Set(exclude);
  for (let round = 0; round < rounds && picked.length < count; round++) {
    for (const t of rotated) {
      if (picked.length >= count) break;
      const bucket = buckets.get(t) || [];
      if (!bucket.length) continue;
      // Wrap, so a shallow bucket still contributes and a deep one is walked
      // from a different starting point each day.
      const pick = bucket[(offset + round) % bucket.length];
      if (!pick || seen.has(pick.clipId)) continue;
      picked.push(pick);
      seen.add(pick.clipId);
    }
  }
  return picked;
}

function bucketise(clips) {
  const buckets = new Map();
  for (const c of clips) {
    const t = themeOf({ text: c.transcript, title: c.opusTitle });
    if (!buckets.has(t)) buckets.set(t, []);
    buckets.get(t).push(c);
  }
  for (const list of buckets.values()) list.sort((a, b) => rankKey(b) - rankKey(a));
  return buckets;
}

/**
 * @param {Array} pool  normalised clips, already excluding anything seen
 * @returns {{ candidates, tier1, tier2, diagnostics }}
 */
export function selectCandidates(pool, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const offset = dayOfYear(opts.today || new Date());

  const shaped = pool.filter((c) => passesShape(c, o));

  // Tier one: hook and coherence both strong. Tier two: everything else that
  // still clears a floor. A clip is never in both.
  const strong = shaped.filter((c) => passesGate(c, o.tier1));
  const wider  = shaped.filter((c) => !passesGate(c, o.tier1) && passesGate(c, o.tier2));

  const tier1 = spread(bucketise(strong), o, offset, o.count, []);

  // Anything strong that tier one did not have room for belongs at the top of
  // tier two. That is the real widening: the funnel was never short of supply,
  // it was short of reach.
  const taken = new Set(tier1.map((c) => c.clipId));
  const overflow = strong.filter((c) => !taken.has(c.clipId));
  const tier2 = spread(bucketise([...overflow, ...wider]), o, offset, o.tier2Count, taken);

  const histogram = {};
  for (const [t, list] of bucketise(shaped)) histogram[t] = list.length;

  return {
    candidates: tier1,   // unchanged contract for existing callers
    tier1,
    tier2,
    diagnostics: {
      poolSize: pool.length,
      shaped: shaped.length,
      strong: strong.length,
      wider: wider.length,
      overflow: overflow.length,
      returnedTier1: tier1.length,
      returnedTier2: tier2.length,
      offset,
      themes: histogram,
      missingJudgeScores: shaped.filter((c) => c.hookScore == null).length,
    },
  };
}
own ordering
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
