import { TariffApprovalStatus, TariffContractStatus, TariffTransportMode } from "@prisma/client";

/** Use for API/body validation — stays aligned with Prisma enums. */
export const TARIFF_TRANSPORT_MODE_SET = new Set<string>(Object.values(TariffTransportMode));

export const TARIFF_CONTRACT_HEADER_STATUS_SET = new Set<string>(Object.values(TariffContractStatus));

export const TARIFF_APPROVAL_STATUS_SET = new Set<string>(Object.values(TariffApprovalStatus));
