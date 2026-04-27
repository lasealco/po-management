# AI Assistant — what to ask for, and “mega-phases” (UI-first, long runs)

**Purpose:** Fix a real problem: *strategy docs and micro-slices are hard to “prompt,”* and **you** mainly validate **the product when you can see and click it**. This document defines (1) **how to prompt** the implementation agent, (2) **big phases** the agent can execute **without** waiting for you on every sub-task, and (3) **Mega-Phase 1** in enough detail to build toward your **“John at ABC, corr-roll, $100, pickup Tuesday”** story.

**Audience:** You (product owner) + anyone implementing in Cursor.  
**Last updated:** 2026-04-25 (MP5-MP8)

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
| **MP5** | **Email-to-action** — copy/paste inbound → create draft SO or reply from one panel | You can import a message, see the detected action, and create/open the draft SO |
| **MP6** | **Playbook runner** — visible steps for email order/reply work | You see review → detect → create → reply as a guided flow, not hidden automation |
| **MP7** | **Object timeline** — assistant actions are traceable on the real record | A draft SO shows which email/action created it and links back to the source |
| **MP8** | **Embedded entry points** — assistant launch cards on key detail pages | Product, shipment, and SO pages can open the assistant with contextual prompts |
| **MP9** | **Docked assistant everywhere** — answer from object pages without leaving context | Product, shipment, and SO pages can answer in an in-page drawer with evidence links |
| **MP10** | **Human-approved actions** — suggested actions are explicit, reviewable, and never silent | The dock proposes open/copy actions and the user must click before anything happens |
| **MP11** | **Reusable playbooks** — common workflows appear as guided steps | SO follow-up and shipment triage show step-by-step playbooks tied to actions |
| **MP12** | **Cross-object impact answers** — product risk/impact spans modules | Product impact answers link stock, POs, shipments, and sales orders with playbooks/actions |
| **MP13** | **Proactive assistant inbox** — open work includes suggested next actions | Inbox items explain what to do next and link directly to the right workspace/tab |
| **MP14** | **AI quality, audit, and feedback** — grounding is visible and feedback is captured | Docked answers show source grounding, limitations, timestamp, and feedback controls |
| **MP15** | **Persistent AI audit log** — answers survive reloads | Docked answers create durable audit rows with prompt, message, evidence, quality, object context, and actor |
| **MP16** | **Feedback analytics foundation** — answer feedback is saved | Helpful / Needs review updates persist on the audit event |
| **MP17** | **Action execution queue** — proposed actions become reviewable work | Dock actions can be queued and marked done after the user opens/copies them |
| **MP18** | **Assistant memory per object** — object pages remember prior assistant work | The dock shows prior assistant answers for the same sales order, shipment, product, or PO |
| **MP19** | **Playbook completion tracking** — playbook steps persist | Dock playbooks create runs and let users mark steps done or needing review |
| **MP20** | **Cross-workspace command center** — assistant work is visible in one place | A command center summarizes inbox work, action queue, playbooks, feedback, and recent memory |
| **MP21** | **Feedback analytics dashboard** — quality signals are operational | Helpful vs needs-review counts and recent review-needed answers are visible |
| **MP22** | **Action queue workbench** — queued assistant actions can be triaged | Pending / completed action rows are visible with source context and open links |
| **MP23** | **Playbook operations board** — active guided workflows are trackable | Active and completed playbook runs are listed with object context |
| **MP24** | **Assistant ops health snapshot** — AI layer has a simple operating picture | The command center exposes audit volume, grounding coverage, action backlog, and stale playbooks |
| **MP25** | **Priority lanes** — assistant work is ranked by urgency | The command center separates urgent, active, and follow-up work with counts and examples |
| **MP26** | **Object coverage map** — assistant activity is visible by business object | You can see which object types have memory, queued actions, or playbooks attached |
| **MP27** | **Automation readiness** — safe next automations are measurable | The command center shows pending vs completed actions and candidate action kinds for future automation |
| **MP28** | **Review queue** — weak answers and stale playbooks are one queue | Needs-review answers, stale playbooks, and unreviewed memory are grouped for cleanup |
| **MP29** | **Executive assistant brief** — ops status can be copied out | A concise command-center brief summarizes open work, quality, actions, playbooks, and recommendations |
| **MP30** | **Confidence bands** — assistant answers are sorted by trust level | Recent answers are grouped into high / medium / low confidence with examples |
| **MP31** | **Domain-gap radar** — weak spots are visible by missing context | The command center surfaces objectless, ungrounded, and unknown-domain assistant activity |
| **MP32** | **Escalation watch** — stale AI-assisted work is aged | Old pending actions and stale playbooks show age, owner hint, and cleanup priority |
| **MP33** | **Playbook-template recommendations** — repeated patterns become candidates | The assistant suggests new reusable playbook templates from repeated objects/actions |
| **MP34** | **Rollout readiness score** — the AI layer has a go/no-go view | Grounding, feedback coverage, action completion, review backlog, and stale work produce a readiness score |
| **MP35** | **Adoption heatmap** — assistant usage is visible by user | Recent assistant answers, queued actions, and playbooks are grouped by actor |
| **MP36** | **Surface mix** — assistant entry points are measurable | Dock, chat, command center, and other surfaces show usage counts |
| **MP37** | **Scenario coverage** — answer patterns are visible | Answer kinds and object types reveal where the assistant is already useful |
| **MP38** | **Experiment backlog** — next AI improvements are prioritized | Gaps, automation candidates, and template recommendations become ranked experiments |
| **MP39** | **Daily operating cadence** — the command center gives an execution rhythm | Today’s assistant work, checks, and next operating steps are visible in one panel |
| **MP40** | **Operating packet** — assistant ops can be copied into a standup/update | A concise packet summarizes today, rollout, risks, and next step |
| **MP41** | **Risk register** — AI operating risks are explicit | Low confidence, stale work, grounding gaps, and action backlog show severity and mitigation |
| **MP42** | **Handoff queue** — humans know what to take next | Pending actions, inbox work, and review work are grouped into handoff cards with links when available |
| **MP43** | **Evidence ledger** — grounding debt is visible | Grounded vs ungrounded answer counts and examples of evidence-needed prompts are listed |
| **MP44** | **Milestone plan** — the next assistant build plan is generated from signals | Command center shows Now / Next / Later milestones from readiness, experiments, and risk |

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
| 2026-04-27 | **MP40-MP44 shipped (MVP):** extended the assistant command center with an operating packet, risk register, human handoff queue, evidence ledger, and signal-driven milestone plan. |
| 2026-04-27 | **MP35-MP39 shipped (MVP):** extended the assistant command center with adoption heatmap, surface mix, scenario coverage, experiment backlog, and daily operating cadence panels. |
| 2026-04-27 | **MP30-MP34 shipped (MVP):** extended the assistant command center with confidence bands, domain-gap radar, escalation watch, playbook-template recommendations, and rollout readiness scoring. |
| 2026-04-27 | **MP25-MP29 shipped (MVP):** extended the assistant command center with priority lanes, object coverage, automation readiness, a combined review queue, and a copy-ready executive brief. |
| 2026-04-27 | **MP20-MP24 shipped (MVP):** added `/assistant/command-center` plus `GET /api/assistant/command-center` for cross-workspace assistant ops: inbox count, feedback analytics, action queue, playbook board, recent memory, and quality/health snapshot. |
| 2026-04-27 | **MP15-MP19 shipped (MVP):** added persistent assistant audit events, feedback storage, queued proposed actions, object-level assistant memory, and playbook run/step tracking for the docked assistant. |
| 2026-04-25 | **MP14 shipped (MVP):** context/impact answers now include quality metadata (deterministic mode, grounded-by sources, limitations, timestamp), and the dock displays grounding plus local Helpful / Needs review feedback controls. |
| 2026-04-25 | **MP13 shipped (MVP):** Assistant Inbox items now include proactive suggested next actions for CT alerts, CT exceptions, open email threads, and draft sales orders, with direct “Start action” links to the relevant workspace/tab. |
| 2026-04-25 | **MP12 shipped (MVP):** added `POST /api/assistant/answer-impact` for product impact questions; product assistant cards now ask for stock/PO/shipment/SO exposure, and the dock tries impact answers before stock trace fallback. |
| 2026-04-25 | **MP11 shipped (MVP):** context answers now include reusable playbooks (`sales-order-follow-up`, `shipment-triage`) with visible step status and action bindings in the docked assistant. |
| 2026-04-25 | **MP10 shipped (MVP):** context answers now return explicit proposed actions (`navigate`, `copy_text`) and the dock renders them as user-clicked buttons, including copyable customer update drafts; no record mutation or sending is automatic. |
| 2026-04-25 | **MP9 shipped (MVP):** assistant context cards now include an in-page **Docked assistant** drawer that runs context/stock answers with evidence links while preserving a path to the full `/assistant` workspace. |
| 2026-04-25 | **Embedded assistant handoff improved:** object-page assistant cards now open `/assistant?run=1` and safely auto-run the contextual prompt once, so users land on an answer with evidence instead of a prefilled textarea. |
| 2026-04-25 | **Context answering shipped (MP8 follow-up):** `POST /api/assistant/answer-context` now recognizes sales-order and shipment prompts from embedded assistant cards, summarizes real object state, recommends next action, and returns evidence links before falling back to stock/order-intent flows. |
| 2026-04-25 | **MP5-MP8 shipped (MVP):** `/assistant/mail` now has an **Action playbook** with detected sales-order intent, create/open draft SO action, and reply drafting; `POST /api/assistant/email-threads/[id]/actions` creates a linked draft SO; `AssistantEmailThread.salesOrderId` migration adds traceability; sales-order detail shows an **Assistant timeline** for linked mail actions; product, shipment, and sales-order detail pages include contextual **Ask assistant** cards that prefill `/assistant`. |
| 2026-04-25 | **MP4 shipped (MVP, flagged):** `ASSISTANT_EMAIL_PILOT=1` — `AssistantEmailThread` in DB; `GET/POST /api/assistant/email-threads`, `GET/PATCH /api/assistant/email-threads/[id]`, `POST .../confirm-send` (records confirmation + **mailto** handoff, no default server send); `/assistant/mail` three-pane **mail client** (import/paste, CRM link, draft, confirm modal); open items merged into **assistant Inbox**; subnav **Mail** when pilot enabled. |
| 2026-04-23 | **MP3 shipped (MVP):** `POST /api/assistant/answer-operations` with heuristics for stock / trace / “where is it” vs sales-order flow; reuses `getProductTracePayload` (PO + in-transit + WMS on-hand when granted); `AssistantMp1Client` runs operations first, shows narrative + **evidence links** (product, product-trace, WMS, Control Tower shipment, PO). |
| 2026-04-23 | **MP2 shipped (MVP):** `GET /api/assistant/inbox` aggregating open CT alerts, open/in-progress CT exceptions, and DRAFT sales orders (scoped to viewer); `/assistant/inbox` + `AssistantInbox` client; top nav + platform visibility for Inbox; subnav between Chat and Inbox with badge. |
| 2026-04-23 | **MP1 shipped:** `/assistant` split UI (conversation + proposed action), heuristic `parse-sales-order-intent` API, CRM/product disambiguation, `POST /api/sales-orders` with optional `notes`, nav + platform hub entry. |
| 2026-04-23 | Initial: UI-first rule, copy-paste prompts, MP1–MP4, full MP1 spec (John/ABC/corr-roll). |
