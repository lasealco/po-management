# Supply Chain Risk Intelligence — Workflow and Business Rules

## Workflow Stages
1. detect event
2. classify event
3. deduplicate / cluster event
4. calculate internal relevance
5. score severity and impact
6. generate recommendations
7. present to dashboard / alerts
8. triage and assign
9. link to tasks / scenarios / exceptions
10. monitor resolution

## Business Rules
- one real-world event may have multiple source articles but should become one event cluster
- not every event should create alerts; only relevant and material events should
- event relevance must be explainable
- dismissed events should still be historically auditable
- events can be reopened if severity or relevance changes
- recommendations should be reviewable, not silently executed in early phases

## Review States
- new
- under review
- watch
- action required
- dismissed
- resolved

## Priority Rules
Priority should consider:
- severity
- internal exposure
- object criticality
- timing urgency
- confidence

## Data Freshness Rules
- stale events should decay in prominence
- resolved or outdated events should move to archive / history views
