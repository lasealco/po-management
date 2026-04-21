# Prisma model catalog (auto-generated)

Generated from `prisma/schema.prisma` — **111** models. For relationships and columns, open the schema or the overview diagram in this folder.

| Module (presentation grouping) | Models |
| --- | --- |
| Tenancy & identity | `Role`, `RolePermission`, `Tenant`, `User`, `UserPreference`, `UserRole` |
| Suppliers & products | `Product`, `ProductCategory`, `ProductDivision`, `ProductDocument`, `ProductSupplier`, `Supplier`, `SupplierContact`, `SupplierOffice`, `SupplierServiceCapability` |
| Workflow engine | `Workflow`, `WorkflowAction`, `WorkflowStatus`, `WorkflowTransition` |
| Orders & logistics execution | `OrderChatMessage`, `OrderTransitionLog`, `PurchaseOrder`, `PurchaseOrderItem`, `SalesOrder`, `Shipment`, `ShipmentBooking`, `ShipmentItem`, `ShipmentMilestone` |
| Orders & consolidation | `LoadPlan`, `LoadPlanShipment`, `SplitProposal`, `SplitProposalLine` |
| WMS & warehouses | `InventoryBalance`, `InventoryMovement`, `OutboundOrder`, `OutboundOrderLine`, `ReplenishmentRule`, `Warehouse`, `WarehouseBin`, `WarehouseZone`, `WmsBillingEvent`, `WmsBillingInvoiceLine`, `WmsBillingInvoiceRun`, `WmsBillingRate`, `WmsTask`, `WmsWave` |
| Control Tower | `CtAlert`, `CtAuditLog`, `CtContainerCargoLine`, `CtDashboardWidget`, `CtException`, `CtExceptionCode`, `CtFxRate`, `CtMilestoneTemplatePack`, `CtReportSchedule`, `CtSavedFilter`, `CtSavedReport`, `CtShipmentContainer`, `CtShipmentCostLine`, `CtShipmentDocument`, `CtShipmentFinancialSnapshot`, `CtShipmentLeg`, `CtShipmentNote`, `CtShipmentReference`, `CtTrackingMilestone` |
| CRM | `CrmAccount`, `CrmActivity`, `CrmContact`, `CrmLead`, `CrmOpportunity`, `CrmQuote`, `CrmQuoteLine` |
| Tariffs & contracts | `TariffApprovalRecord`, `TariffAuditLog`, `TariffChargeAlias`, `TariffChargeLine`, `TariffContractHeader`, `TariffContractVersion`, `TariffFreeTimeRule`, `TariffGeographyGroup`, `TariffGeographyMember`, `TariffImportBatch`, `TariffImportStagingRow`, `TariffLegalEntity`, `TariffNormalizedChargeCode`, `TariffProvider`, `TariffRateLine`, `TariffShipmentApplication` |
| RFQ | `QuoteClarificationMessage`, `QuoteRequest`, `QuoteRequestRecipient`, `QuoteResponse`, `QuoteResponseLine` |
| Pricing snapshots | `BookingPricingSnapshot` |
| Invoice audit | `InvoiceAuditResult`, `InvoiceChargeAlias`, `InvoiceIntake`, `InvoiceLine`, `InvoiceToleranceRule` |
| Integrations (API hub) | `ApiHubConnector`, `ApiHubConnectorAuditLog`, `ApiHubIngestionRun` |
| Supply Chain Twin | `SupplyChainTwinEntityEdge`, `SupplyChainTwinEntitySnapshot`, `SupplyChainTwinIngestEvent`, `SupplyChainTwinRiskSignal`, `SupplyChainTwinScenarioDraft` |
| Reference data (global) | `ReferenceAirline`, `ReferenceCountry`, `ReferenceOceanCarrier` |
| Other / shared | `LocationCode` |

---

_Regenerate: `node scripts/generate-presentation-model-catalog.mjs`_
