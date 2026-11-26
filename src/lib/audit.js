import { dateInDublin } from "./editorial-calendar.js";

export async function recordAudit({ action, target, detail = "", source = "cockpit", at = new Date().toISOString() }) {
  const res = await fetch("/api/audit", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, target, detail, source, at }) });
  if (!res.ok) throw new Error(`Audit record failed (${res.status})`);
  const entry = await res.json();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("cockpit-audit-updated"));
  return entry;
}

export async function readAudit(day = dateInDublin()) {
  const res = await fetch(`/api/audit?day=${encodeURIComponent(day)}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Audit log unavailable (${res.status})`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}
