import type { z } from "zod";

/**
 * Returns the first human-readable field-level Zod error for known keys,
 * falling back to issue/message text when no keyed field error exists.
 */
export function firstZodFieldError(
  error: z.ZodError,
  orderedFieldKeys: readonly string[],
): string {
  const flat = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  for (const key of orderedFieldKeys) {
    const message = flat[key]?.[0];
    if (message) {
      return message;
    }
  }
  return error.issues[0]?.message ?? error.message;
}
