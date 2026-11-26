import React, { useEffect, useState } from "react";
import { readAudit } from "../lib/audit.js";

const limit = 4;

export default function TodayDashboard({ sections, onOpen, onReviewTask }) {
  const [audit, setAudit] = useState([]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [auditDay, setAuditDay] = useState(today);
  useEffect(() => { let live = true; const load = () => readAudit(auditDay).then((rows) => { if (live) setAudit(rows); }).catch(() => {}); load(); window.addEventListener("cockpit-audit-updated", load); return () => { live = false; window.removeEventListener("cockpit-audit-updated", load); }; }, [auditDay]);
  return (
    <>
    <section className="today-dashboard" aria-label="Today’s results and decisions">
      {sections.map(({ id, label, rows, room, partial, empty, unavailable }) => (
        <section className={`today-result today-result-${id}`} key={id} aria-labelledby={`today-result-${id}`}>
          <h2 id={`today-result-${id}`}>{label}</h2>
          <div className="today-result-count">{unavailable || (partial ? `${rows.length} loaded` : rows.length)}</div>
          {rows.length ? (
            <ul>
              {rows.slice(0, limit).map((row) => (
                <li key={row.id}>
                  {row.url ? <a href={row.url} target="_blank" rel="noreferrer">{row.title}</a>
                    : row.taskId ? <button type="button" onClick={() => onReviewTask(row.taskId)}>{row.title}</button>
                    : row.room ? <button type="button" onClick={() => onOpen(row.room)}>{row.title}</button>
                    : <span>{row.title}</span>}
                  {row.detail && <small>{row.detail}</small>}
                </li>
              ))}
            </ul>
          ) : <p>{empty}</p>}
          {partial && <small>Some source data is missing or still loading.</small>}
          {rows.length > limit && (
            <details><summary>Show {rows.length - limit} more</summary>
              <ul>{rows.slice(limit).map((row) => <li key={row.id}>
                {row.url ? <a href={row.url} target="_blank" rel="noreferrer">{row.title}</a>
                  : <button type="button" onClick={() => row.taskId ? onReviewTask(row.taskId) : onOpen(row.room || room)}>{row.title}</button>}
                {row.detail && <small>{row.detail}</small>}
              </li>)}</ul>
            </details>
          )}
          {room && <button className="today-result-source" type="button" onClick={() => onOpen(room)}>Open {({ publishing: "Publishing", calendar: "Calendar", growth: "Growth", finance: "Finance" })[room]}</button>}
        </section>
      ))}
    </section>
    <details className="today-audit" open={audit.length > 0}>
      <summary>Daily audit log <span>{audit.length} recorded action{audit.length === 1 ? "" : "s"}</span></summary>
      <label className="today-audit-date">Audit date<input type="date" value={auditDay} max={today} onChange={(event) => { if (event.target.value) setAuditDay(event.target.value); }}/></label>
      {audit.length ? <ol>{audit.map((row) => <li key={row.id}>
        <time dateTime={row.at}>{new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit" }).format(new Date(row.at))}</time>
        <div><strong>{row.action}</strong> · {row.target}{row.detail && <small>{row.detail}</small>}</div>
      </li>)}</ol> : <p>No important actions recorded on this date yet.</p>}
    </details>
    </>
  );
}
