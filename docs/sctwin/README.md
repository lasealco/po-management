# AI-Driven Supply Chain Twin — Developer Documentation Pack

This pack is the developer-ready documentation set for building the **AI-Driven Supply Chain Twin** module.

**Terms:** [Twin glossary](./glossary.md) (entity snapshot, edge, ingest event, scenario draft, risk signal, readiness).

## Module Positioning
The Supply Chain Twin is a cross-module intelligence layer that sits above:
- PO Management
- Sales Orders
- WMS
- Control Tower
- CRM
- SRM
- Tariff / RFQ / Invoice Audit

It is **not** a separate transactional system. It is the live digital model of supply, demand, inventory, transport, cost, and risk — with AI services on top.

## Recommended Build Order
1. Twin object model and graph relationships
2. Event / ingestion layer
3. Current-state and expected-state engine
4. Risk and KPI calculations
5. AI assistant / query layer
6. Prediction services
7. Recommendation engine
8. Scenario engine
9. Action / task orchestration
