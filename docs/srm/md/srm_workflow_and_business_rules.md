# SRM Workflow and Business Rules

## Business Rules

### Single source of truth
Supplier code and master record are unique; duplicates must be reviewed before creation.

### Activation
Supplier cannot be activated without mandatory onboarding items complete.

### Conditional approvals
Supplier may be active only for approved categories/geographies while other scopes remain blocked.

### Expiry logic
Critical documents create alerts and may suspend supplier automatically or conditionally based on rule.

### Review cadence
Strategic suppliers require periodic reviews; failure to review creates alerts/tasks.

### Risk escalation
High risk or critical incidents trigger management review and may restrict usage.

### Change control
Certain fields such as bank data, legal entity, tax ID, and contract summary require approval.

### Auditability
All approvals, rejections, suspensions, reinstatements, and major field changes must be logged.

### Issue remediation
Major incidents should generate corrective-action items with owner and due date.

## Approval Paths
- New supplier approval by category/region
- Critical document approval
- Banking detail change approval
- Suspension and reinstatement approval
- Preferred supplier designation approval
- High-risk supplier exception approval
