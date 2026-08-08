/**
 * THE X DESK, the room itself.
 *
 * Server rendered, zero JavaScript, plain HTML forms. That is deliberate. The
 * cockpit ships a strict Content-Security-Policy with no script-src, so an
 * inline script would be blocked. Forms and links are not, so the whole desk
 * works under the existing policy, on a phone, with no build step and without
 * touching a single existing file.
 *
 * Posting is a link out to X's composer, prefilled. Nothing auto-posts.
 */

import { requireAuth } from "./_auth.js";
import { readJSON } from "./_blobs.js";
import {
  SLOTS,
  VOICES,
  KEY_LEDGER,
  todayISO,
  loadDay,
  saveDay,
  buildDay,
  redraft,
  approve,
  clamp,
} from "./_xdesk.js";

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const shift = (date, days) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const intent = (text, url) =>
  `https://x.com/intent/post?text=${encodeURIComponent(url ? `${text}\n\n${url}` : text)}`;

/* ----------------------------------------------------------------- css */

const CSS = `
:root{
  --red:#E8272A; --navy:#1A1F3C; --black:#0A0A0A; --tan:#D2B48C; --grey:#A0A0A0;
  --line:#242a4a; --panel:#12162e;
}
*{box-sizing:border-box}
body{margin:0;background:var(--black);color:#EDEDED;
  font-family:"IBM Plex Sans",system-ui,sans-serif;font-weight:300;line-height:1.5;
  padding:0 0 80px}
a{color:var(--tan)}
.wrap{max-width:940px;margin:0 auto;padding:0 20px}
header{background:var(--navy);border-bottom:2px solid var(--red);padding:26px 0 22px;margin-bottom:26px}
h1{font-family:"Big Shoulders Display",Impact,sans-serif;font-weight:900;font-size:46px;
  letter-spacing:.03em;margin:0;color:#fff;text-transform:uppercase;line-height:.95}
h1 span{color:var(--red)}
.sub{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.22em;
  text-transform:uppercase;color:var(--grey);margin-top:8px}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:18px}
.card{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--red);
  padding:20px 22px;margin-bottom:20px}
.card.approved{border-left-color:#3FBF6B}
.card.empty{border-left-color:var(--grey);opacity:.85}
.slot{display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;justify-content:space-between}
.slot h2{font-family:"Big Shoulders Display",Impact,sans-serif;font-weight:700;font-size:27px;
  margin:0;text-transform:uppercase;letter-spacing:.02em;color:#fff}
.meta{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.13em;
  text-transform:uppercase;color:var(--grey)}
.voice{color:var(--tan)}
.story{border-top:1px solid var(--line);margin-top:14px;padding-top:14px;font-size:15px}
.story a{text-decoration:none;border-bottom:1px solid rgba(210,180,140,.4)}
.why{color:var(--grey);font-style:italic;font-size:13px;margin-top:6px}
.drafts{margin:16px 0 0;padding:0;list-style:none}
.drafts li{display:flex;gap:10px;align-items:flex-start;margin-bottom:8px}
.drafts .pick{flex:0 0 auto}
.drafts p{margin:0;font-size:14.5px}
.drafts .on{color:#fff}
.drafts .off{color:#9aa0b8}
textarea{width:100%;min-height:92px;background:#0d1024;color:#fff;border:1px solid var(--line);
  padding:11px 12px;font-family:"IBM Plex Sans",sans-serif;font-size:15px;line-height:1.45;resize:vertical}
input[type=text]{background:#0d1024;color:#fff;border:1px solid var(--line);padding:8px 10px;
  font-family:"IBM Plex Sans",sans-serif;font-size:14px;min-width:230px;flex:1 1 230px}
button,.btn{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.14em;
  text-transform:uppercase;padding:9px 15px;border:1px solid var(--line);background:#191e3c;
  color:#fff;cursor:pointer;text-decoration:none;display:inline-block}
button:hover,.btn:hover{border-color:var(--tan)}
button.go{background:var(--red);border-color:var(--red);font-weight:500}
button.ghost{background:transparent;color:var(--grey)}
.btn.x{background:#fff;color:#000;border-color:#fff;font-weight:500}
.row{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-top:12px}
.count{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--grey);letter-spacing:.1em}
.count.over{color:var(--red)}
.flag{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;
  padding:3px 8px;border:1px solid currentColor}
.flag.ok{color:#3FBF6B}
.flag.dr{color:var(--tan)}
.note{background:var(--navy);border:1px solid var(--line);padding:12px 16px;margin-bottom:20px;font-size:14px}
details{margin-top:26px;border-top:1px solid var(--line);padding-top:16px}
summary{cursor:pointer;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--grey)}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
td,th{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
th{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--grey);font-weight:400}
.bad{color:var(--red)}
form{margin:0}
`;

