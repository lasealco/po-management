# SRM Integration and API Payload Pack

## Likely Integrations

### Control Tower / TMS
Typical data:
- performance events
- shipment counts
- carrier use
- incident data
- milestone quality

### Finance / ERP
Typical data:
- spend
- payment behavior
- invoice disputes
- supplier master sync

### Tender / Tariff modules (future)
Typical data:
- approved suppliers
- commercial scope
- contract references
- awarded lanes/categories

### Document systems
Typical data:
- contract and compliance file storage

### Sanctions / compliance tools
Typical data:
- watchlist and screening results

### Email / workflow tools
Typical data:
- approval notices
- document requests
- escalation notifications

## Payload Families

### Supplier Master Upsert
Minimum fields:
- supplier_code
- legal_name
- entity
- country
- category
- status

### Performance Snapshot
Minimum fields:
- supplier_code
- period
- KPI values
- source
- calculated score

### Incident Feed
Minimum fields:
- supplier_code
- incident_type
- date
- severity
- related shipment/job refs

### Document Metadata
Minimum fields:
- supplier_code
- doc_type
- file_ref
- expiry_dt
- version
- approval_status

### Spend Snapshot
Minimum fields:
- supplier_code
- period
- amount
- currency
- category
- office

### Risk / Screening Result
Minimum fields:
- supplier_code
- check_type
- result
- review_dt
- next_due_dt

## Integration Rules
- Keep master ownership rules clear for supplier code and legal entity fields.
- Time-series KPI data should be ingested without overwriting history.
- Document metadata and business files should stay linked but separable.
- Failures in inbound sync must route to visible exceptions rather than silent loss.
