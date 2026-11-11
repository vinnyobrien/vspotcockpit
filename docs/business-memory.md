# Business Memory: capture, provenance, review

## What is implemented
- Clip-moment ledger: records each Opus candidate actually offered to the editor with project ID, Opus curation ID, first-shown date, tier and short transcript excerpt. Blocks near-identical transcript cuts from the same source even when Opus assigns a new ID. Existing legacy proposals are not backfilled. Stored in Cockpit Blobs.
- Authenticated `/.netlify/functions/context-search?q=...`: searches Fireflies-derived commitments/decisions and the **structured** email follow-up imports held in the private vault. Returns original source type, source ID, date, evidence, due basis and link when present.
- Nothing is published or emailed by these reads.

## Known gaps
- The existing Fireflies API helper has not been proven against a live account; the scheduled daily job may fail until its GraphQL fields and credentials are verified.
- Email coverage is limited to the cockpit-actions.json self-email import, **not** general Gmail threads or full sent/received history. Do not call this full correspondence memory.
- A real cross-source entity resolver is not yet built. Search is lexical; it may miss synonyms and nicknames.
- Current Opus similarity is token overlap of 500-character excerpts, not timestamp-level audio deduplication. Verify against actual projects.
- Existing Business Memory room is separately staged; wire the endpoint into it after that branch is merged.

## Next integration
1. Connect Gmail through scoped OAuth, sync message IDs/thread IDs and selected excerpts (with retention limits), preserve source links and access boundaries.
2. Resolve people, company, episode, sponsorship and project names with confidence levels and user correction.
3. Create a relationship timeline: call -> follow-up email -> decision -> deliverable -> next promise.
4. Generate drafts using a versioned voice guide built from **user-authored approved sent emails**. Do not copy guest wording or infer consent to send. Distinguish friendly guest notes from formal commercial/payment correspondence.
5. Review UI: source citations, conflicts, last-sync status, proposed actions, explicit approve/edit/send.
6. Keep private client material in vault; do not use it to generate public media copy without a deliberate user decision.
