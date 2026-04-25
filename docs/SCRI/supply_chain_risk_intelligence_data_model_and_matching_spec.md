# Supply Chain Risk Intelligence — Data Model and Matching Specification

## Core Entities

### External Event
Fields:
- event_id
- event_type
- title
- short_summary
- long_summary
- event_time
- discovered_time
- severity
- confidence
- status
- source_count
- source_trust_score
- ai_summary
- structured_payload

### Event Source
Fields:
- source_id
- event_id
- source_type
- publisher
- url
- headline
- published_at
- extracted_text
- extraction_confidence

### Event Geography
Fields:
- event_geo_id
- event_id
- country
- region
- port
- inland point
- lane
- coordinates if relevant

### Event Affected Entity
Links event to internal objects:
- affected_id
- event_id
- object_type
- object_id
- match_type
- match_confidence
- impact_level
- rationale

### Watchlist Rule
Fields:
- watchlist_id
- tenant
- user/team scope
- watch_type
- watch_value
- priority

### Recommendation
Fields:
- recommendation_id
- event_id
- target_object_type
- target_object_id
- recommendation_type
- priority
- confidence
- expected_effect
- status

### Event Review / Triage
Fields:
- review_id
- event_id
- decision
- owner
- note
- reviewed_at

### Event Task Link
Fields:
- task_link_id
- event_id
- task_ref
- source_module
- status

## Matching Logic Dimensions
### Geography Match
- country
- region
- port
- airport
- rail ramp
- inland zone
- warehouse location

### Supply Match
- supplier legal entity
- supplier site
- factory / origin region
- approved supplier location

### Flow Match
- shipment route
- POL/POD
- transport lane
- trade corridor
- route segment

### Demand / Inventory Match
- SKU / product family
- inventory node
- customer order dependency
- critical stock coverage

## Matching Rules
- use deterministic matching first
- AI may enrich relevance, not replace structured matching
- every match should store rationale
- low-confidence matches should be visible as tentative
