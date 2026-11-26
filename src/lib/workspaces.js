import { dateInDublin, shiftDate } from "./editorial-calendar.js";

export const WORKSPACES = [
  { id: "studio", label: "Studio", tools: ["calendar", "build", "publishing", "sub", "episode", "video", "clipdesk", "shows", "cast", "entertainment"] },
  { id: "editorial-work", label: "Editorial", tools: ["breaking", "desk", "essay", "sub", "editorial", "episode", "cast"] },
  { id: "revenue", label: "Revenue", tools: ["growth", "followups", "barometer", "finance", "publishing"] },
  { id: "relationships", label: "People", tools: ["guests", "followups", "episode", "memory"] },
  { id: "reporting", label: "Reporting", tools: ["analysis", "audience", "publishing", "week", "actions", "memory"] },
];

export function workspaceOutputs({ calendar, followups, publishing, guests, completed, total }) {
  const today = dateInDublin();
  const weekEnd = shiftDate(today, 6);
  const items = calendar.data?.items;
  const releases = items?.filter((item) => item.status !== "published" && item.date >= today && item.date <= weekEnd) ?? [];
  const reviewCount = items?.filter((item) => item.status === "review").length ?? 0;
  const studioOutputs = items ? [
    { label: "Releases in the next 7 days", value: releases.length, room: "calendar" },
    { label: "Awaiting sign-off", value: reviewCount, room: "calendar" },
  ] : [{ label: calendar.error ? "Schedule unavailable" : "Loading schedule", room: "calendar" }];

  const followupOutput = followups.data
    ? { label: "Open follow-ups due", value: (followups.data.actions ?? []).filter(
      (item) => item.state === "open" && item.dueDate && item.dueDate <= today
    ).length, room: "followups" }
    : { label: followups.error ? "Follow-ups unavailable" : "Loading follow-ups", room: "followups" };

  const publishingOutput = publishing.rows
    ? { label: "Release packs with live links", value: publishing.rows.filter(
      (row) => Object.values(row.links ?? {}).some((link) => typeof link === "string" && /^https?:\/\//i.test(link.trim()))
    ).length, room: "publishing" }
    : { label: publishing.error ? "Publishing records unavailable" : "Loading publishing records", room: "publishing" };

  return {
    studio: [...studioOutputs, publishingOutput],
    "editorial-work": [],
    revenue: [{ label: "Daily sponsor approach target", value: "3–4", room: "growth" }, followupOutput],
    relationships: [{ label: "Guest records", value: guests.length, room: "guests" }, followupOutput],
    reporting: [{ label: "Today’s outcomes complete", value: `${completed}/${total}`, room: "analysis" }, publishingOutput],
  };
}
