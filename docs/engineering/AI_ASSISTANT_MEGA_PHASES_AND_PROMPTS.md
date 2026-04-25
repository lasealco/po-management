# AI Assistant — what to ask for, and “mega-phases” (UI-first, long runs)

**Purpose:** Fix a real problem: *strategy docs and micro-slices are hard to “prompt,”* and **you** mainly validate **the product when you can see and click it**. This document defines (1) **how to prompt** the implementation agent, (2) **big phases** the agent can execute **without** waiting for you on every sub-task, and (3) **Mega-Phase 1** in enough detail to build toward your **“John at ABC, corr-roll, $100, pickup Tuesday”** story.

**Audience:** You (product owner) + anyone implementing in Cursor.  
**Last updated:** 2026-04-23

**Related:** [`AI_ASSISTANT_UX_GTM_AND_DELIVERY_PLAN.md`](./AI_ASSISTANT_UX_GTM_AND_DELIVERY_PLAN.md) (narrative + workstreams), [`PLATFORM_AI_FIRST_OPERATIONS_ROADMAP.md`](./PLATFORM_AI_FIRST_OPERATIONS_ROADMAP.md) (platform strategy).

---

## 1. The rule you asked for: **UI first, then you comment**

| Order | You approve best | We implement when |
|-------|------------------|-------------------|
| **1** | **Visible UI** that *does something* (even stubbed) | You can say “yes / move this / that’s wrong” |
| **2** | **End-to-end click path** (assistant → draft or clarify → open real screen) | You can run scenarios like the John/ABC text |
| **3** | **Backend depth** (polish, scale, more tools) | After the UI story is right |

**Implication for prompts:** ask for **screens and behavior** first; don’t start with “refactor the whole API” unless the UI is already there.

---

## 2. What to type (copy-paste prompts)

Use **one** of these. They are designed so the implementer (human or agent) does **not** need a meeting between each step.

### A. Start a mega-phase (long, autonomous block)

> **“Execute [Mega-Phase N] as defined in `docs/engineering/AI_ASSISTANT_MEGA_PHASES_AND_PROMPTS.md`. UI-first, follow exit criteria, commit and push when done. If something is blocked, make the smallest stub that still demos and note it in the doc changelog.”**

### B. You only have UI feedback (after trying the build)

> **“I tested the assistant UI. Change only these things: [list]. Keep Mega-Phase N scope; don’t expand backend.”**

### C. You want the next mega-phase

> **“Mega-Phase N is good enough. Proceed to Mega-Phase N+1 from the same doc.”**

### D. You want to reprioritize (still big chunks)

> **“Pause Mega-Phase N. Instead ship [one sentence outcome] as an interim: [constraints].”**

### E. You are only giving a **scenario** to test (after MP1 exists)

> **“Use this as the acceptance test: [paste natural-language scenario]. The UI must either create a draft, or ask a clear clarifying question (e.g. which account).”**

**You do *not* need to know our internal slice names** if you use **A** or **C** with the doc path.

---

## 3. Mega-phases (large enough to work in peace)

**Mega-phase** = one **review gate** (you: “yes / no / adjust UI”). Inside a mega-phase, implementation can be **days** of work without daily input.

| Mega-phase | Theme | You validate when… |
|------------|--------|---------------------|
| **MP1** | **Demo shell + one real commercial path** (natural language → **clarify** or **SO draft** + open record) | You can type the **John / ABC / corr-roll** story and get a **sensible** result in the app |
| **MP2** | **Attention** — “what needs me” (MVP inbox or unified list) + assistant entry always visible in shell | You see **open items** and can clear them from one place |
| **MP3** | **Deepen the golden path** — inventory / product trace / stock checks in assistant answers (still human-gated commits) | Scenarios from the platform doc (stock yes/no, “where is it,” etc.) **show** in UI with **links to evidence** |
| **MP4** | **Email (optional, flagged)** — inbound thread → inbox item, **confirm before send** for replies | You can run a **pilot** with your mailbox without fear of silent send |

*Docs and small fixes can happen anytime; they are not a substitute for **MP1** if your goal is “I can *see* it.”*

---

## 4. Mega-Phase 1 (MP1) — detailed spec for implementers

