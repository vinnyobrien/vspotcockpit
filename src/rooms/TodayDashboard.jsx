import React from "react";

const limit = 4;

export default function TodayDashboard({ sections, onOpen, onReviewTask }) {
  return (
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
  );
}
