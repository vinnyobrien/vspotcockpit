/**
 * clip-selector.js — The Cockpit
 *
 * Deterministic candidate selection for the shorts desk.
 *
 * The rule this module exists to enforce: the model never sees a clip it is
 * not allowed to pick. Exclusion is a filter, not a request. Anything the
 * model is merely *asked* to avoid, it will eventually pick again, because
 * high-scoring clips are a gravity well.
 *
 * Pipeline:
 *   listAllClips()  -> every clip across every project, paginated properly
 *   selectCandidates() -> hard filter, theme-bucket, round-robin
 *   -> hand the survivors to the model for copy/ordering only
 */

export const DEFAULTS = {
  count: 12,        // was 6
  minScore: 75,     // was ~94 in effect
  minSeconds: 12,
  maxSeconds: 90,
  perThemeCap: 2,   // stops four networking clips shipping in one day
};

/**
 * Theme buckets. Order matters only for tie-breaks.
 * Matched against title + description + hashtags, lowercased.
 */
const THEMES = [
  ['heritage',   ['heritage', 'history', 'years', 'founded', 'factory', 'manufactur', 'craft', 'made in', 'buyout', 'family']],
  ['product',    ['gore-tex', 'goretex', 'boot', 'jacket', 'waterproof', 'footwear', 'apparel', 'material', 'quality control']],
  ['channel',    ['retail', 'pop-up', 'popup', 'wholesale', 'third-party', 'stockist', 'omni', 'store', 'footprint']],
  ['crossborder',['uk ', 'ireland', 'irish', 'international', 'export', 'global', 'market by market', 'cross-border', 'eu ']],
  ['tech',       ['ai', 'platform', 'replatform', 're-platform', 'seo', 'deo', 'integration', 'ux', 'data', 'tech']],
  ['craftwork',  ['career', 'junior', 'senior', 'hiring', 'hire', 'skills', 'leadership', 'manage', 'team', 'listening']],
  ['events',     ['event', 'network', 'conference', 'badminton', 'burghley', 'eventing', 'sailing', 'race', 'ocean race']],
  ['strategy',   ['growth', 'margin', 'strategy', 'contract', 'sales', 'profit', 'cost', 'disappoint', 'weather']],
];

export function themeOf(clip) {
  const hay = [
    clip.title || '',
    clip.description || '',
    (clip.hashtags || []).join(' '),
  ].join(' ').toLowerCase();

  for (const [name, keys] of THEMES) {
    if (keys.some((k) => hay.includes(k))) return name;
  }
  return 'general';
}

/**
 * Social ranking is not OpusClip's composite score.
 *
 * The composite blends coherence and trend, which reward a tidy, generic clip.
 * The first 1.5 seconds decide whether anyone watches, so hook leads. The
 * composite only breaks ties.
 */
export function rankKey(clip) {
  const hook = clip.hook_score ?? 0;
  const connection = clip.connection_score ?? 0;
  const score = clip.score ?? 0;
  return hook * 10000 + connection * 100 + score;
}

/**
 * Pull every clip from every project.
 *
 * list_projects defaults to pageSize 20 and WILL silently truncate as the
 * library grows. Paginate explicitly. list_clips is not paginated — one call
 * returns the full set for a project.
 */
export async function listAllClips(opus) {
  const projects = [];
  for (let page = 0; ; page++) {
    const res = await opus.listProjects({ page, pageSize: 100 });
    const batch = res.projects || [];
    projects.push(...batch.filter((p) => !p.is_deleted && p.stage === 'COMPLETE'));
    if (projects.length >= (res.total ?? 0) || batch.length === 0) break;
  }

  const all = [];
  for (const p of projects) {
    const res = await opus.listClips({ projectId: p.project_id });
    for (const c of res.clips || []) {
      all.push({
        ...c,
        project_title: p.title,
        project_created_at: p.created_at,
      });
    }
  }
  return all;
}

