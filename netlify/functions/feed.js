import { requireAuth, json } from "./_auth.js";

/**
 * GET /api/feed?url=…  → parsed podcast feed.
 *
 * Server side because the browser cannot reach anchor.fm at all — the CSP is
 * `connect-src 'self'`, so any client-side fetch is blocked outright. This is
 * also why a missing function shows up as "Unexpected token '<'": the request
 * falls through to the SPA redirect and the app returns index.html.
 *
 * No XML library. A podcast feed is regular enough that a parser built for it
 * beats a general one that then needs bundling.
 */

const MAX_BYTES = 4_000_000;
const MAX_ITEMS = 100;

/** Feeds are riddled with entities. These five cover essentially all of it. */
const decode = (s) =>
  String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")          // last, or it double-decodes
    .trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
};

const attr = (block, name, key) => {
  const m = block.match(new RegExp(`<${name}\\b[^>]*\\b${key}=["']([^"']+)["']`, "i"));
  return m ? decode(m[1]) : "";
};

const strip = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** RSS uses pubDate, Atom uses published or updated. Normalise to YYYY-MM-DD. */
function isoDate(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;

  const raw = new URL(req.url).searchParams.get("url") || "";
  let target;
  try {
    target = new URL(raw);
  } catch {
    return json({ error: "That is not a URL. Paste the RSS feed address." }, 400);
  }
  if (!["http:", "https:"].includes(target.protocol)) {
    return json({ error: "Only http and https feeds are supported." }, 400);
  }

  let res, xml;
  try {
    res = await fetch(target.toString(), {
      redirect: "follow",
      headers: { "user-agent": "TheCockpit/1.0 (+https://vspotcockpit.netlify.app)", accept: "application/rss+xml, application/xml, text/xml, */*" },
    });
    xml = (await res.text()).slice(0, MAX_BYTES);
  } catch (e) {
    return json({ error: `Could not reach that feed: ${e.message}` }, 502);
  }

  if (!res.ok) {
    return json({ error: `The feed returned ${res.status}. Check the URL is the RSS address rather than the show page.` }, 502);
  }

  // A show page rather than a feed is the most common mistake by a distance.
  if (!/<rss|<feed|<channel/i.test(xml)) {
    return json({
      error: "That URL returned a web page, not a feed. The RSS address is usually on the hosting dashboard rather than the public page.",
    }, 422);
  }

  const channel = xml.match(/<channel[\s\S]*?>([\s\S]*)<\/channel>/i)?.[1] || xml;

  const blocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi),
  ].slice(0, MAX_ITEMS);

  const items = blocks.map(([, b]) => {
    const description = tag(b, "description") || tag(b, "content:encoded") || tag(b, "summary") || tag(b, "content");
    const link = tag(b, "link") || attr(b, "link", "href") || attr(b, "enclosure", "url");
    const duration = tag(b, "itunes:duration");
    return {
      title: tag(b, "title") || "Untitled",
      date: isoDate(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated")),
      link,
      guid: tag(b, "guid") || tag(b, "id") || link,
      duration: duration || null,
      episode: tag(b, "itunes:episode") || null,
      season: tag(b, "itunes:season") || null,
      audio: attr(b, "enclosure", "url") || null,
      summary: strip(description).slice(0, 600),
    };
  });

  if (!items.length) {
    return json({ error: "The feed parsed but had no episodes in it." }, 422);
  }

  return json({
    show: {
      title: tag(channel, "title"),
      description: strip(tag(channel, "description")).slice(0, 400),
      link: tag(channel, "link"),
      image: attr(channel, "itunes:image", "href") || tag(channel, "url"),
    },
    count: items.length,
    items,
  });
};
