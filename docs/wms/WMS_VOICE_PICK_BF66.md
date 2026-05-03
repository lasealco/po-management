# BF-66 — Voice-picking JSON protocol stub (minimal)

**Purpose:** Vendor-neutral **voice task JSON** (`pickSeq`, `confirmSku`, `qtySpoken`, bin + outbound hints) for WMS integrators — **no** speech SDK or headset pairing in-app.

**Authority:** [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-66.

---

## API

| Method | Path | Notes |
|--------|------|--------|
| **GET** | **`/api/wms/voice-pick/session`** | **`org.wms` → view**. Query: **`warehouseId`**, **`waveId`**, **`limit`** (1–100, default 50). Returns **`schemaVersion`** `bf66.v1` and **`picks[]`** (OPEN **PICK** tasks scoped like other WMS task reads). |
| **POST** | **`/api/wms/voice-pick/session`** | **`org.wms` → view** + **`org.wms.operations` → edit** (or legacy **`org.wms` → edit**). Body: **`{ "picks": [{ "taskId", "confirmSku", "qtySpoken" }] }`** (max 80). Confirms SKU/token vs line product (**sku** or **productCode**, case-insensitive) and **`qtySpoken`** vs task quantity; then runs the same stock effect as **`complete_pick_task`**. |

**confirmSku** token on GET is **`product.sku`** if set, else **`product.productCode`**, else first 8 chars of product id.

---

## Out of scope

Speech-to-text, TTS, wearable pairing, partial-pick quantities (voice qty must match task qty).
