# Cockpit assembly roadmap

## Product direction

The Cockpit is Vinny's media and commercial workbench: a little editorial desk, a little studio control room, and a practical revenue tracker. It should feel personal and opinionated, while keeping the next useful action obvious. It is not a gallery of unrelated dashboards.

The shell uses the V-Spot Media Skyline Badge, the network artwork derived from the water-and-wine PSA. Its palette is midnight navy, cream, red and gold. Condensed italic headings echo the badge lettering.

## Build order

### 1. Identity and mobile shell — in progress

- Make the brand lockup visible in the desktop rail and mobile masthead.
- Keep Today, Desk, Schedule, Production, and Guests reachable from the mobile dock.
- Validate the main screen, a room view, and the dock at a real phone width before merging.
- Move toward a more personal, editorial studio look without sacrificing legibility or fast scanning.

**Done when:** the same identity holds across phone and desktop; the primary tasks fit without horizontal scrolling; the main action areas are readable and tappable.

### 2. Today as the daily operating brief

- Automatically collect Fireflies meeting actions and decisions into a dated, source-linked list.
- Refresh the Gmail, Calendar, and Drive briefing when it is stale; add Slack and Asana only after their connectors are built.
- Replace the generic checklist with a daily hit list that records completion and outcome evidence, then feeds daily and weekly productivity views.
- Track sponsor approaches and AI implementation opportunities together, with an explicit daily target of 3–4 qualified sponsor approaches.

**Done when:** a new meeting or briefing item arrives without a manual sweep, has provenance, can become a task, and contributes to an honest daily/weekly report.

### 3. Revenue and conversion learning

- Use one pipeline for sponsor opportunities and high-value AI implementation projects.
- Capture prospect, offer, expected value, stage, last touch, next step, win/loss, actual value, and reason.
- Treat the Commercial Barometer as evidence about conversion and offer outcomes, not a static price list.
- Put Camp Truly and Have I Got News For You? Europe in the visible campaign plan.

**Done when:** the cockpit can show approaches made, replies, qualified opportunities, proposals, wins, revenue booked, and where prospects stalled.

### 4. Production and publishing system

- Make the production checklist the source of truth for each episode or campaign.
- Keep one dated asset manifest per item: script, audio/video, captions, artwork, sponsor material, metadata, approval, and channel links.
- Dov assembles materials and flags missing files; the Sub-Editor reviews voice, claims, and clarity; Vinny approves wording; publishing is recorded against the approved copy.
- Compare approved wording with what actually went live and retain the difference as an editorial learning.
- Show a compact schedule for today and a searchable publication history with format, sponsor, release time, and channels.

**Done when:** an item cannot be marked ready until required assets and sign-offs are present, and each published channel has a verified link and timestamp.

### 5. Editorial desk and guest history

- Let a new idea or shared note become a structured editorial item with suggested show, channel, format, owner, and next step.
- Keep the human decision visible when the idea could fit multiple shows.
- Give each guest a history, research notes, backstage room, booking brief, and StreamYard link; preserve follow-up and thank-you reminders.

**Done when:** notes can be captured once, routed to the right production, and retrieved later without rebuilding the guest or story history.

### 6. News and audience intelligence

- Refresh a UK, Europe, and US news radar hourly, with stronger European coverage and clear source links.
- Keep breaking stories quick to scan and alert on high-interest items rather than filling the page with every headline.
- Consolidate Metricool and native platform metrics into daily, weekly, and monthly views with prior-period comparisons.

**Done when:** news and audience views show refresh time, source, period, and comparison baseline; missing data is labelled rather than implied.

## Operating rules

- Every button must perform a named action, navigate to a named place, or explain why it is unavailable.
- Every data panel must show its source and last-updated time.
- No external message, sign-off, publication, or file move happens without Vinny's approval where the workflow calls for it.
- Store client-sensitive material in the private vault; keep only safe references and summaries in mirrorable cockpit data.
- Dot owns repeatable checks and reporting instructions. Netlify schedules and integrations own background execution. An instruction card alone does not mean a task is running.

## Current integration boundary

- Fireflies API intake is present in code and is configured for a 15-minute schedule in the preview build.
- Gmail, Google Calendar, and Drive are connected for the current briefing flow.
- Slack and Asana are not yet connected to the cockpit.
- Metricool access exists as a connected service, but audience views still need a consolidated data model and comparisons.
- The preview is not production. Scheduled Fireflies intake and the rest of this branch become live only after merge and deploy.

## Where outputs appear

| Output | Appears in | Connection |
| --- | --- | --- |
| Upcoming releases and pending sign-offs | Today, Studio, Content Calendar | These views read the same editorial calendar. |
| Recorded release links | Studio, Reporting, Publishing | Studio and Reporting count the same saved packs. Publishing updates both after a save. |
| Open follow-ups due today or earlier | Revenue, People, Follow-ups | Both workspaces read the same queue and reflect changes made in Follow-ups. |
| Source-backed news lead and its angle | Breaking News, The Desk | Send a selected story to the Desk with its source link and angle. |
| Daily outcomes | Today, Reporting | Both views use the daily checklist and its completion state. |

Production, calendar and publishing still hold separate records. A shared release ID is needed before a draft, checklist, sign-off and published links can be shown as one release across those views. The sponsor target is a goal. Counting actual approaches and conversion depends on a shared sponsorship and advisory pipeline. Keep the Commercial Barometer available from Revenue while gathering enough outcomes to decide whether it needs a separate view. Finance remains reachable from Revenue. Audience reporting, background news and productivity reporting have their own integration work.