**Goal:** A **dedicated, presentable** assistant experience in the app where you paste **free text** (or type it) and the system **either** (a) **asks a clear clarifying question**, or (b) **creates a sales-order draft** (or the closest real step the product supports today) and **takes you to the record**.

### 4.1 User scenario (acceptance)

**Input (example you gave):**  
*“John from ABC customer called and wants 100 corr-roll for 100 USD a piece. He will send a truck to pick up at our demo warehouse next week Tuesday.”*

**Expected behavior (MVP, honest):**

1. **Parse intent** (rule-based, LLM, or hybrid): customer hint “ABC,” contact “John,” product hint “corr-roll,” qty 100, unit price 100 USD, **pickup** at **demo warehouse**, **date** = next Tuesday (resolved relative to *today* in session).  
2. If **multiple** CRM accounts could be “ABC” (e.g. Delaware vs New York), **do not guess**: show a **short disambiguation** in the UI (“Which account do you mean?”) with **choices**.  
3. If **product** is ambiguous, same: ask which SKU/product, or show top matches.  
4. If **enough** is resolved, **create the real object** the product already supports: prefer **`POST /api/sales-orders`** (or the existing create flow) so a **real** SO exists in the tenant, then **navigate** to `/sales-orders/{id}` (or open **create** with **prefill** if full create in one step is not yet supported in API).  
5. If the API cannot create lines in one shot, it is acceptable to **land on the new SO** with **header** filled and a visible note “Add lines in the form below” — as long as the **user sees** the result of the assistant, not a dead end.  
6. **Trust:** show a **summary card** of what was understood ( entities + numbers + **links** to customer/product if resolved).

**Non-goals for MP1:** full email integration, full inventory automation, unapproved outbound email, **silent** auto-send.

### 4.2 UI (must-haves for your “yes, that’s it”)

- A **real route** in the app (e.g. `/assistant` or `/lab/assistant` — name is an implementation choice) with:
  - **Transcript** or **turn list** (user message + system reply).
  - **Clarification** as **buttons or dropdowns** when possible, not only free text.
  - **“Proposed action”** card: customer, product, qty, price, date, **warehouse** — with **Open sales order** / **Edit before commit** (copy should match GTM plan).
- **Layout:** **split** or **docked** — you can still see **enough** of the “evidence” (principles in GTM doc), not a blank full-screen.
- **Global entry (lightweight in MP1):** at minimum a **nav link** from the main shell or platform hub; **optional:** persistent top bar in a follow-up if MP1 is large.

### 4.3 Technical notes (so implementers don’t thrash)

- Reuse **demo tenant** / existing **CRM account** and **product** lists (`SalesOrderCreateForm` data patterns, `GET` loaders similar to `sales-orders/new`).  
- **Idempotency:** “Create again” on the same text should not create 10 SOs without warning — OK to **confirm** “Create another order?” in MP1.  
- **LLM** is **optional** for MP1: a **clear** path is **heuristic + disambiguation UI**; add LLM when it improves **extraction** without hiding errors.

### 4.4 Exit criteria (MP1 = done for your review)

- [ ] You can open the new screen **without** Postman.  
- [ ] You can run the **John/ABC** scenario and see **either** targeted questions **or** a **created** SO (or defensible prefill + next step).  
- [ ] No **critical** path requires reading code to “imagine” the product.  
- [ ] Changelog in **this** file or the GTM doc: **1 line** on what shipped.

### 4.5 What you say when MP1 is “good enough”

> **“MP1 signed off. Proceed to MP2.”**  
(Or: **B** from section 2 with a short list of UI tweaks, then “Proceed to MP2.”)

---

## 5. What you should **not** have to do

- Invent **internal** phase IDs for every small PR. Use **“Execute MP1 from doc …”** instead.  
- Wait for every backend refactor before **one** testable screen.  
- Write technical specs from scratch: **point at this file** and add **one** scenario at a time (section 2E).

---

## 6. Changelog

| Date | Change |
|------|--------|
| 2026-04-23 | **MP1 shipped:** `/assistant` split UI (conversation + proposed action), heuristic `parse-sales-order-intent` API, CRM/product disambiguation, `POST /api/sales-orders` with optional `notes`, nav + platform hub entry. |
| 2026-04-23 | Initial: UI-first rule, copy-paste prompts, MP1–MP4, full MP1 spec (John/ABC/corr-roll). |
