# Supply Chain Risk Intelligence — Functional PRD

## Main Screens

### Risk Intelligence Dashboard
Main blocks:
- Critical events now
- Watchlist events
- Impacted shipments
- Impacted purchase orders
- Impacted customer orders
- Impacted suppliers
- Impacted inventory / locations
- Suggested actions

### Event Feed
Each event card shows:
- headline
- short summary
- event type
- affected geography / ports / lanes
- source count
- severity
- confidence
- freshness
- impacted internal objects
- recommendation preview

### Event Detail
Sections:
- source summary
- AI summary
- structured event data
- likely impact
- impacted shipments
- impacted POs
- impacted sales orders
- impacted suppliers
- impacted locations
- recommended actions
- audit / review history

### Impact Workspace
Purpose:
- work from event to affected objects

Views:
- shipments
- POs
- customer orders
- suppliers
- sites / warehouses
- SKUs / inventory groups

### Watchlist / Subscription Center
Manage:
- watched countries
- watched ports
- watched suppliers
- watched lanes
- watched products
- watched event categories

### Triage Workspace
Purpose:
- acknowledge event
- assign owner
- mark irrelevant
- escalate
- create task
- launch scenario
- notify stakeholders

### Recommendation Center
Purpose:
- track AI and rule-based action suggestions
- accept / reject / snooze recommendations
- create linked tasks

### Settings / Tuning
Purpose:
- event sensitivity
- severity thresholds
- source trust weights
- geography alias mapping
- alert delivery rules
- object relevance rules

## Primary User Flows
1. User opens dashboard -> sees critical events affecting current network
2. User opens event -> sees internal impact and rationale
3. User opens impacted shipments/orders/POs -> reviews consequences
4. User launches action or scenario
5. User tracks event resolution and follow-up
