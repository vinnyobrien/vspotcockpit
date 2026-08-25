import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, ShieldAlert, Clock, Gauge, CalendarCheck } from "lucide-react";
import {
  C, BODY, MONO, Mono, Card, Pill, Field, Note, Empty, Confirm,
  Problem, Chips,
} from "../lib/ui.jsx";
import { queueGet, queuePost, queuePatch } from "../api.js";

/* ============================================================
   src/rooms/Actions.jsx

   Live: GET  /api/queue/digest         what needs doing
         PATCH /api/queue/actions/:id   close or dismiss
         POST /api/queue/score          score an asset, raise actions
         POST /api/queue/check-schedule  dry-run the PUB rules

   The rules layer, made visible. Three surfaces:

     Queue     what is open, blocking first. Closing an action
               requires a one line outcome, on purpose: without it
               you have a to-do list rather than a record of
               whether the rule was right.
     Score     one asset in, a number out, and whatever actions
               that number trips. QUA, INT and SPO raise themselves.
     Schedule  the PUB rules against a day's plan, before anything
               publishes. Dry run by default, so checking costs
               nothing and never dirties the queue.

   Nothing here publishes, sends or spends. The Cockpit queues,
   Vinny presses the button.
   ============================================================ */

const SEV = {
  BLOCK: { tint: null, colour: C.red, label: "Blocking" },
  WARN: { tint: C.sand, colour: C.ink, label: "Warning" },
  NOTE: { tint: null, colour: C.ink2, label: "Note" },
};

const CHANNELS = ["youtube", "linkedin", "tiktok", "twitter", "substack"];

const todayIE = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

