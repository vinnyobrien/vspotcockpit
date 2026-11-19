# Mallratts sponsor opportunities — Cockpit inventory bridge

Status: registered opportunity inventory and integration contract. NOT a live data connection or booked campaigns.

## Ownership
The VSpot Cockpit is the commercial system of record for Mallratts sponsor opportunities, outreach, proposals, campaign status, assets, delivery and invoicing. Mallratts is the game/publishing surface and must only receive approved public campaign payloads. The Cockpit already has a Growth room and sponsor-assets state; do not publish its confidential sponsor outreach or vault content.

## Sellable inventory
| ID | Placement | Commercial format | Delivery proof |
| --- | --- | --- | --- |
| MALL-SPR27-01 | Spring mall hero | Presented-by/virtual billboard | approved creative, served impressions |
| MALL-SPR27-02 | Retail Wire | labelled sponsored news card | impression, click, campaign URL |
| MALL-SPR27-03 | Retail ticker | labelled sponsor bumper | exposure and clicks where applicable |
| MALL-SPR27-04 | Manager | optional virtual SaaS/agency service | trials, selections, simulation outcomes |
| MALL-SPR27-05 | Daily Arcade | sponsored challenge | participation/completions |
| MALL-SPR27-06 | Time Warp | presented-by historical mission | starts/completions |
| MALL-SPR27-07 | Leagues | league presenting partner | eligible page impressions |
| MALL-SPR27-08 | Exchange | labelled virtual provider listing | discovery and simulated adoption |
| MALL-SPR27-09 | Mallrat Wallet | sponsored achievement/media pack | opt-in shares, claims |
| MALL-SPR27-10 | Murt bulletin | disclosed sponsor read | plays/completions |

## Spring 2027 in-world inventory (added)
| ID | Surface | Creative / interaction | Status |
| --- | --- | --- | --- |
| MALL-SPR27-11 | Mall billboard | Large-format exterior facade; player can inspect sponsor details | Preview surface; unsold |
| MALL-SPR27-12 | Street sign | Street-level wayfinding and sponsor-supported destination | Preview surface; unsold |
| MALL-SPR27-13 | On-shelf | Shelf talker / product-facing display with optional virtual trial | Preview surface; unsold |

All three surfaces are accessible through the Mall Walk circle inside the existing single-screen Mallratts game. Placement IDs are stable commercial keys; they do not represent confirmed bookings. Cockpit is responsible for opportunities, proposals, approved creative and campaign status. Mallratts currently shows static demo placeholders only; no authenticated Cockpit publishing connection exists.

## Opportunity fields
opportunity_id, property='Mallratts', season_skin='Spring 2027', placement_ids, sponsor_account, sponsor_contact, owner, stage (idea/qualified/proposed/negotiating/won/lost), proposed_value, currency, estimated_start/end, deliverables, creative_requirements, approval_state, sponsorship_disclosure, reporting_requirements, contract_ref, invoice_ref, source_campaign_id, last_updated.

## Operational flow
1. Add an opportunity to the Cockpit Growth / sponsor pipeline referencing one or more placement IDs.
2. Create a proposal with a placement-specific deliverables list, flight dates, price and any exclusivity.
3. Once contracted and creative-approved, publish a public-only campaign record from Cockpit to Mallratts. Never expose private contacts, contract terms or the Cockpit vault.
4. Mallratts serves labelled inventory from the active skin and emits aggregate delivery events.
5. Cockpit reconciles planned vs delivered placements, proofs, reporting, billing and renewals.
6. Skin changes preserve placement IDs where the surface is equivalent; creative can vary by skin.

## Security and fairness
Use a server-side authenticated bridge with scoped credentials and an explicit allowlist. No browser access to Cockpit secrets. Sponsored providers must not receive preferential game scoring. Actual market news must not be disguised sponsor copy. Public reports are aggregate only. No real rewards without separate compliance.

## Next engineering work
- Identify Cockpit sponsor-assets state shape and current persistence API; add inventory/opportunity data model without overwriting existing sponsors.
- Build authenticated public campaign export endpoint.
- Build Mallratts campaign ingest and event reporting with reconciliation.
- Add Cockpit commercial UI for inventory availability, proposal status and fulfilment.
- Test one dummy sponsor through proposal -> approval -> serve -> proof -> invoice.
