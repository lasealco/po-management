import type { PrismaClient } from "@prisma/client";

export type ReportColumnFormat = "text" | "number" | "currency" | "date";

export type ReportColumn = {
  key: string;
  label: string;
  format?: ReportColumnFormat;
  align?: "left" | "right";
};

export type ReportResult = {
  reportId: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  generatedAt: string;
};

export type ReportParamSpec =
  | {
      name: string;
      label: string;
      type: "date";
      optional?: boolean;
    }
  | {
      name: string;
      label: string;
      type: "select";
      optional?: boolean;
      options: { value: string; label: string }[];
    };

export type ReportContext = {
  tenantId: string;
  prisma: PrismaClient;
};

export type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  category: "orders" | "logistics" | "planning";
  /** Extra grants beyond org.reports → view (e.g. org.orders → view). */
  requires?: { resource: string; action: string }[];
  params?: ReportParamSpec[];
  run: (
    ctx: ReportContext,
    params: Record<string, unknown>,
  ) => Promise<Omit<ReportResult, "reportId" | "generatedAt">>;
};

export type ReportListItem = Pick<
  ReportDefinition,
  "id" | "title" | "description" | "category" | "params"
>;