export default function Actions() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [digest, setDigest] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("queue");
  const [filter, setFilter] = useState("");
  const [outcomes, setOutcomes] = useState({});

  /* score form */
  const [asset, setAsset] = useState({
    title: "", channel: "youtube", format: "clip",
    views: "", holdSeconds: "", likes: "", sponsored: false,
  });
  const [scored, setScored] = useState(null);

  /* schedule form */
  const [plan, setPlan] = useState("");
  const [check, setCheck] = useState(null);

  const load = useCallback(async (t) => {
    setBusy("load");
    setErr("");
    try {
      const d = await queueGet("digest", t ?? token);
      setDigest(d);
      setReady(true);
    } catch (e) {
      setErr(e.message || "The queue did not answer. Check the token.");
    }
    setBusy("");
  }, [token]);

  useEffect(() => { if (ready) load(); /* eslint-disable-next-line */ }, []);

  /* ------------------------------------------------------------ queue --- */

  const open = digest
    ? [...digest.blocking, ...digest.overdue, ...digest.dueToday, ...digest.upcoming]
        .filter((a, i, arr) => arr.findIndex((x) => x.action_id === a.action_id) === i)
    : [];

  const shown = filter ? open.filter((a) => a.severity === filter) : open;

  const settle = async (id, state) => {
    const outcome = (outcomes[id] || "").trim();
    if (state === "done" && !outcome) {
      setErr("Add a one line outcome before closing. That field is how you find out later whether the rule was right.");
      return;
    }
    setBusy(id);
    setErr("");
    try {
      await queuePatch(id, { state, outcome }, token);
      setOutcomes((o) => ({ ...o, [id]: "" }));
      await load();
    } catch (e) {
      setErr(e.message || `Could not update ${id}.`);
    }
    setBusy("");
  };

  /* ------------------------------------------------------------ score --- */

  const runScore = async () => {
    if (!asset.title.trim() || !asset.views) return;
    setBusy("score");
    setErr("");
    setScored(null);
    try {
      const r = await queuePost("score", {
        ...asset,
        views: Number(asset.views),
        holdSeconds: Number(asset.holdSeconds || 0),
        likes: Number(asset.likes || 0),
      }, token);
      setScored(r.results?.[0] || null);
      await load();
    } catch (e) {
      setErr(e.message || "Scoring failed. Nothing was written.");
    }
    setBusy("");
  };

  /* --------------------------------------------------------- schedule --- */

  /* One post per line: title | ISO timestamp. Deliberately dumb, because the
     alternative is a form with six fields you fill in at eleven at night. */
  const parsePlan = () =>
    plan.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [title, at] = l.split("|").map((s) => (s || "").trim());
      return { title, channel: "youtube", scheduledAt: at };
    }).filter((p) => p.title && p.scheduledAt);

  const runCheck = async () => {
    const planned = parsePlan();
    if (!planned.length) return;
    setBusy("check");
    setErr("");
    setCheck(null);
    try {
      setCheck(await queuePost("check-schedule", { planned, commit: false }, token));
    } catch (e) {
      setErr(e.message || "The check failed.");
    }
    setBusy("");
  };

  /* ------------------------------------------------------------- gate --- */

  if (!ready) {
    return (
      <div>
        <Note>
          The action queue. Rules v0.1, thresholds set on 90 days of thin data and due for review
          on 1 December. Everything here is advisory: it queues, you press the button.
        </Note>
        <Problem onDismiss={() => setErr("")}>{err}</Problem>
        <Card pad={16}>
          <Mono>Cockpit token</Mono>
          <div style={{ marginTop: 8 }}>
            <Field value={token} onChange={setToken} onEnter={() => load(token)} placeholder="Held for this session only" />
          </div>
          <p style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.5, marginTop: 10 }}>
            Temporary. Once the queue shares the Cockpit's own auth this field disappears and the room
            just loads, the way the other rooms do.
          </p>
          <div style={{ marginTop: 14 }}>
            <Pill sm disabled={!token.trim() || !!busy} onClick={() => load(token)}>Open the queue</Pill>
          </div>
        </Card>
      </div>
    );
  }

  const d = todayIE();

  return (
    <div>
      <Note>
        Blocking items first. A rule fires on a number, and the number that fired it travels with the
        action, so nothing here asks you to take its word for anything.
      </Note>
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      <Card style={{ marginBottom: 14 }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Mono>{digest?.date || d}</Mono>
            <div style={{ fontSize: 14, color: C.ink, marginTop: 6 }}>
              {digest?.counts?.block || 0} blocking · {digest?.counts?.warn || 0} warnings · {digest?.counts?.note || 0} notes
            </div>
          </div>
          <Pill sm tone="ghost" icon={RefreshCw} disabled={!!busy} onClick={() => load()}>Refresh</Pill>
        </div>
        {digest?.dayWeight != null && (
          <div style={{ marginTop: 10 }}>
            <Mono s={9}>
              This weekday historically holds {digest.dayWeight.toLocaleString("en-IE")} seconds of attention
            </Mono>
          </div>
        )}
      </Card>

      <Chips
        items={[["queue", "Queue"], ["score", "Score an asset"], ["schedule", "Check a schedule"]]}
        value={tab} onChange={setTab}
      />
      <div style={{ height: 14 }} />

      {/* -------------------------------------------------------- queue --- */}

      {tab === "queue" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Chips
              items={[["", "All open"], ["BLOCK", "Blocking"], ["WARN", "Warnings"], ["NOTE", "Notes"]]}
              value={filter} onChange={setFilter}
            />
          </div>

          {shown.length === 0 ? (
            <Empty>
              Nothing open in this filter. Either the week is clean or nothing has been scored yet,
              and on a queue this young the second is likelier than the first.
            </Empty>
          ) : (
            shown.map((a) => {
              const s = SEV[a.severity] || SEV.NOTE;
              const late = a.due < d;
              return (
                <Card key={a.action_id} pad={16} tint={s.tint} style={{ marginBottom: 10 }}>
                  <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                    <Mono s={9} c={s.colour}>{s.label}</Mono>
                    <Mono s={9}>{a.rule}</Mono>
                    <Mono s={9}>{a.channel}</Mono>
                    <Mono s={9} c={late ? C.red : C.ink2}>{late ? `overdue ${a.due}` : `due ${a.due}`}</Mono>
                  </div>

                  <div style={{ fontSize: 15, color: C.ink, lineHeight: 1.45, marginTop: 8, fontWeight: 500 }}>
                    {a.asset}
                  </div>
                  {a.evidence && (
                    <div style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.6, marginTop: 6 }}>
                      {a.evidence}
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <Field
                      value={outcomes[a.action_id] || ""}
                      onChange={(v) => setOutcomes((o) => ({ ...o, [a.action_id]: v }))}
                      placeholder="Outcome, one line"
                    />
                  </div>
                  <div className="flex gap-2" style={{ marginTop: 10 }}>
                    <Pill sm disabled={busy === a.action_id} onClick={() => settle(a.action_id, "done")}>Close</Pill>
                    <Confirm
                      sm
                      label="Dismiss"
                      confirmLabel="Yes, dismiss"
                      disabled={busy === a.action_id}
                      onConfirm={() => settle(a.action_id, "dismissed")}
                    />
                  </div>
                </Card>
              );
            })
          )}
        </>
      )}

      {/* -------------------------------------------------------- score --- */}

      {tab === "score" && (
        <>
          <Card pad={16} style={{ marginBottom: 12 }}>
            <Mono>Asset</Mono>
            <div style={{ marginTop: 8 }}>
              <Field value={asset.title} onChange={(v) => setAsset({ ...asset, title: v })} placeholder="Clip or episode title" />
            </div>

            <div className="flex gap-2" style={{ marginTop: 12, flexWrap: "wrap" }}>
              {CHANNELS.map((c) => (
                <Pill key={c} sm tone={asset.channel === c ? "solid" : "ghost"}
                  onClick={() => setAsset({ ...asset, channel: c })}>{c}</Pill>
              ))}
            </div>
            <div className="flex gap-2" style={{ marginTop: 8 }}>
              <Pill sm tone={asset.format === "clip" ? "solid" : "ghost"}
                onClick={() => setAsset({ ...asset, format: "clip" })}>Clip</Pill>
              <Pill sm tone={asset.format === "longform" ? "solid" : "ghost"}
                onClick={() => setAsset({ ...asset, format: "longform" })}>Long-form</Pill>
              <Pill sm tone={asset.sponsored ? "solid" : "ghost"}
                onClick={() => setAsset({ ...asset, sponsored: !asset.sponsored })}>Sponsored</Pill>
            </div>

            <div className="flex gap-2" style={{ marginTop: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 90 }}>
                <Mono s={9}>Views</Mono>
                <Field value={asset.views} onChange={(v) => setAsset({ ...asset, views: v })} placeholder="1098" />
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <Mono s={9}>Hold, seconds</Mono>
                <Field value={asset.holdSeconds} onChange={(v) => setAsset({ ...asset, holdSeconds: v })} placeholder="17" />
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <Mono s={9}>Likes</Mono>
                <Field value={asset.likes} onChange={(v) => setAsset({ ...asset, likes: v })} placeholder="14" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3" style={{ marginTop: 14 }}>
              <Mono s={9}>Hold 40 · reach 35 · engagement 25</Mono>
              <Pill sm icon={Gauge} disabled={!!busy || !asset.title.trim() || !asset.views} onClick={runScore}>
                Score it
              </Pill>
            </div>
          </Card>

          {busy === "score" && <Card><div className="lamp"><Mono c={C.red}>Scoring…</Mono></div></Card>}

          {scored && (
            <>
              <Card tint={scored.score.total >= 70 ? C.mint : scored.score.total < 20 ? C.sand : null} pad={18}>
                <div className="flex items-baseline gap-3">
                  <span style={{ fontFamily: MONO, fontSize: 40, fontWeight: 700, color: C.ink, letterSpacing: "-.02em" }}>
                    {scored.score.total}
                  </span>
                  <Mono>{scored.score.band}</Mono>
                </div>
                <div style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.6, marginTop: 10 }}>
                  {scored.score.heldSeconds.toLocaleString("en-IE")} seconds held · {scored.score.likeRate}% like rate ·
                  hold {scored.score.parts.hold}, reach {scored.score.parts.reach}, engagement {scored.score.parts.engagement}
                </div>
              </Card>

              {scored.raised?.length > 0 && (
                <Card pad={16} style={{ marginTop: 10 }}>
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={14} strokeWidth={2.2} color={C.red} />
                    <Mono c={C.red}>{scored.raised.length} action{scored.raised.length === 1 ? "" : "s"} raised</Mono>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {scored.raised.map((r) => (
                      <div key={r.action_id} style={{ marginBottom: 10 }}>
                        <Mono s={9} c={r.severity === "BLOCK" ? C.red : C.ink2}>{r.rule} · {r.severity}</Mono>
                        <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55, marginTop: 3 }}>{r.evidence}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.5, marginTop: 4 }}>
                    A high score does not clear an integrity block. They are separate tests on purpose:
                    a composite can be dragged over the line by its other parts, a gate cannot.
                  </p>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* ----------------------------------------------------- schedule --- */}

      {tab === "schedule" && (
        <>
          <Card pad={16} style={{ marginBottom: 12 }}>
            <Mono>Planned posts</Mono>
            <div style={{ marginTop: 8 }}>
              <Field
                value={plan} onChange={setPlan} rows={6} onEnter={runCheck}
                placeholder={"One per line, title then a pipe then the time:\nVinted EBIT margin | 2026-08-26T08:15:00+01:00"}
              />
            </div>
            <p style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.5, marginTop: 10 }}>
              Dry run. This never writes to the queue, so checking a plan you end up abandoning
              costs nothing.
            </p>
            <div style={{ marginTop: 14 }}>
              <Pill sm icon={CalendarCheck} disabled={!!busy || !plan.trim()} onClick={runCheck}>Check it</Pill>
            </div>
          </Card>

          {busy === "check" && <Card><div className="lamp"><Mono c={C.red}>Checking…</Mono></div></Card>}

          {check && (
            check.clear && check.actions.length === 0 ? (
              <Card tint={C.mint} pad={16}>
                <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6 }}>
                  Clear. No publishing rule fires on this plan.
                </div>
              </Card>
            ) : (
              <>
                <Card tint={check.clear ? C.sand : null} pad={16} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 14, color: check.clear ? C.ink : C.red, lineHeight: 1.6 }}>
                    {check.blocking > 0
                      ? `${check.blocking} blocking violation${check.blocking === 1 ? "" : "s"}. Move something before this publishes.`
                      : "No blocks, but the plan trips warnings worth reading."}
                  </div>
                </Card>
                {check.actions.map((a, i) => {
                  const s = SEV[a.severity] || SEV.NOTE;
                  return (
                    <Card key={i} pad={14} style={{ marginBottom: 8 }}>
                      <div className="flex items-center gap-2">
                        <Mono s={9} c={s.colour}>{s.label}</Mono>
                        <Mono s={9}>{a.rule}</Mono>
                      </div>
                      <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.45, marginTop: 6 }}>{a.asset}</div>
                      <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55, marginTop: 4 }}>{a.evidence}</div>
                    </Card>
                  );
                })}
              </>
            )
          )}
        </>
      )}

      <div style={{ height: 10 }} />
      <Card pad={14}>
        <div className="flex items-center gap-2">
          <Clock size={14} strokeWidth={2.2} color={C.ink2} />
          <span style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5 }}>
            Thresholds come from 90 days of thin data across one and a half instrumented networks.
            SYS-06 reviews every one of them on 1 December.
          </span>
        </div>
      </Card>
    </div>
  );
}
