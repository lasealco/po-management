export type SupplierOnboardingTaskStatusUi = "pending" | "done" | "waived";

export type SupplierOnboardingTaskRow = {
  id: string;
  taskKey: string;
  label: string;
  sortOrder: number;
  status: SupplierOnboardingTaskStatusUi;
  notes: string | null;
  completedAt: string | null;
};
