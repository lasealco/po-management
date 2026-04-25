# Cursor Supply Chain Risk Intelligence Prompt Sequence

## Prompt 1 — inspect repo
Inspect the current codebase and propose a Phase 1 implementation plan for Supply Chain Risk Intelligence only:
- where it should live
- which current modules it should read from
- what auth / permission patterns it should reuse
- what to build first

## Prompt 2 — schema and event model
Create schema/migrations for:
- external events
- event sources
- event geographies
- event affected entities
- watchlist rules
- recommendations
- reviews / triage
- task links

## Prompt 3 — ingestion foundation
Build source ingestion and event clustering/deduplication scaffolding.

## Prompt 4 — relevance engine
Build geography / supplier / lane / shipment / PO / order matching logic.

## Prompt 5 — dashboard and feed
Build the risk dashboard, event feed, and event detail page.

## Prompt 6 — triage workflow
Build owner assignment, watch/dismiss/action-required states, and task linking.

## Prompt 7 — AI summarization and rationale
Build grounded AI summaries and explanation blocks.

## Prompt 8 — recommendation layer
Build recommendation generation, review, and acceptance/rejection flow.

## Prompt 9 — twin integration
Build launch-to-scenario hooks and event-to-scenario seed behavior.
