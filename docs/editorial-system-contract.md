# Cockpit 2.0 — Editorial System Contract
Status: proposed for review; not deployed. Owner approval required for publishing, sending, commercial commitments, and permanent global style changes.

## Brand identity
- Master brand: V Spot Media. Primary mark: approved silhouette of Vinny carrying wine bottle, without Shopware or PSA sponsorship wording. Preserve historical Shopware PSA collateral unchanged as campaign records.
- Never redraw, retouch or synthesize an approved person's headshot. Crop, mask, and resize only. Do not treat an AI-generated approximation of the logo as an approved master.
- Tokens: navy #1A1F3C, red #E8272A, tan #D2B48C, paper #F3F1EC, grey #A0A0A0, black #0A0A0A; Tilt Neon display, Archivo 400/600 body. Maintain accessible contrast.
- Required approved exports: master SVG/PNG (where rights and source permit), white, black, neon, square avatar, favicon SVG and PNG, social previews. DO NOT invent master artwork. Asset status is 'awaiting source verification' until exact approved binary is located and checksummed.

## Repository and asset model
Use a private, access-controlled canonical media store for originals, with versioned metadata in the cockpit. Do not put private client media, source photography, or confidential scripts in a public GitHub repository.
asset: id, type, canonical_uri, source_story_id, campaign_id?, brand_scope, rights_owner, permission, provenance, approved_by, approved_at, version, checksum, variants[], alt_text, created_at, status.
brand_scope: vspot_media | vspot_news | struggle_bus | ostrich_report | client | sponsor_campaign.
status: draft | pending_review | approved | archived.
Use approved assets only in publication, never auto-promote generated imagery.

## Editorial objects
story: id, working_title, thesis, angle, source_links[], fact_checks[], confidentiality_scope, outline, drafts[], approved_copy_id?, images[], show_links[], speaking_links[], distribution_plan, status.
draft_revision: id, story_id, text, editor, timestamp, previous_revision_id, diff, rationale?, approval_status.
preference: id, rule, scope(global|show|format|recipient), category(phrase|tone|structure|visual|sponsor|safety), source_revision_ids[], confidence, status(suggested|approved|rejected|superseded), created_at, updated_at.
Never convert a single edit into a global rule automatically. Show before/after and ask whether the edit is one-off, recipient-specific, format-specific, or permanent. Allow 'never use this phrase' explicit rule and undo. Avoid banned phrase in generated outputs once approved. Maintain provenance, versioning, and an audit log.

## Story-first image production
Story approved/selected -> visual brief (narrative point, composition, reference assets, rights, aspect ratios) -> generated or licensed image -> editorial review -> approved variants -> publication. Never generate unrelated filler images. No fabricated real-person photographs. If an image uses a known person's face, use approved real photography under its permission terms.
Each image must link to the source story, version, channel, and approval.

## Essay-to-speaking pipeline
essay -> talk candidate -> audience/promise -> 12-18 minute keynote/TED-style narrative (not TED-branded) -> hook, 3 acts, original examples, evidence, jokes, closing -> speaker abstract (100 and 250 words) -> 60-90 second audition reel script -> deck storyboard and imagery -> fee/availability terms -> booking page -> lead/opportunity.
Speaking catalogue statuses: idea | developing | ready_to_pitch | booked | delivered | retired. Maintain citations and permission boundaries for client anecdotes. No suggestion of TED affiliation or endorsement.

## Approval and automation
- AI may ingest, classify, tag, research, propose copy, build visuals, identify actions, and queue reviews.
- Routine inbound podcast acknowledgements may be auto-sent only after owner explicitly approves a template, recipient eligibility rules, exclusions, and revocation control; log every send.
- Human approval required for sponsorship offers, pricing, contracts, publishing, invoices, outbound commercial outreach, and new global editorial rules.
- Client vault content must never leak into public stories, marketing, image prompts or speaking materials.
- All external actions: who/what/when/source, approval basis, action result, undo or escalation route.

## Initial UI
Editorial desk: story library with visual thumbnails; story editor with tracked revision diffs; preference inbox; approved image library; speaking catalogue; approval queue. Show brand tokens and approved logo consistently across app chrome and favicons. Include accessibility, search, version history and filters.

## Acceptance criteria
1. Editor can revise a draft, inspect diff, and accept/reject a proposed reusable style rule; scope is selectable; change persists and is reversible.
2. Generation respects approved global and format-specific phrase bans; one-off edits do not silently become global.
3. Images cannot be published unless approved and traceable to a story, permission and version.
4. Sponsor campaign logo never overwrites the V Spot Media master; historical PSA remains intact.
5. At least one essay can progress through talk outline, abstract, reel script and pitch-ready state.
6. External sends and publication require logged approval or a previously approved narrow standing rule.
7. Existing client-vault isolation and authentication remain intact; production auth bypass configuration must be audited before release.

## V Spot Media motion signature — owner direction (10 November 2026)
The approved wine-and-water walking silhouette is a network-level production signature, not a show-specific or Shopware PSA logo. Use the same recognisable mark across The V Spot News, PSAs, The Ostrich Report, The Struggle Bus, short videos, clips and owned media, regardless of publishing channel. Show identities and sponsor marks remain separate.
- **Quick stamp:** target 0.5–1.5 seconds, subtle motion, original sonic sting; small screen legibility; no unnecessary long intro. The approved symbol-only crop must be derived from the existing artwork without redrawing it. Can serve as a short opening bumper, end card or corner watermark depending on the format and retention goals. Avoid obstructing captions or footage.
- **Extended production seal:** target 2–3 seconds with full V SPOT MEDIA wordmark; use for third-party deliverables, partner materials, speaker packs, backstage passes, sponsor proposals and formal credits. Represents production provenance, not endorsement of third-party claims.
- **Variants:** transparent master, dark/light, neon, monochrome; motion exports 9:16, 1:1, 16:9 and static PNG/SVG/favicons. Preserve original artwork and original sponsor PSA campaign versions as immutable records.
- **Packaging:** versioned, reusable network intro/outro asset IDs with duration, aspect ratio, sound rights, checksum, approval, and render version; never copy a low-resolution thumbnail as the master.
- **Editorial guardrail:** Use the signature consistently but keep intros fast; test audience retention. Do not imply every outside project is endorsed or approved without a specific contract and permission.
