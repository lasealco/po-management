# SRM-related Prisma migrations (reference)

Apply the **full** migration chain with `npm run db:migrate` / `prisma migrate deploy`. This file lists **supplier / SRM** migrations in **lexicographic apply order** (Prisma folder timestamps) so reviewers can confirm dependencies and hygiene without opening every SQL file.

## Core supplier master extensions (historical)

| Folder | Summary |
|--------|---------|
| `20260409140000_supplier_extended_details` | Extended supplier profile columns (pre-SRM tabs). |

## SRM foundation (directory, 360, lifecycle)

| Folder | Summary |
|--------|---------|
| `20260417150000_supplier_srm_category_approval` | `srmCategory`, `approvalStatus` on `Supplier`. |
| `20260417200000_booking_first_lifecycle` | `Supplier.bookingConfirmationSlaHours` (logistics booking confirmation SLA). |
| `20260418180000_supplier_service_capability` | `SupplierServiceCapability` (scoped capabilities). |
| `20260418190000_supplier_onboarding_task` | `SupplierOnboardingTask` checklist rows. |
| `20260418210000_supplier_qualification_srm` | Qualification fields on `Supplier`. |

## Compliance, evidence, and workspace extensions

| Folder | Summary |
|--------|---------|
| `20260418230000_supplier_compliance_performance_risk` | Compliance reviews, scorecards, risk records. |
| `20260418240000_supplier_document_srm` | `SupplierDocument` register (categories, URL metadata). |
| `20260418250000_supplier_relationship_note_srm` | `SupplierRelationshipNote`. |
| `20260418260000_supplier_contract_record_srm` | `SupplierContractRecord`. |
| `20260418270000_supplier_srm_alert` | `SupplierSrmAlert` (manual buyer alerts). |
| `20260418280000_supplier_document_expires_at` | `SupplierDocument.expiresAt` + index. |
| `20260418290000_supplier_document_archived_at` | `SupplierDocument.archivedAt` + index. |

## Cross-cutting (supplier linkage outside SRM UI)

| Folder | Summary |
|--------|---------|
| `20260416194500_ct_supplier_refs_for_legs_costs` | Control Tower legs/cost lines reference suppliers. |
| `20260416213000_shipment_carrier_supplier_ref` | Shipments reference carrier supplier. |

Do **not** add parallel “fix-up” migrations for the same column without a deliberate squash/rebase plan; prefer one additive migration per schema slice.
