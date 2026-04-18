/**
 * `/reporting?focus=…` deep links for the cross-module hub (scroll-to-card).
 * Must stay aligned with `help-actions` `REPORTING_FOCUS`: `po` | `control-tower` | `crm` | `wms`.
 */
export const REPORTING_HUB_FOCUS_PO_HREF = "/reporting?focus=po" as const;
export const REPORTING_HUB_FOCUS_CRM_HREF = "/reporting?focus=crm" as const;
export const REPORTING_HUB_FOCUS_WMS_HREF = "/reporting?focus=wms" as const;

/** Control Tower card on the reporting hub. */
export const REPORTING_HUB_CONTROL_TOWER_HREF = "/reporting?focus=control-tower" as const;
