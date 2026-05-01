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

/** BF-19 — optional WGS84 pair for Control Tower map pins; both blank clears stored coordinates. */
export function validateAccountMapGeoPair(latStr: string, lngStr: string):
  | { ok: true; lat: null; lng: null }
  | { ok: true; lat: number; lng: number }
  | { ok: false; error: string } {
  const lt = latStr.trim();
  const lg = lngStr.trim();
  if (!lt && !lg) return { ok: true, lat: null, lng: null };
  if (!lt || !lg) {
    return {
      ok: false,
      error: "Enter both latitude and longitude (WGS84), or leave both blank to remove the map pin.",
    };
  }
  const lat = Number(lt);
  const lng = Number(lg);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "Latitude and longitude must be valid numbers." };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      ok: false,
      error: "Latitude must be between −90 and 90; longitude between −180 and 180.",
    };
  }
  return { ok: true, lat, lng };
}
