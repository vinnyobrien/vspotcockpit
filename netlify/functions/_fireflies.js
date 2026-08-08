/**
 * netlify/functions/_fireflies.js
 *
 * Reads meeting transcripts and their action items. Helper only — no HTTP
 * route. Imported by claude-background for the `commitments` op.
 *
 * Needs FIREFLIES_API_KEY on the site. Get it from Fireflies → Settings →
 * Developer Settings.
 *
 * NOTE: field names below follow Fireflies' documented GraphQL schema. They
 * have not been run against a live key — verify `summary.action_items` and
 * `summary.overview` on first use, and adjust here rather than downstream.
 */

const ENDPOINT = "https://api.fireflies.ai/graphql";

const key = () => (process.env.FIREFLIES_API_KEY || "").trim().replace(/^["']|["']$/g, "");

export const firefliesConfigured = () => Boolean(key());

async function gql(query, variables = {}) {
  const k = key();
  if (!k) throw new Error("FIREFLIES_API_KEY is not set on this site.");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }

  if (!res.ok) {
    const hint =
      res.status === 401 ? "Fireflies rejected the key."
      : res.status === 429 ? "Fireflies rate limited."
      : `Fireflies returned ${res.status}.`;
    throw new Error(`${hint} ${JSON.stringify(body).slice(0, 200)}`.trim());
  }
  if (body.errors?.length) throw new Error(`Fireflies: ${body.errors[0].message}`.slice(0, 250));
  return body.data;
}

const TRANSCRIPTS = `
  query Recent($fromDate: DateTime, $toDate: DateTime) {
    transcripts(fromDate: $fromDate, toDate: $toDate, limit: 25) {
      id
      title
      date
      duration
      transcript_url
      participants
      summary {
        overview
        action_items
        keywords
      }
    }
  }
`;

/** Action items arrive as one string with newline bullets, or as an array. */
function splitActions(raw) {
  if (Array.isArray(raw)) return raw.map(String);
  return String(raw || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s*\-•\d.)]+/, "").trim())
    .filter((l) => l.length > 3);
}

/**
 * Meetings from the last `hours`, flattened into actionables.
 * Default 36 hours so a Monday morning still catches Friday afternoon.
 */
export async function recentMeetings(hours = 36) {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 3600000);

  const data = await gql(TRANSCRIPTS, {
    fromDate: from.toISOString(),
    toDate: to.toISOString(),
  });

  return (data?.transcripts || []).map((t) => ({
    id: t.id,
    title: String(t.title || "Untitled").slice(0, 140),
    date: t.date,
    minutes: t.duration ? Math.round(t.duration / 60) : null,
    url: t.transcript_url || null,
    participants: (t.participants || []).slice(0, 12),
    overview: String(t.summary?.overview || "").slice(0, 1200),
    actions: splitActions(t.summary?.action_items).slice(0, 12),
    keywords: (t.summary?.keywords || []).slice(0, 10),
  }));
}
