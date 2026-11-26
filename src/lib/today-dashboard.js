import { dateInDublin, deadlines } from "./editorial-calendar.js";

function recordedOn(value, day) {
  if (typeof value !== "string" || !value) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value === day;
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) && dateInDublin(instant) === day;
}

export function getTodayDashboard({ day, calendar, followups, published, assets, tasks, done, dispositions }) {
  const items = calendar.data?.items ?? [];
  const calendarPosts = items.filter((item) => item.history?.some(
    ({ action, at }) => action === "Publication confirmed manually" && recordedOn(at, day)
  )).map((item) => ({ id: item.id, title: item.title, detail: item.show }));
  const clipPosts = [...new Map(published.filter((item) => recordedOn(item.date, day) && /^https?:\/\//i.test(item.url ?? ""))
    .map((item) => [item.url, { id: item.id, title: item.title, detail: item.platform, url: item.url }])).values()];
  const planned = items.filter((item) => item.date === day && ["planned", "review", "approved"].includes(item.status))
    .map((item) => ({ id: item.id, title: item.title, detail: [item.show, item.time || "Time to set"].filter(Boolean).join(" · ") }));
  const required = items.flatMap(deadlines).filter((entry) => entry.date === day && entry.key !== "release")
    .map(({ item, key, label }) => ({ id: `${item.id}:${key}`, title: item.title, detail: label, room: "calendar" }));
  const followupRows = (followups.data?.actions ?? []).filter((item) => item.state === "open" && item.dueDate === day);
  for (const item of followupRows) required.push({
    id: `followup:${item.id}`, title: item.title, detail: item.dueBasis === "proposed" ? "Follow-up · date proposed" : "Follow-up", room: "followups",
  });

  const taskGroups = { planned: [], required: [], deferred: [], ruledOut: [], delivered: [], strategy: [] };
  for (const task of tasks) {
    // Standing routines remain in the task checklist. The overview uses specific work captured today.
    if (!task.kind) continue;
    const row = { id: task.id, title: task.name, detail: [task.owner, task.dueDate && `Due ${task.dueDate}`].filter(Boolean).join(" · "), taskId: task.id };
    const status = dispositions[task.id];
    if (done[task.id]) taskGroups.delivered.push(row);
    else if (status === "deferred" || status === "ruledOut") taskGroups[status].push(row);
    else if (task.kind === "strategy") taskGroups.strategy.push(row);
    else if (task.dueDate && task.dueDate <= day) taskGroups.required.push(row);
    else if (!task.dueDate) taskGroups.planned.push(row);
  }

  const wins = assets.filter((item) => item.status === "won" && item.history?.some(
    ({ to, at }) => to === "won" && recordedOn(at, day)
  )).map((item) => ({ id: item.id, title: item.name, room: "growth" }));

  return [
    { id: "posted", label: "Posted today", rows: [...calendarPosts, ...clipPosts], partial: !calendar.data, empty: "No publication recorded today.", room: "publishing" },
    { id: "planned", label: "Planned today", rows: [...planned, ...taskGroups.planned], partial: !calendar.data, empty: "No releases or captured work planned today.", room: "calendar" },
    { id: "required", label: "Required today", rows: [...taskGroups.required, ...required], partial: !calendar.data || !followups.data, empty: "Nothing due today in the records loaded.", room: "calendar" },
    { id: "strategy", label: "Your strategic decisions", rows: taskGroups.strategy, empty: "No strategy decision captured for today." },
    { id: "delivered", label: "Work completed", rows: taskGroups.delivered, empty: "No captured work marked complete today." },
    { id: "deferred", label: "Not getting to", rows: taskGroups.deferred, empty: "Nothing put aside today." },
    { id: "ruledOut", label: "Ruled out", rows: taskGroups.ruledOut, empty: "Nothing ruled out today." },
    { id: "won", label: "Sponsors secured", rows: wins, empty: "No sponsor win recorded today.", room: "growth" },
    { id: "money", label: "Money earned", rows: [], unavailable: "Income source needed", empty: "The Finance room tracks receipts. Daily earnings need a connected income record.", room: "finance" },
  ];
}
