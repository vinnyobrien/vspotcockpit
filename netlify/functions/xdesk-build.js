/**
 * Builds tomorrow's board before Vinny is awake.
 *
 * 05:30 UTC, which is 06:30 in Tralee through the summer and 05:30 in winter.
 * Either way the board is sitting there before the 07:30 Kettle slot.
 *
 * Netlify invokes this on a schedule and blocks HTTP access to it, so there is
 * no auth check and no way to trigger it from the browser. The Build the day
 * button on the desk calls the same buildDay function through /api/xdesk-page.
 */

import { buildDay, todayISO } from "./_xdesk.js";

export default async () => {
  try {
    const day = await buildDay(todayISO());
    const filled = Object.values(day.slots).filter((s) => s.drafts?.length).length;
    console.log(`[xdesk] built ${day.date}, ${filled} of 4 slots filled`);
  } catch (e) {
    console.error(`[xdesk] build failed: ${e.message || e}`);
  }
};

export const config = { schedule: "30 5 * * *" };
