/**
 * X DESK API
 *
 * GET  /api/xdesk?date=YYYY-MM-DD        the board
 * GET  /api/xdesk?ledger=YYYY-MM         what has gone out this month
 * POST /api/xdesk  { action, ... }       build | redraft | choose | edit | approve | unapprove | feeds
 *
 * Nothing here posts to X. Approval writes to the ledger and stops.
 */

import { requireAuth, json } from "./_auth.js";
import { readJSON, writeJSON } from "./_blobs.js";
import {
  SLOTS,
  VOICES,
  KEY_FEEDS,
  KEY_LEDGER,
  DEFAULT_FEEDS,
  todayISO,
  loadDay,
  saveDay,
  buildDay,
  redraft,
  approve,
  clamp,
} from "./_xdesk.js";

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_OK = /^\d{4}-\d{2}$/;

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);

  if (req.method === "GET") {
    const month = url.searchParams.get("ledger");
    if (month) {
      if (!MONTH_OK.test(month)) return json({ error: "Bad month" }, 400);
      return json({ ledger: (await readJSON("cockpit", KEY_LEDGER(month), [])) || [] });
    }
    const date = url.searchParams.get("date") || todayISO();
    if (!DATE_OK.test(date)) return json({ error: "Bad date" }, 400);
    return json({
      day: await loadDay(date),
      slots: SLOTS.map((s) => ({ id: s.id, label: s.label, time: s.time, voice: s.voice, voiceName: VOICES[s.voice].name })),
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const date = DATE_OK.test(body.date || "") ? body.date : todayISO();
  const slotId = SLOTS.some((s) => s.id === body.slot) ? body.slot : null;

  try {
    switch (body.action) {
      case "build":
        return json({ day: await buildDay(date) });

      case "redraft": {
        if (!slotId) return json({ error: "Unknown slot" }, 400);
        const note = typeof body.note === "string" ? body.note.slice(0, 300) : "";
        return json({ day: await redraft(date, slotId, note) });
      }

      case "choose": {
        if (!slotId) return json({ error: "Unknown slot" }, 400);
        const day = await loadDay(date);
        const cell = day.slots[slotId];
        const i = Number(body.index);
        if (!cell || !cell.drafts[i]) return json({ error: "No such draft" }, 400);
        cell.chosen = i;
        cell.text = cell.drafts[i];
        cell.status = "draft";
        await saveDay(day);
        return json({ day });
      }

      case "edit": {
        if (!slotId) return json({ error: "Unknown slot" }, 400);
        const day = await loadDay(date);
        const cell = day.slots[slotId];
        if (!cell) return json({ error: "Unknown slot" }, 400);
        cell.text = clamp(body.text);
        cell.status = cell.text ? "draft" : "empty";
        await saveDay(day);
        return json({ day });
      }

      case "approve":
        if (!slotId) return json({ error: "Unknown slot" }, 400);
        return json({ day: await approve(date, slotId) });

      case "unapprove": {
        if (!slotId) return json({ error: "Unknown slot" }, 400);
        const day = await loadDay(date);
        const cell = day.slots[slotId];
        if (cell) {
          cell.status = cell.text ? "draft" : "empty";
          cell.postedAt = null;
        }
        await saveDay(day);
        return json({ day });
      }

      case "feeds": {
        if (!Array.isArray(body.feeds)) return json({ feeds: (await readJSON("cockpit", KEY_FEEDS, null)) || DEFAULT_FEEDS });
        const cleaned = body.feeds
          .filter((f) => f && typeof f.url === "string" && /^https:\/\//.test(f.url))
          .slice(0, 40)
          .map((f, i) => ({
            id: String(f.id || `feed${i}`).slice(0, 40),
            name: String(f.name || f.url).slice(0, 60),
            region: ["US", "UK", "EU", "IE", "GLOBAL"].includes(f.region) ? f.region : "GLOBAL",
            url: f.url.slice(0, 300),
          }));
        await writeJSON("cockpit", KEY_FEEDS, cleaned);
        return json({ feeds: cleaned });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
