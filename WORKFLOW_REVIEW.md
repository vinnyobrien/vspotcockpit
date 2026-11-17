# Cockpit inventory: workflow review

This continues the capability inventory in PR #8. Room counts and individual functions must be reconciled before removing anything.

| Workflow | Finding | This change / next action |
| --- | --- | --- |
| Phone upload | Native picker, no preview, transfer and library save blurred together | Preview, file details, explicit stages and saved receipt |
| Scheduling | Confirmation below the fold; successful request could hide missing media | Review before submission; prominent confirmed or needs-checking receipt; prevent repeat submission after accepted response |
| Video navigation | Technical infrastructure copy and generic Upload tab | Add video label and plain workflow instructions |
| Distribution | This route accepts X, TikTok and YouTube only | LinkedIn remains an integration task; shown explicitly |
| Scheduling timezone | Default used device timezone despite Ireland label | Generate default in Europe/Dublin, including travel and seasonal time changes |
| Guests | Preserve existing guest tools | Next: audit add guest, required fields, save receipt and follow-up |
| Inbox / morning actions | Email intake and daily priorities need an end-to-end audit | Next: trace lead arrival to an actionable morning item |
| Analytics | Upload origin, correspondent and beat already captured | Preserve attribution; next audit publisher/link usage and Metricool reporting |
| Week / time | User wants thinking, downtime and market listening protected | Review weekly planning after core save and confirmation flows |

## Validation
Production build passed. Receipt checks cover successful acceptance, business rejection, absent post ID/time/media, missing destinations and provider failures. Europe/Dublin winter and summer conversions checked.

Browser interaction test could not run in this environment (browser executable unavailable). No actual videos were uploaded and no posts were scheduled. Before production: verify a phone upload, playback, progress, review and the returned receipt against the authenticated Metricool planner.
