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
  perProjectCap: 3,
  duplicateSimilarity: 0.72,
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
  ["debate",      ["disagree", "counterargument", "controversial", "the problem with", "not convinced", "wrong about", "challenge", "myth"]],
  ["practical",   ["how to", "three things", "first step", "lesson learned", "mistake", "advice", "recommend", "what worked", "what failed"]],
  ["future",      ["next five years", "future of", "what happens next", "prediction", "emerging", "opportunity", "threat", "change is coming"]],
  ["human",       ["personal story", "family", "struggle", "failure", "regret", "surprised", "laughed", "funny", "embarrassing"]],
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
function words(c) {
  return new Set(String(c.transcript || "").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w.length>3));
}
function similar(a,b) {
  if (a.clipId === b.clipId && a.projectId === b.projectId) return true;
  // Similar transcripts from the SAME source are likely overlapping Opus edits.
  if (a.projectId !== b.projectId) return false;
  const x=words(a),y=words(b);
  if (x.size < 6 || y.size < 6) return false;
  let common=0; for(const w of x) if(y.has(w)) common++;
  return common/Math.min(x.size,y.size) >= DEFAULTS.duplicateSimilarity;
}
function spread(buckets, o, offset, count, exclude, already=[]) {
  const order=[...buckets.keys()].sort();
  if(!order.length)return [];
  const rotated=[...order.slice(offset%order.length),...order.slice(0,offset%order.length)];
  const picked=[], seen=new Set(exclude), projectCounts=new Map();
  for(const c of already) projectCounts.set(c.projectId,(projectCounts.get(c.projectId)||0)+1);
  // Traverse every bucket, rather than wrapping to its first item repeatedly.
  let progress=true;
  const indices=new Map(rotated.map(t=>[t,0]));
  while(progress && picked.length<count) {
    progress=false;
    for(const t of rotated) {
      if(picked.length>=count)break;
      const bucket=buckets.get(t)||[];
      if(!bucket.length)continue;
      let index=indices.get(t);
      while(index<bucket.length) {
        const c=bucket[(index+offset)%bucket.length]; index++;
        if(seen.has(c.clipId)||projectCounts.get(c.projectId)>=o.perProjectCap||[...already,...picked].some(p=>similar(c,p)))continue;
        picked.push(c);seen.add(c.clipId);projectCounts.set(c.projectId,(projectCounts.get(c.projectId)||0)+1);progress=true;break;
      }
      indices.set(t,index);
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
  const tier2 = spread(bucketise([...overflow, ...wider]), o, offset + 3, o.tier2Count, taken, tier1);

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
      diversityPolicy: "Project cap, transcript overlap suppression, rotating themes",
      missingJudgeScores: shaped.filter((c) => c.hookScore == null).length,
    },
  };
}