/**
 * The actual selection.
 *
 * @param {Array}  allClips  every clip in the library
 * @param {Object} opts
 * @param {Array}  opts.seen  clipIds already proposed or published — HARD excluded
 * @returns {{ candidates: Array, diagnostics: Object }}
 */
export function selectCandidates(allClips, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const seen = new Set(opts.seen || []);

  // --- Stage 1: hard filters. Nothing past here is negotiable. -------------
  let pool = allClips.filter((c) => {
    if (seen.has(c.clip_id)) return false;
    if ((c.score ?? 0) < o.minScore) return false;
    const d = c.duration_sec ?? 0;
    if (d < o.minSeconds || d > o.maxSeconds) return false;
    return true;
  });

  pool = pool.map((c) => ({ ...c, __fresh: true, __seenIdx: -1 }));
  const exhausted = pool.length < o.count;

  // --- Stage 2: recycle only if genuinely out of fresh material ------------
  // Tagged, not merely appended. Without the tag the bucket re-sort below
  // ranks recycled clips on score alone and hands back yesterday's list.
  // A recycled clip must never outrank a fresh one, and among recycled the
  // oldest wins — a repeat you have forgotten beats a repeat you remember.
  if (exhausted) {
    const seenOrder = opts.seen || [];
    const recycled = allClips
      .filter((c) => seen.has(c.clip_id) && (c.score ?? 0) >= o.minScore)
      .map((c) => ({ ...c, __fresh: false, __seenIdx: seenOrder.indexOf(c.clip_id) }));
    pool = [...pool, ...recycled];
  }

  // --- Stage 3: bucket by theme -------------------------------------------
  const buckets = new Map();
  for (const c of pool) {
    const t = themeOf(c);
    if (!buckets.has(t)) buckets.set(t, []);
    buckets.get(t).push(c);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => {
      if (a.__fresh !== b.__fresh) return a.__fresh ? -1 : 1;   // fresh always first
      if (!a.__fresh) return a.__seenIdx - b.__seenIdx;          // then oldest-seen
      return rankKey(b) - rankKey(a);
    });
  }

  // --- Stage 4: round-robin across themes, best-of-bucket first ------------
  // Straight rank order gives you three versions of one thought per week.
  // Rotating the bucket order by day-of-year stops Monday always being heritage.
  const order = [...buckets.keys()].sort();
  const shift = dayOfYear(opts.today || new Date()) % Math.max(order.length, 1);
  const rotated = [...order.slice(shift), ...order.slice(0, shift)];

  const picked = [];
  const takenPerTheme = new Map();
  let round = 0;
  while (picked.length < o.count && round < 20) {
    let progressed = false;
    for (const t of rotated) {
      if (picked.length >= o.count) break;
      const bucket = buckets.get(t) || [];
      const taken = takenPerTheme.get(t) || 0;
      if (taken >= o.perThemeCap || taken >= bucket.length) continue;
      picked.push(bucket[taken]);
      takenPerTheme.set(t, taken + 1);
      progressed = true;
    }
    if (!progressed) break;
    round++;
  }

  // Backfill on pure rank if the theme caps left us short.
  if (picked.length < o.count) {
    const have = new Set(picked.map((c) => c.clip_id));
    const rest = pool
      .filter((c) => !have.has(c.clip_id))
      .sort((a, b) => {
        if (a.__fresh !== b.__fresh) return a.__fresh ? -1 : 1;
        if (!a.__fresh) return a.__seenIdx - b.__seenIdx;
        return rankKey(b) - rankKey(a);
      });
    picked.push(...rest.slice(0, o.count - picked.length));
  }

  return {
    candidates: picked,
    diagnostics: {
      libraryTotal: allClips.length,
      afterHardFilters: pool.length,
      seenCount: seen.size,
      themesAvailable: [...buckets.keys()],
      themesUsed: [...takenPerTheme.keys()],
      recycled: exhausted,
      returned: picked.length,
    },
  };
}

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}
