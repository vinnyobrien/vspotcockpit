/**
 * The metadata contract, embedded rather than fetched.
 *
 * The original script pulled these from raw.githubusercontent.com. Every one
 * of those URLs 404s, so loadSkills() would throw and guardrail 5 would halt
 * the desk on every run, forever. Embedding removes the network dependency
 * entirely: a contract that lives /**
 * The metadata contract, embedded rather than fetched.
 *
 * The original script pulled these from raw.githubusercontent.com. Every one
 * of those URLs 404s, so loadSkills() would throw and guardrail 5 would halt
 * the desk on every run, forever. Embedding removes the network dependency
 * entirely: a contract that lives beside the code cannot fail to load.
 */

export const METADATA_CONTRACT = `
V SPOT VIDEO METADATA CONTRACT

THE PREMISE
Descriptions are retrieval surface, not keyword real estate. A model answering
"what does Rick Watson think about marketplace margin" reads the description and
transcript, it does not watch. Write the description as if the reader will never
watch the video. If it only works as an advertisement for the video, rewrite it.

TITLES — three variants, always.
- 8 to 12 words, active voice, no question marks.
- First four words carry it, mobile truncates the rest.
- claim: states the argument. "Nordstrom's marketplace pivot is a margin story"
- tension: names the disagreement. "Rick and Jess disagree on who pays for returns"
- named: leads with the entity people search. "Shopify, Global-e, and the duty problem nobody priced"
BANNED: colons as a crutch, "Everything you need to know", "The truth about",
numbers as bait, and anything on the voice banned list.

HOOK — first 150 characters, all that shows before "more".
State the conclusion. Never tease.

CLAIM BLOCK — two to four claims. This is the retrieval layer.
Each claim must survive being quoted with zero context, name who said it, carry a
timestamp, and state a position rather than a topic.
WRONG: "The panel discussed returns policy."
RIGHT: "Jess Lesesky argues free returns are a customer-acquisition cost brands
have stopped accounting for (14:20)."
If the episode contains an Ireland/EU versus US/UK divergence, it goes in the
claim block. That divergence is the network's differentiated retrieval surface.
No American ecommerce podcast is producing it.

CHAPTERS — first at 00:00, minimum three, at least 10 seconds each.
Label with content, not structure. "Nordstrom margin maths", never "Segment two".

ENTITIES — flat lists of people, companies, products, regions.
Any entity appearing in three or more episodes is a narrative thread whether or
not it was planned as one.

THREADS_BACK_TO — name the prior piece explicitly with a URL.
relationship is one of: develops, contradicts, revisits, resolves.
If genuinely empty, say so explicitly. A blank field is ambiguous, an explicit
empty is a decision.

PINNED COMMENT — one claim from the claim block plus one link. Never a request to
subscribe.

TAGS — ten maximum, mostly useful for misspellings and entity variants. Do not
spend editorial energy here.

CLIP CAPTIONS — per platform, from the same moment, never the same text four times.
- youtube_short: claim as title, under 60 chars, no hashtags
- linkedin: hook, insight, implication. Three short paragraphs.
- x: single claim, no thread, no thread emoji
- instagram: claim plus one line of context, hashtags at the end or not at all
The clip hook is burned-in caption text: under six words, and it must state
something rather than promise something.

BEFORE DELIVERING
- Hook states a conclusion within 150 characters
- Every claim survives being quoted with no context
- Every claim names a speaker and a timestamp
- Cross-Atlantic divergence surfaced if present
- threads_back_to populated or explicitly confirmed empty
- Three title variants, none opening with a question
- Clip captions differ per platform
- Nothing summarises, everything implies forward
`;

export const SELECTION_CONTRACT = `
CLIP SELECTION

Opus reliably finds a moment. It does not know which moments carry a recurring
thesis. Treat its virality scores as a shortlist, never a verdict.

Score every candidate on:
1. Does it state a position, or merely describe a topic?
2. Does it stand alone without the surrounding twenty minutes?
3. Does it develop, contradict, revisit or resolve a prior V Spot argument?
4. Is there an Ireland/EU versus US/UK divergence in it?
   WEIGHT THIS HEAVILY. It is the network's differentiated surface.

Rank, keep six, discard the rest without ceremony.
Where a clip is cut two seconds before the punchline, say so and give the
corrected boundary.
`;

