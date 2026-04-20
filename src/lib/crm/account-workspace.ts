export const ACCOUNT_WORKSPACE_TABS = [
  "overview",
  "contacts",
  "opportunities",
  "quotes",
  "shipments",
  "finance",
] as const;

export type AccountWorkspaceTabId = (typeof ACCOUNT_WORKSPACE_TABS)[number];

export function parseAccountWorkspaceTab(value: string | null | undefined): AccountWorkspaceTabId {
  if (value && ACCOUNT_WORKSPACE_TABS.includes(value as AccountWorkspaceTabId)) {
    return value as AccountWorkspaceTabId;
  }
  return "overview";
}

function toTrimmed(value: string): string {
  return value.trim();
}

export function validateAccountSummaryInput(input: {
  name: string;
  industry: string;
}): { ok: true } | { ok: false; error: string } {
  const name = toTrimmed(input.name);
  if (!name) {
    return { ok: false, error: "Account name is required." };
  }
  if (name.length < 2) {
    return { ok: false, error: "Account name must be at least 2 characters." };
  }
  if (toTrimmed(input.industry).length > 80) {
    return { ok: false, error: "Industry must be 80 characters or fewer." };
  }
  return { ok: true };
}

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactCreateInput(input: {
  firstName: string;
  lastName: string;
  email: string;
}): { ok: true } | { ok: false; error: string } {
  const firstName = toTrimmed(input.firstName);
  const lastName = toTrimmed(input.lastName);
  const email = toTrimmed(input.email);

  if (!firstName || !lastName) {
    return { ok: false, error: "First and last name are required." };
  }
  if (firstName.length < 2 || lastName.length < 2) {
    return { ok: false, error: "First and last name must be at least 2 characters." };
  }
  if (email && !SIMPLE_EMAIL_RE.test(email)) {
    return { ok: false, error: "Email must be a valid address." };
  }
  return { ok: true };
}

export function validateQuoteDraftInput(input: {
  title: string;
}): { ok: true } | { ok: false; error: string } {
  const title = toTrimmed(input.title);
  if (!title) {
    return { ok: false, error: "Quote title is required." };
  }
  if (title.length < 6) {
    return { ok: false, error: "Quote title must be at least 6 characters." };
  }
  if (title.length > 140) {
    return { ok: false, error: "Quote title must be 140 characters or fewer." };
  }
  return { ok: true };
}
