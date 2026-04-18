# SRM Data Model and ER Specification

## Core Entities

### Supplier
Master record.
Key fields:
- supplier_id
- code
- legal_name
- trading_name
- status
- strategic_tier
- owner_user_id

### Supplier Entity
Subsidiary / branch / legal entity layer.
Key fields:
- entity_id
- supplier_id
- country
- tax_id
- address
- active_flag

### Supplier Contact
Contacts by function.
Key fields:
- contact_id
- supplier_id/entity_id
- name
- role
- email
- phone
- escalation_flag

### Supplier Category
Service categories and capabilities.
Key fields:
- cat_link_id
- supplier_id
- mode
- sub_mode
- service_type
- geography

### Qualification Record
Assessment result by category/lane.
Key fields:
- qual_id
- supplier_id
- category
- scope
- status
- valid_until

### Document Record
Uploaded file metadata.
Key fields:
- document_id
- supplier_id
- doc_type
- expiry_dt
- approval_status
- version_no

### Compliance Check
Sanctions/watchlist/licence/insurance checks.
Key fields:
- check_id
- supplier_id
- check_type
- result
- check_dt
- next_due_dt

### Contract Summary
Commercial term header.
Key fields:
- contract_id
- supplier_id
- valid_from
- valid_to
- payment_terms
- notes

### Performance Snapshot
KPI score result for period.
Key fields:
- snapshot_id
- supplier_id
- period
- score_total
- score_otif
- score_claims

### Risk Assessment
Structured risk record.
Key fields:
- risk_id
- supplier_id
- risk_type
- score
- severity
- mitigation
- review_dt

### Review Meeting
QBR / annual review record.
Key fields:
- review_id
- supplier_id
- review_type
- date
- owner
- summary

### Action Plan Item
Improvement / remediation task.
Key fields:
- action_id
- supplier_id
- source_type
- owner
- due_dt
- status

### Audit Record
Field and approval traceability.
Key fields:
- audit_id
- object_type
- object_id
- action
- user_id
- ts

## Relationship Notes
- One supplier may have multiple entities in different countries.
- One supplier may be approved for some categories/languages/lanes and restricted for others.
- Documents may attach at supplier or entity level.
- Performance and risk should be time-series capable, not only current-state fields.
- Review and action-plan records should stay linked to supplier history for audit and improvement tracking.