/** Guardrails that outrank throughput. Checked in code, not just in prose. */
export const CLIENT_TERMS = [
  "foundrae", "power cloud", "powercloud", "phoebe", "netsuite",
  "celigo", "taylor carr",
];

export const containsClientMaterial = (text = "") => {
  const t = String(text).toLowerCase();
  return CLIENT_TERMS.filter((term) => t.includes(term));
};

/**
 * Overrides.
 *
 * The matcher cannot tell Phoebe Buffay from Phoebe Johnson, and it should not
 * try — a guardrail that guesses is worse than one that stops. So the escape
 * hatch is a human saying why, per term, with the reason recorded.
 *
 * Three rules, all deliberate:
 *
 *   1. PER TERM. Clearing "phoebe" must not also clear "foundrae" appearing
 *      later in the same transcript. Each term is its own decision.
 *   2. A REASON IS REQUIRED, and it has to be a sentence rather than a
 *      keystroke. An override you can click through without thinking is just
 *      a slower halt.
 *   3. IT IS LOGGED. If a client name ever does reach public metadata, there
 *      has to be a record of who waved it through and what they said.
 *
 * @param {string[]} hits      terms found by containsClientMaterial
 * @param {object[]} overrides [{ term, reason }]
 * @returns {{ cleared: object[], blocked: string[] }}
 */
export function applyOverrides(hits = [], overrides = []) {
  const byTerm = new Map();
  for (const o of Array.isArray(overrides) ? overrides : []) {
    const term = String(o?.term || "").toLowerCase().trim();
    const reason = String(o?.reason || "").trim();
    // Twelve characters is roughly "not a client" — enough to require a
    // thought, short enough not to be a chore.
    if (term && reason.length >= 12) byTerm.set(term, reason.slice(0, 300));
  }

  const cleared = [];
  const blocked = [];
  for (const hit of hits) {
    const reason = byTerm.get(String(hit).toLowerCase());
    if (reason) cleared.push({ term: hit, reason });
    else blocked.push(hit);
  }
  return { cleared, blocked };
}

/** The halt message, written to be acted on rather than merely read. */
export function haltMessage(blocked) {
  const list = blocked.join(", ");
  return `Halted. The source mentions ${list}. Client confidentiality outranks throughput, so nothing was generated. If ${blocked.length > 1 ? "these are" : "this is"} not a client reference, say why and it will proceed. Otherwise remove the reference or clip around it.`;
}
beside the code cannot fail to load.
 */

export const METADATA_CONTRACT = `
V SPOT VIDEO METADATA CONTRACT

THE PREMISE
Descriptions are retrieval surface, not keyword real estate. A model answering
"what does Rick Watson think about marketplace margin" reads the description and
transcript, it does not watch. Write the description as if the reader will never
watch the video. If it only works as an advertisement for the video, rewrite it.

TITLES — three variants, always.
- 8 to 12 words, active voice, no question marks.
- First four words carry it, mobile truncates the rest.
- claim: states the argument. "Nordstrom's marketplace pivot is a margin story"
- tension: names the disagreement. "Rick and Jess disagree on who pays for returns"
- named: leads with the entity people search. "Shopify, Global-e, and the duty problem nobody priced"
BANNED: colons as a crutch, "Everything you need to know", "The truth about",
numbers as bait, and anything on the voice banned list.

HOOK — first 150 characters, all that shows before "more".
State the conclusion. Never tease.

CLAIM BLOCK — two to four claims. This is the retrieval layer.
Each claim must survive being quoted with zero context, name who said it, carry a
timestamp, and state a position rather than a topic.
WRONG: "The panel discussed returns policy."
RIGHT: "Jess Lesesky argues free returns are a customer-acquisition cost brands
have stopped accounting for (14:20)."
If the episode contains an Ireland/EU versus US/UK divergence, it goes in the
claim block. That divergence is the network's differentiated retrieval surface.
No American ecommerce podcast is producing it.

CHAPTERS — first at 00:00, minimum three, at least 10 seconds each.
Label with content, not structure. "Nordstrom margin maths", never "Segment two".

ENTITIES — flat lists of people, companies, products, regions.
Any entity appearing in three or more episodes is a narrative thread whether or
not it was planned as one.

THREADS_BACK_TO — name the prior piece explicitly with a URL.
relationship is one of: develops, contradicts, revisits, resolves.
If genuinely empty, say so explicitly. A blank field is ambiguous, an explicit
empty is a decision.

PINNED COMMENT — one claim from the claim block plus one link. Never a request to
subscribe.

TAGS — ten maximum, mostly useful for misspellings and entity variants. Do not
spend editorial energy here.

CLIP CAPTIONS — per platform, from the same moment, never the same text four times.
- youtube_short: claim as title, under 60 chars, no hashtags
- linkedin: hook, insight, implication. Three short paragraphs.
- x: single claim, no thread, no thread emoji
- instagram: claim plus one line of context, hashtags at the end or not at all
The clip hook is burned-in caption text: under six words, and it must state
something rather than promise something.

BEFORE DELIVERING
- Hook states a conclusion within 150 characters
- Every claim survives being quoted with no context
- Every claim names a speaker and a timestamp
- Cross-Atlantic divergence surfaced if present
- threads_back_to populated or explicitly confirmed empty
- Three title variants, none opening with a question
- Clip captions differ per platform
- Nothing summarises, everything implies forward
`;