/* ---------------------------------------------------------------- views */

function slotCard(slot, cell, date) {
  const v = VOICES[slot.voice];
  const text = cell.text || "";
  const n = text.length;
  const approved = cell.status === "approved";

  const flag = approved
    ? `<span class="flag ok">Approved</span>`
    : cell.drafts.length
    ? `<span class="flag dr">Draft</span>`
    : "";

  if (!cell.story) {
    return `<article class="card empty">
      <div class="slot"><h2>${esc(slot.label)}</h2>
        <div class="meta">${esc(slot.time)} &nbsp;/&nbsp; <span class="voice">${esc(v.name)}</span></div></div>
      <div class="story" style="color:#8b90a8">Nothing here yet. Run Build the day.</div>
    </article>`;
  }

  const drafts = cell.drafts
    .map(
      (d, i) => `<li>
        <form class="pick" method="post" action="/api/xdesk-page">
          <input type="hidden" name="action" value="choose">
          <input type="hidden" name="date" value="${esc(date)}">
          <input type="hidden" name="slot" value="${esc(slot.id)}">
          <input type="hidden" name="index" value="${i}">
          <button class="ghost" type="submit">${i === cell.chosen ? "&#9679;" : "&#9675;"} ${i + 1}</button>
        </form>
        <p class="${i === cell.chosen ? "on" : "off"}">${esc(d)} <span class="count ${d.length > 240 ? "over" : ""}">${d.length}</span></p>
      </li>`
    )
    .join("");

  return `<article class="card ${approved ? "approved" : ""}">
    <div class="slot">
      <h2>${esc(slot.label)} ${flag}</h2>
      <div class="meta">${esc(slot.time)} &nbsp;/&nbsp; <span class="voice">${esc(v.name)}</span></div>
    </div>

    <div class="story">
      <a href="${esc(cell.story.url)}" target="_blank" rel="noopener">${esc(cell.story.title)}</a>
      <div class="meta" style="margin-top:5px">${esc(cell.story.source)} &nbsp;/&nbsp; ${esc(cell.story.region)}</div>
      ${cell.why ? `<div class="why">${esc(cell.why)}</div>` : ""}
    </div>

    <ul class="drafts">${drafts}</ul>

    <form method="post" action="/api/xdesk-page">
      <input type="hidden" name="action" value="edit">
      <input type="hidden" name="date" value="${esc(date)}">
      <input type="hidden" name="slot" value="${esc(slot.id)}">
      <textarea name="text" maxlength="280">${esc(text)}</textarea>
      <div class="row">
        <span class="count ${n > 240 ? "over" : ""}">${n} / 240</span>
        <button type="submit">Save</button>
      </div>
    </form>

    <form method="post" action="/api/xdesk-page">
      <input type="hidden" name="action" value="redraft">
      <input type="hidden" name="date" value="${esc(date)}">
      <input type="hidden" name="slot" value="${esc(slot.id)}">
      <div class="row">
        <input type="text" name="note" placeholder="Direction for the rewrite, optional">
        <button type="submit">Redraft</button>
      </div>
    </form>

    <div class="row">
      <a class="btn x" href="${esc(intent(text, cell.story.url))}" target="_blank" rel="noopener">Post with link</a>
      <a class="btn" href="${esc(intent(text, ""))}" target="_blank" rel="noopener">Post text only</a>
      <form method="post" action="/api/xdesk-page">
        <input type="hidden" name="action" value="${approved ? "unapprove" : "approve"}">
        <input type="hidden" name="date" value="${esc(date)}">
        <input type="hidden" name="slot" value="${esc(slot.id)}">
        <button class="${approved ? "ghost" : "go"}" type="submit">${approved ? "Reopen" : "Mark done"}</button>
      </form>
    </div>
  </article>`;
}

