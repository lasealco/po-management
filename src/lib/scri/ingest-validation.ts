import type { z } from "zod";

export type ZodApiValidationExtra = {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
  issues: z.ZodError["issues"];
};

/** Stable across Zod 3/4 without relying on `flatten()` typing. */
export function zodValidationApiExtra(error: z.ZodError): ZodApiValidationExtra {
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];
  for (const issue of error.issues) {
    if (issue.path.length === 0) {
      formErrors.push(issue.message);
      continue;
    }
    const path = issue.path.map(String).join(".");
    const list = fieldErrors[path] ?? [];
    list.push(issue.message);
    fieldErrors[path] = list;
  }
  return {
    fieldErrors,
    formErrors,
    issues: error.issues,
  };
}

export function zodValidationSummary(error: z.ZodError): string {
  const parts = error.issues.map((i) =>
    i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
  );
  return parts.length ? parts.join("; ") : "Validation failed.";
}