export const SELECTION_CONTRACT = `
CLIP SELECTION

Opus reliably finds a moment. It does not know which moments carry a recurring
thesis. Treat its virality scores as a shortlist, never a verdict.

Score every candidate on:
1. Does it state a position, or merely describe a topic?
2. Does it stand alone without the surrounding twenty minutes?
3. Does it develop, contradict, revisit or resolve a prior V Spot argument?
4. Is there an Ireland/EU versus US/UK divergence in it?
   WEIGHT THIS HEAVILY. It is the network's differentiated surface.

Rank, keep six, discard the rest without ceremony.
Where a clip is cut two seconds before the punchline, say so and give the
corrected boundary.
`;

/** Guardrails that outrank throughput. Checked in code, not just in prose. */
export const CLIENT_TERMS = [
  "foundrae", "power cloud", "powercloud", "phoebe", "netsuite",
  "celigo", "taylor carr",
];

export const containsClientMaterial = (text = "") => {
  const t = String(text).toLowerCase();
  return CLIENT_TERMS.filter((term) => t.includes(term));
};

/**
 * Overrides.
 *
 * The matcher cannot tell Phoebe Buffay from Phoebe Johnson, and it should not
 * try — a guardrail that guesses is worse than one that stops. So the escape
 * hatch is a human saying why, per term, with the reason recorded.
 *
 * Three rules, all deliberate:
 *
 *   1. PER TERM. Clearing "phoebe" must not also clear "foundrae" appearing
 *      later in the same transcript. Each term is its own decision.
 *   2. A REASON IS REQUIRED, and it has to be a sentence rather than a
 *      keystroke. An override you can click through without thinking is just
 *      a slower halt.
 *   3. IT IS LOGGED. If a client name ever does reach public metadata, there
 *      has to be a record of who waved it through and what they said.
 *
 * @param {string[]} hits      terms found by containsClientMaterial
 * @param {object[]} overrides [{ term, reason }]
 * @returns {{ cleared: object[], blocked: string[] }}
 */
export function applyOverrides(hits = [], overrides = []) {
  const byTerm = new Map();
  for (const o of Array.isArray(overrides) ? overrides : []) {
    const term = String(o?.term || "").toLowerCase().trim();
    const reason = String(o?.reason || "").trim();
    // Twelve characters is roughly "not a client" — enough to require a
    // thought, short enough not to be a chore.
    if (term && reason.length >= 12) byTerm.set(term, reason.slice(0, 300));
  }

  const cleared = [];
  const blocked = [];
  for (const hit of hits) {
    const reason = byTerm.get(String(hit).toLowerCase());
    if (reason) cleared.push({ term: hit, reason });
    else blocked.push(hit);
  }
  return { cleared, blocked };
}

/** The halt message, written to be acted on rather than merely read. */
export function haltMessage(blocked) {
  const list = blocked.join(", ");
  return `Halted. The source mentions ${list}. Client confidentiality outranks throughput, so nothing was generated. If ${blocked.length > 1 ? "these are" : "this is"} not a client reference, say why and it will proceed. Otherwise remove the reference or clip around it.`;
}
