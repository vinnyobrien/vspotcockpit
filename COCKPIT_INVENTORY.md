# Cockpit capability inventory — 29 September 2026

Status: first pass from `main` source code. This is a code inventory, **not** proof that every integration works in the deployed app or that stored data has been migrated. Do not remove a room until its records and workflow have been checked.

## What exists

The React/Vite app has 15 top-level navigation entries in `src/App.jsx`, plus 18 components in `src/rooms`. The user's wider 57-item inventory has not yet been reconciled with these screens, background functions, and workflow steps. Netlify hosts the app; its functions provide authentication, storage, assistant operations, integrations, media intake, scheduling, and publishing. The new private mobile demo is a separate interaction prototype.

| Current surface | Existing purpose | Proposed home in the new navigation | Initial call |
| --- | --- | --- | --- |
| Today | Daily rundown, gaps, inbox, week, tomorrow's three | Today | Keep and make the main entry |
| Actions | Queue, asset scoring, schedule checks | Today / Production | Keep the underlying checks; combine the action view |
| Inbox | Incoming items and reply workflow | Today / People | Keep; route actionable items into one queue |
| Week | Slots and schedule | Today / Calendar | Keep as an expanded view |
| Breaking News | Shortlist, rundown, script archive | Wire / Create | Keep the editorial steps and records |
| The Desk | Wire, conversation, studio | Wire / Create | Keep; unify with Breaking News around a story record |
| Editorial Call | Editorial decisions | Create | Keep as a step, not necessarily a destination |
| Sub-Editor | Claims, contradictions, provenance | Create / Evidence | Keep as a review gate |
| Essay | Long-form creation | Create | Keep |
| Video | Shorts, upload, calendar | Production | Keep; verify the actual phone upload and scheduling path |
| ClipDesk | Clip workflow and status | Production | Verify which component is active; consolidate duplicate locations |
| Build | Transcript to titles, chapters and clips | Production | Keep |
| Episode Intelligence | Transcript and interview insight | Production / People | Keep |
| Guests | Guest pipeline and outreach | People | Keep and simplify add flow |
| Shows | Feeds and episodes | Production / Library | Keep |
| Growth | Prospects, sponsors and commercial assets | Money / People | Keep |
| Analysis | Monthly performance and threads | Signals | Keep, connect outcomes to source ideas |
| The Cast | Character/voice production | Create / Production | Keep if regularly used; make discoverable by task |

## Existing services worth preserving

- Password-gated session, server-side prompts, and separate Cockpit, vault, and secrets storage.
- Google read access for Gmail, Calendar and Drive, with user-initiated Drive writes.
- Anthropic operations, ledger, background jobs and inbox intake.
- Metricool ingest, scheduling and publishing paths; Opus, Fireflies and GitHub publishing integrations.
- Media intake code in `media.mjs` opens a resumable Google Drive upload session so large video bytes bypass the Netlify function body. The Video room already mounts an Upload component.
- Current scheduler validation allows X, TikTok and YouTube. LinkedIn is connected in Metricool but excluded from this path.
- A separate action queue and media registry exist. Confirm their live configuration and data before changing the interface.

## Verify before treating as production-ready

1. **Live state:** Identify the Netlify production deploy's source commit and compare it with `main`. Confirm which of the 57 reported capabilities are screens, actions, scheduled jobs, integrations or ideas.
2. **Data:** Export an authorised backup of Cockpit, vault and media registries. Map keys to screens; test restore in a preview environment.
3. **Phone upload:** Test an actual iPhone video through upload, registry, preview, platform fetch and failure recovery. The comments in media and scheduling code describe different storage assumptions; the real URL handed to Metricool needs verification.
4. **Distribution:** Check X, TikTok and YouTube individually. Add LinkedIn-specific video metadata, cover, caption and review only after validating its account and permissions. Keep platform results distinct.
5. **Morning actions:** Trace Gmail and Calendar items through triage, deduplication, dismissals and follow-up. Distinguish a fresh lead from an already answered thread.
6. **Navigation:** Trace the ClipDesk component in `src/rooms`, the separate `src/ClipDesk.jsx`, and the Desk's placeholder navigation. Preserve the useful path and remove dead links only after testing.
7. **iPhone:** Verify Home Screen icon, safe areas, session renewal, voice permissions, video picker and upload interruption recovery.
8. **Policy:** The current assistant policy is read/propose. Define explicit approval states for email sends, publication, scheduling and budget changes before expanding write actions.

## Proposed order of work

1. Reconcile the 57-item list against code and live state; mark each **working**, **partial**, **duplicate**, **dormant**, or **proposed**.
2. Define shared records and IDs for story, source, guest, episode, asset, publication, campaign and action. Preserve existing storage during an adapter phase.
3. Bring the new Today, wire, mobile navigation, themes, chat and voice into a preview branch of the existing app. Keep old routes reachable.
4. Complete one end-to-end flow: source → angle → evidence → script → asset → platform-specific review → publication result.
5. Complete guest intake and the morning action queue against real email/calendar data.
6. Verify phone video upload and add LinkedIn distribution. Measure the results through Metricool.
7. Reconcile analytics and commercial outcomes, then retire redundant UI after parity checks.
8. Cut over the iPhone Home Screen shortcut only after a data backup, preview test, and rollback path.

## Product rhythm to support

The Today view should surface commitments and opportunities without filling every free hour. It should reserve protected editorial thinking, market-listening conversations, recovery and family time alongside production. Weekly review asks what created useful work, what was promised, what moved, and what can be dropped.
