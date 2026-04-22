# Guided import — dogfood checklist

Use this to walk **`/apihub`** (guided import home) end-to-end with **redacted** data (no live customer IDs, rates, or credentials). The legacy URL `/apihub/import-assistant` redirects to `/apihub`.

## Preconditions

- Demo session: **Settings → Demo session** — pick a user with **`org.apihub` → view + edit** (analysis, template, staging actions require edit).
- Optional chat: set **`APIHUB_OPENAI_API_KEY`** or **`OPENAI_API_KEY`** on the server; without it, chat returns a fallback message (flow on the left still works).
- Local app: `npm run dev`, open `/apihub`. Operator console (manual): `/apihub/workspace`.

## Fixtures (copy or upload)

| File | Path |
|------|------|
| JSON array | [`fixtures/import-assistant-redacted-sample.json`](./fixtures/import-assistant-redacted-sample.json) |
| CSV | [`fixtures/import-assistant-redacted-sample.csv`](./fixtures/import-assistant-redacted-sample.csv) |
| XML (repeated siblings → rows) | [`fixtures/import-assistant-redacted-sample.xml`](./fixtures/import-assistant-redacted-sample.xml) |

## Steps (expected)

1. **Purpose** — Choose **Shipments and visibility** (or another card on purpose).
2. **Upload** — Use a fixture file; optional note in “documentation” (the persisted analysis job **note** is capped at **4000** characters server-side).
3. **Confirm** — Complete the keyword check (keep or switch category if prompted).
4. **Analyze** — **Run analysis**; if status stays **queued**, use **Process now** (same as the mapping analysis jobs panel).
5. **Review** — Check **Origin → destination** rows and confidence badges; if any **Confirm with you**, tick the acknowledgment before **Save as mapping template** or **Materialize staging batch** (optional).
6. **Connection** — Read connector guidance; verify **Connectors** / **Mapping templates** links on the hub.

## Side panel chat

- Send a question after step 1; confirm the reply references your **step** and does not invent saved templates unless you completed step 5.
- With no API key, confirm **fallback** messaging is clear.

## Gaps to note (current limitations)

- **CSV**: simple comma split only (no quoted commas); use numeric amounts without thousands separators in fixtures.
- **XML**: generic browser parse; deep or heavily namespaced CargoWise exports may need a dedicated normalizer later.
- **Documentation**: very long excerpts may still be truncated to the analysis **note** cap (**4000** chars); chat context can include a separate excerpt and is not stored on the job row.

Record any new gaps in **`docs/apihub/GAP_MAP.md`** or your issue tracker with repro file shape (redacted).
