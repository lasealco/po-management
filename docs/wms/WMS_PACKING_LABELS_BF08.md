# Packing / labels — BF-08 (GS1 SSCC demo + ship-station ZPL stub)

**Purpose:** Give operators an **integration-shaped path** toward GS1 logistics labels and thermal printers **without** committing to a vendor SDK or scanner hardware in-repo.

**Authority:** Capsule **BF-08** ([`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md)); baseline packing flow ([`WMS_PACKING_LABELS.md`](./WMS_PACKING_LABELS.md)).

---

## What landed

| Capability | Behavior |
|------------|-----------|
| **GS1 Modulo-10 + SSCC-18** | `computeGs1Mod10CheckDigit`, `formatSscc18FromBody17`, `verifyGs1Mod10CheckDigit`, and **demo** `buildSscc18DemoFromOutbound` in [`src/lib/wms/gs1-sscc.ts`](../../src/lib/wms/gs1-sscc.ts). Demo SSCC derives serial digits deterministically from **`outboundId`** + configured company prefix — **not** a substitute for GS1-issued prefix allocation. |
| **ZPL stub** | `buildShipStationZpl` + `downloadZplTextFile` in [`src/lib/wms/ship-station-zpl.ts`](../../src/lib/wms/ship-station-zpl.ts) — minimal `^XA`/`^XZ` label with text block + **Code 128** (`^BC`) payload (SSCC when configured, else outbound number). |
| **Operations UI** | Next to **Print pack slip**: **Download ZPL stub** (always when slip print is allowed). Pack slip adds optional **SSCC (demo)** line when env prefix is set (see below). |

## Configuration (optional demo SSCC)

Set **`NEXT_PUBLIC_WMS_SSCC_COMPANY_PREFIX`** to **7–10 digits** (your GS1 company prefix digits only — demo serial fills the remainder). When unset, ZPL uses **`outboundNo`** as the barcode payload and pack slip omits SSCC.

Example (`.env.local`, digits illustrative):

```bash
# Demo only — 7–10 digit GS1 company prefix for deterministic SSCC-18 on pack slip + ZPL
NEXT_PUBLIC_WMS_SSCC_COMPANY_PREFIX=0614141
```

## Explicit backlog

- USB / Bluetooth **scanner** keystroke wedge or serial integration.
- Production **carrier label** formats (4×6 PDF, vendor APIs) beyond this **stub**.
- **Partial carton** pack lines with distinct SSCC per carton.

_Last updated: 2026-04-29 — BF-08 shipped._
