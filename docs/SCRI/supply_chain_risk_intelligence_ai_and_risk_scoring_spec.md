# Supply Chain Risk Intelligence — AI and Risk Scoring Specification

## AI Functions

### 1. Event Classification
AI classifies incoming content into:
- event family
- severity candidate
- likely affected logistics mode
- likely duration
- likely disruption type

### 2. Summarization
AI produces:
- short headline summary
- operator summary
- executive summary
- why this may matter

### 3. Relevance Enrichment
AI helps infer:
- likely related ports
- supplier/site aliases
- route implications
- probable consequence patterns

### 4. Recommendation Generation
AI suggests:
- monitor only
- notify owner
- escalate supplier
- create scenario
- trigger alternate RFQ
- review affected customer orders
- replan stock

## Risk Scoring Dimensions
- event severity
- source trust
- recency
- geography proximity
- actual internal exposure
- object criticality
- inventory buffer
- customer/revenue importance
- historical disruption pattern

## Output Rules
Every risk event should distinguish:
- known facts
- AI inference
- internal exposure match
- recommendation

## Guardrails
- do not fabricate impacted internal objects
- do not present low-confidence inference as confirmed fact
- always provide source trace and rationale
- permission filters apply to all AI outputs
