# Supply Chain Risk Intelligence — Blueprint and Module Definition

## 1. Product Vision
Build a module that continuously monitors external world events and translates them into actionable supply-chain risk intelligence.

The module should answer:
- what happened
- why it matters
- who and what in our network may be affected
- what the likely impact is
- what users should do next

## 2. What the Module Is
The module is:
- an external event monitor
- a supply-chain relevance engine
- an internal exposure matcher
- a risk scoring layer
- a recommendation layer

The module is not:
- a generic news site
- a replacement for Control Tower
- a replacement for the Supply Chain Twin
- a broad market research portal

## 3. Event Families
### Logistics / Infrastructure
- port congestion
- terminal closure
- vessel backlog
- rail disruption
- trucking restrictions
- airport disruption
- canal blockage
- route suspension

### Weather / Natural Events
- typhoons
- floods
- earthquakes
- wildfire
- drought affecting waterways
- severe winter storms

### Geopolitical / Trade
- sanctions
- tariffs
- war / escalation
- border closure
- customs restrictions
- trade compliance changes

### Labor / Social
- strikes
- protests
- labor shortages
- union action
- civil unrest

### Supplier / Industrial
- factory shutdown
- bankruptcy
- capacity loss
- major operational incident
- contamination / recall
- power shortage

### Public Health / Regulatory
- quarantine
- epidemic controls
- sudden inspections
- new documentation rules

## 4. Main Value
- reduce surprise
- shorten reaction time
- make news relevant to live operations
- connect external risk to real shipments, orders, suppliers, and inventory
- enable better prioritization and scenario planning

## 5. Design Principles
- every event should show source grounding
- every event should show confidence and severity
- relevance to the customer network matters more than article volume
- explain why the event is considered relevant
- let users dismiss, watch, escalate, or act