function page({ date, day, msg, ledger }) {
  const cards = SLOTS.map((s) => slotCard(s, day.slots[s.id] || {}, date)).join("");

  const report = (day.report || []).length
    ? `<table><tr><th>Source</th><th>Status</th><th>Items</th></tr>${day.report
        .map(
          (r) =>
            `<tr><td>${esc(r.source)}</td><td class="${r.ok ? "" : "bad"}">${
              r.ok ? "ok" : esc(String(r.status))
            }</td><td>${r.count}</td></tr>`
        )
        .join("")}</table>`
    : `<p class="meta">No pull yet today.</p>`;

  const recent = ledger.length
    ? `<table><tr><th>Date</th><th>Slot</th><th>Post</th></tr>${ledger
        .slice(0, 20)
        .map(
          (l) =>
            `<tr><td>${esc(l.date)}</td><td>${esc(l.slot)}</td><td>${esc(l.text.slice(0, 120))}</td></tr>`
        )
        .join("")}</table>`
    : `<p class="meta">Nothing marked done this month.</p>`;

  const done = SLOTS.filter((s) => day.slots[s.id]?.status === "approved").length;

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>The X Desk</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>

<header><div class="wrap">
  <h1>The <span>X</span> Desk</h1>
  <div class="sub">Four a day &nbsp;/&nbsp; text only &nbsp;/&nbsp; nothing posts itself &nbsp;/&nbsp; ${done} of 4 done</div>
  <div class="bar">
    <a class="btn" href="/api/xdesk-page?date=${esc(shift(date, -1))}">&#8592; Prev</a>
    <span class="meta">${esc(date)}</span>
    <a class="btn" href="/api/xdesk-page?date=${esc(shift(date, 1))}">Next &#8594;</a>
    <form method="post" action="/api/xdesk-page">
      <input type="hidden" name="action" value="build">
      <input type="hidden" name="date" value="${esc(date)}">
      <button class="go" type="submit">Build the day</button>
    </form>
    <a class="btn" href="/">Cockpit</a>
  </div>
</div></header>

<div class="wrap">
  ${msg ? `<div class="note">${esc(msg)}</div>` : ""}
  ${day.error ? `<div class="note bad">${esc(day.error)}</div>` : ""}
  ${cards}

  <details><summary>Feed report</summary>${report}</details>
  <details><summary>This month, marked done</summary>${recent}</details>
  <p class="meta" style="margin-top:26px">Built ${day.builtAt ? esc(new Date(day.builtAt).toUTCString()) : "not yet"}. Approval writes to the ledger. It does not post.</p>
</div>
</body></html>`;
}

/* -------------------------------------------------------------- handler */

const html = (body, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

const back = (date, msg) =>
  new Response(null, {
    status: 303,
    headers: { location: `/api/xdesk-page?date=${date}${msg ? `&msg=${encodeURIComponent(msg)}` : ""}` },
  });

export default async (req) => {
  const denied = requireAuth(req);
  if (denied)
    return html(
      `<!doctype html><meta charset="utf-8"><title>The X Desk</title><body style="background:#0A0A0A;color:#EDEDED;font-family:system-ui;padding:60px 24px">
       <h1 style="font-size:22px">Not signed in</h1><p><a style="color:#D2B48C" href="/">Sign in to the cockpit</a>, then come back.</p>`,
      401
    );

  const url = new URL(req.url);

  if (req.method === "POST") {
    const form = await req.formData();
    const date = DATE_OK.test(form.get("date") || "") ? form.get("date") : todayISO();
    const slotId = SLOTS.some((s) => s.id === form.get("slot")) ? form.get("slot") : null;

    try {
      switch (form.get("action")) {
        case "build":
          await buildDay(date);
          return back(date, "Board rebuilt.");

        case "redraft":
          if (!slotId) break;
          await redraft(date, slotId, String(form.get("note") || "").slice(0, 300));
          return back(date, "Three new drafts.");

        case "choose": {
          if (!slotId) break;
          const day = await loadDay(date);
          const cell = day.slots[slotId];
          const i = Number(form.get("index"));
          if (cell?.drafts[i]) {
            cell.chosen = i;
            cell.text = cell.drafts[i];
            cell.status = "draft";
            await saveDay(day);
          }
          return back(date);
        }

        case "edit": {
          if (!slotId) break;
          const day = await loadDay(date);
          const cell = day.slots[slotId];
          if (cell) {
            cell.text = clamp(form.get("text"));
            cell.status = cell.text ? "draft" : "empty";
            await saveDay(day);
          }
          return back(date, "Saved.");
        }

        case "approve":
          if (!slotId) break;
          await approve(date, slotId);
          return back(date, "Marked done and logged.");

        case "unapprove": {
          if (!slotId) break;
          const day = await loadDay(date);
          const cell = day.slots[slotId];
          if (cell) {
            cell.status = cell.text ? "draft" : "empty";
            cell.postedAt = null;
          }
          await saveDay(day);
          return back(date);
        }
      }
      return back(date);
    } catch (e) {
      return back(date, String(e.message || e).slice(0, 220));
    }
  }

  const date = DATE_OK.test(url.searchParams.get("date") || "") ? url.searchParams.get("date") : todayISO();
  const day = await loadDay(date);
  const ledger = (await readJSON("cockpit", KEY_LEDGER(date.slice(0, 7)), [])) || [];
  return html(page({ date, day, msg: (url.searchParams.get("msg") || "").slice(0, 220), ledger }));
};
