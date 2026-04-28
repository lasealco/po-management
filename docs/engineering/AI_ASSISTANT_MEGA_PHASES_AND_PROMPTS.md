# AI Assistant — what to ask for, and “mega-phases” (UI-first, long runs)

**Purpose:** Fix a real problem: *strategy docs and micro-slices are hard to “prompt,”* and **you** mainly validate **the product when you can see and click it**. This document defines (1) **how to prompt** the implementation agent, (2) **big phases** the agent can execute **without** waiting for you on every sub-task, and (3) **Mega-Phase 1** in enough detail to build toward your **“John at ABC, corr-roll, $100, pickup Tuesday”** story.

**Audience:** You (product owner) + anyone implementing in Cursor.  
**Last updated:** 2026-04-28 (assistant mega-program sizing reset)

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

### 3.0 Process reset — what counts as a real Mega-Phase now

The original intent was correct: a Mega-Phase should keep an implementation agent busy for roughly **one agent-day at minimum**, and often longer. The later MP50+ work drifted into **telemetry slices**. The first `LMP1`-`LMP50` pass then became useful **assistant workbench slices**, but those are still too small to count as true large product Mega-Phases.

Going forward, use **Large Mega-Phases (`LMP1`-`LMP50`)** for real execution. A Large Mega-Phase is done only when it has:

- A visible user workflow or operating surface, not only a roadmap row.
- API/data behavior behind the UI, using real tenant data where possible.
- Human-approved actions where mutation, sending, or automation is involved.
- Evidence, auditability, and clear limits shown in the UI.
- Focused tests/checks or documented verification.
- Changelog entry, commit, and push.

The legacy `MP1`-`MP189` list remains useful as a signal inventory and feature vocabulary. Treat `MP50` onward, plus the workbench-style `LMP1`-`LMP50` implementation, as **inputs and scaffolding** for the larger assistant programs below, not as proof that the full product behavior is done.

### 3.00 Assistant Mega-Programs (`AMP1`-`AMP12`)

Use these when the request is “build a real big assistant phase.” Each **AMP** is intentionally much larger than an `LMP`: it should normally require schema/data decisions, end-to-end workflow UI, APIs, tests, seeded/demo acceptance, and deployment. A single AMP may contain many commits internally, but the product-owner review gate stays at the AMP level.

An AMP is **not complete** if the only deliverable is a command-center/workbench/status card. It must ship at least one durable workflow where the user can create, change, approve, reject, or complete real work.

| AMP | Program | Real completion gate |
|-----|---------|----------------------|
| **AMP1** | **Sales-to-cash assistant program** — customer request/email/text → structured order workspace → promise/reply → audit | Real SO line/item model or equivalent durable order detail exists; pasted/email requests create reviewable drafts with customer/product/qty/price/date; ambiguity resolution is persisted; customer reply draft is editable/copyable; SO detail shows assistant timeline, evidence, and queued actions; tests cover parse, create, audit, and refusal paths; demo seed includes at least three acceptance scenarios |
| **AMP2** | **Supply and supplier execution program** — PO follow-up, supplier performance, onboarding, and supplier communications | PO lines needing acknowledgement/shipment/follow-up are surfaced as real work; supplier detail has a durable assistant performance brief and onboarding gap plan; supplier messages/notes are logged; onboarding tasks can be created/updated through approved actions; tests cover supplier permissions, task state, and PO follow-up signals; demo seed supports a buyer reviewing and closing a supplier gap |
| **AMP3** | **Control Tower recovery and communication program** — shipment exception triage, carrier/customer escalation, recovery playbooks | Shipment 360 has a native assistant recovery tab; exceptions have root-cause, owner, severity, customer-impact, and recovery state; carrier/customer updates are drafted from shipment evidence and logged; recovery playbooks can be assigned/completed; tests cover permission scope, exception updates, action queue, and message logging; demo has late/missing/damaged shipment scenarios |
| **AMP4** | **Warehouse promise and inventory recovery program** — ATP, allocation/reallocation proposals, WMS task recovery | Product/SO/WMS pages expose a real availability-to-promise panel; stock, allocation, hold, inbound, and task blockers are explained; reallocation/reservation proposals are queued with impact and rollback; WMS blocked tasks have recovery state and owner; tests cover ATP math, held stock, permissions, and no-silent-mutation guardrails; demo includes shortage, hold, and reallocation scenarios |
| **AMP5** | **Pricing, RFQ, invoice audit, and finance handoff program** — quote/pricing/invoice lifecycle | RFQ response assembly, pricing snapshot explanation, invoice discrepancy analysis, dispute note drafting, and accounting packet approval form one linked workflow; finance handoff is durable and export/copy-ready; variance explanations cite frozen snapshot lines; tests cover RFQ, snapshot serialization, invoice audit rollup, approvals, and accounting readiness; demo includes pass/warn/fail invoice cases |
| **AMP6** | **Assistant work engine program** — action queue, playbook builder, assignment, SLAs, and object memory | Action queue supports owner, due date, priority, reject/complete notes, and object links; playbook templates can be created/edited/run; playbook runs have durable step state and SLA; object pages summarize assistant memory with cleanup controls; tests cover action transitions, playbook template validation, memory retrieval, and stale work; demo includes an operator finishing a multi-step playbook |
| **AMP7** | **Evidence, quality, and training program** — grounding ledger, feedback review, prompt library, release gates | Every assistant answer has inspectable evidence and quality metadata; weak/no-evidence answers enter a review queue; reviewers can label/correct/export examples; approved prompt starters are runnable by role/domain; release gate blocks unsafe assistant changes unless checks pass; tests cover audit persistence, feedback, evidence validation, prompt library, and quality thresholds |
| **AMP8** | **Governed automation program** — shadow automation → controlled automation → rollback/override | Candidate automations run in shadow mode against human decisions; readiness compares proposed vs actual; one low-risk automation can be enabled by flag with explicit guardrails; overrides/pause/rollback are visible and audited; tests cover disabled/enabled behavior, rollback, permission denials, and idempotency; demo proves automation never runs silently outside approved boundaries |
| **AMP9** | **Integration and external-data assistant program** — API Hub data feeding assistant workflows | API Hub connectors/staging/mapping become assistant-readable evidence; imported records can create reviewable assistant work items; mapping conflicts produce explainable recommendations; no secrets are exposed; tests cover connector state, staging apply dry-run, assistant evidence links, and permission boundaries; demo imports a batch and turns it into order/shipment/supplier work |
| **AMP10** | **Supply Chain Twin assistant program** — object graph, flow twins, scenarios, and risk simulation | Order/shipment/inventory/supplier/finance objects are connected in a visible twin graph; assistant can explain graph confidence and missing edges; scenarios can be created/duplicated/compared from assistant prompts; risk signals link back to real records and playbooks; tests cover graph APIs, scenario lifecycle, risk acknowledgement, and assistant evidence; demo includes one end-to-end what-if scenario |
| **AMP11** | **Admin, rollout, security, and compliance program** — operator console for the AI layer | A real admin console manages assistant flags, prompt library, playbooks, automation candidates, quality thresholds, permissions visibility, rollout by role/site, and compliance packet generation; tests cover role grants, blocked actions, config persistence, and packet generation; demo shows an admin enabling a pilot safely and exporting the control packet |
| **AMP12** | **Customer-ready AI operating system program** — polished demo, board report, docs, and hardening | Assistant feels like one product layer across chat, workbenches, object pages, inbox, command center, and admin; demo scenarios are scripted and seeded; executive/board report is generated from real metrics; docs explain operating model and limitations; broad regression checks pass; Vercel deploy is green; product owner can run a full customer demo without agent assistance |

### 3.01 How to ask for the new larger phases

Use:

> **“Execute AMP[N] from `docs/engineering/AI_ASSISTANT_MEGA_PHASES_AND_PROMPTS.md`. Treat it as a true assistant mega-program: durable workflow, schema/data changes if needed, UI, API, tests, seed/demo acceptance, docs/changelog, commit, and push. Do not satisfy it with only a dashboard, workbench, or status card.”**

If an AMP is too large for one agent turn, continue inside the same AMP using sub-phases like `AMP1.A`, `AMP1.B`, `AMP1.C`. Do **not** rename those sub-phases into separate review gates unless the product owner asks.

### 3A. Large Mega-Phase Roadmap (`LMP1`-`LMP50`)

These `LMP` rows are now a **scaffolding layer** below the true `AMP` programs. They can guide implementation, but completing an `LMP` workbench does not finish the corresponding product workflow.

| Large MP | Theme | Real exit criteria |
|----------|-------|--------------------|
| **LMP1** | **Assistant foundation hardening** — make chat, dock, inbox, audit, and command center feel like one assistant product | User can move between `/assistant`, docked assistant, inbox, object cards, audit history, and command center without dead ends; shared copy, loading, errors, and evidence display are consistent |
| **LMP2** | **Sales-order copilot v1** — end-to-end order intake from pasted text/email | User can paste a sales-order request, resolve customer/product/warehouse ambiguity, create or update a draft SO, see evidence, and audit the assistant decision |
| **LMP3** | **Customer communication copilot** — safe customer replies and follow-ups | User can generate customer-ready updates from SO/shipment context, edit/copy/send via approved handoff, and see the communication logged against the object |
| **LMP4** | **Order exception triage** — assistant detects and guides order issues | Draft/blocked/late/ambiguous orders appear in an exception queue with suggested root cause, evidence, owner, and human-approved next actions |
| **LMP5** | **Product availability copilot** — stock, inbound, committed, and risk answers | Product pages answer “can we promise this?” with on-hand/inbound/allocated context, links to evidence, and clear limitations |
| **LMP6** | **Inventory reallocation workflow** — propose but do not auto-move stock | Assistant proposes stock reallocation or reservation options with impact analysis, approval gate, audit log, and rollback note |
| **LMP7** | **Purchase-order follow-up copilot** — inbound supply risk management | User sees PO lines needing follow-up, generates supplier update text, tracks responses, and links assistant actions to the PO/supplier |
| **LMP8** | **Supplier performance assistant** — SRM insight and coaching | Supplier detail shows assistant-generated performance brief, risk drivers, recent orders, pending tasks, and recommended follow-up playbooks |
| **LMP9** | **Supplier onboarding copilot** — guided onboarding and missing-data chase | Assistant surfaces onboarding gaps, drafts supplier requests, tracks completion, and keeps all changes human-approved |
| **LMP10** | **Shipment triage copilot** — Control Tower exception handling | Shipment and CT exception pages show AI triage, likely cause, evidence, severity, owner, and guided actions |
| **LMP11** | **Carrier communication copilot** — carrier-facing updates and escalation | User can generate carrier escalation messages from shipment evidence, copy/send via approved handoff, and log the result |
| **LMP12** | **Delivery promise monitor** — customer promise risk across orders and shipments | Command center shows orders at delivery-promise risk, evidence, impacted customer, likely reason, and recommended next action |
| **LMP13** | **Warehouse operations copilot** — WMS work visibility | Warehouse screens surface assistant suggestions for inventory, tasks, bottlenecks, and exceptions with direct links to WMS records |
| **LMP14** | **Warehouse task recovery workflow** — blocked pick/pack/ship tasks | Assistant groups blocked warehouse tasks, proposes recovery steps, and lets a human mark actions done or escalated |
| **LMP15** | **Pricing snapshot copilot** — explain pricing and tariff snapshots | Pricing snapshot pages explain rate components, assumptions, gaps, and next actions with evidence links |
| **LMP16** | **RFQ response copilot** — guided quotation response | User can assemble an RFQ response from tariffs, constraints, and customer requirements, with human approval before sending/export |
| **LMP17** | **Invoice audit copilot** — discrepancy explanation and dispute prep | Invoice audit pages explain variance, cite snapshot/rate evidence, draft dispute notes, and track approval for accounting |
| **LMP18** | **Finance handoff workflow** — approved audit to accounting packet | Assistant produces an accounting-ready packet from approved invoice audit/intake data with controls, notes, and audit trail |
| **LMP19** | **Commercial risk dashboard** — margin, pricing, invoice, and service burden | Command center groups commercial risk signals and links to pricing/invoice/order evidence with next actions |
| **LMP20** | **Executive daily brief v1** — one copy-ready business brief | User gets a concise daily brief covering orders, shipments, inventory, suppliers, finance, assistant risks, and recommended priorities |
| **LMP21** | **Role-based assistant landing pages** — tailored views for ops, sales, finance, warehouse, leadership | Each role sees relevant assistant work, KPIs, risks, playbooks, and entry points without needing to understand all modules |
| **LMP22** | **Assistant action queue v2** — triage, ownership, status, and aging | Action queue supports owner, due/status filters, stale handling, completion/rejection notes, and source object links |
| **LMP23** | **Playbook builder v1** — turn repeated work into guided workflows | Users can create/edit simple playbook templates from repeated assistant patterns and run them on objects |
| **LMP24** | **Playbook operations v2** — assigned, aged, measurable runs | Playbook runs support owner, due dates, step notes, escalation status, completion analytics, and command-center visibility |
| **LMP25** | **Assistant memory v2** — useful object memory, not noise | Object pages show summarized prior assistant decisions, actions, feedback, and current open questions with cleanup controls |
| **LMP26** | **Evidence ledger v2** — inspectable grounding across modules | Command center shows evidence coverage by object/domain, weak answers, missing links, and links to add/correct evidence |
| **LMP27** | **Feedback-to-training workflow** — turn feedback into improvement work | Helpful/needs-review feedback becomes a review queue with labels, corrections, prompt candidates, and exportable training examples |
| **LMP28** | **Prompt library productization** — reusable prompts users can run | Users can browse, run, and maintain approved prompt starters by role/domain with evidence expectations and examples |
| **LMP29** | **Quality release gate** — assistant changes have measurable guardrails | Build/release process includes assistant quality checks, test prompts, grounding thresholds, and documented exceptions |
| **LMP30** | **Simulation/shadow automation lab** — rehearse automation safely | Candidate automations run in shadow mode, compare proposed vs actual human actions, and report readiness before any live automation |
| **LMP31** | **Controlled automation v1** — one low-risk automation with rollback | A selected action can run automatically only under strict guardrails, with audit, rollback path, and clear opt-in flag |
| **LMP32** | **Human override center** — humans can stop, correct, and explain automation | Users can pause automation candidates, override suggestions, add correction notes, and see why an action was proposed |
| **LMP33** | **Domain expansion planner** — choose next AI domain based on data | Command center recommends the next domain based on coverage, value, risk, data dependencies, and user adoption |
| **LMP34** | **Integration readiness workbench** — ERP/WMS/TMS/finance integration planning | Assistant maps current signals to integration candidates, missing data, expected value, and readiness checklist |
| **LMP35** | **Tenant rollout cockpit** — rollout by team/role/site | Admin/operator can see rollout readiness, adoption, risks, feedback, and enablement tasks by audience or site where data exists |
| **LMP36** | **Enablement coach** — targeted user coaching | Assistant suggests coaching prompts, examples, and next-use cases by user/role based on adoption and feedback patterns |
| **LMP37** | **Policy and compliance packet** — audit-ready controls | Command center produces a compliance packet for audit events, evidence, approvals, feedback, permissions, and automation guardrails |
| **LMP38** | **Security posture hardening** — least privilege and sensitive action controls | Assistant-sensitive actions respect grants, show permission reasons, avoid secrets, and expose blocked actions cleanly |
| **LMP39** | **Incident and escalation runbook** — operational risk response | Risks and stale work can be converted into escalation runs with owner, steps, evidence, and resolution status |
| **LMP40** | **Resilience control tower** — disruption and recovery workflows | Assistant groups disruption signals, proposes recovery playbooks, tracks continuity score, and prepares stakeholder updates |
| **LMP41** | **Digital twin readiness v1** — object graph and confidence model | Assistant builds a visible object-coverage graph across order/shipment/inventory/supplier/finance signals with confidence and gaps |
| **LMP42** | **Order-flow twin** — order lifecycle health model | Order lifecycle has assistant-visible stages, bottlenecks, delays, evidence, and forecasted risk signals |
| **LMP43** | **Shipment-flow twin** — shipment lifecycle health model | Shipment lifecycle has assistant-visible stages, delays, carrier risk, evidence, and recovery actions |
| **LMP44** | **Inventory-flow twin** — stock movement and promise model | Inventory/product flow has assistant-visible stock, inbound, allocation, risk, and promise impacts |
| **LMP45** | **Network collaboration hub** — customer/supplier/carrier collaboration in one place | User sees external collaboration work by party, open updates, promised responses, risks, and generated communication packs |
| **LMP46** | **Sustainability readiness v1** — emissions/data-gap foundation | Assistant identifies logistics/inventory data needed for emissions/sustainability reporting and creates a gap plan |
| **LMP47** | **Board-ready AI operating report** — leadership reporting | Command center produces a board-ready report with value, risks, controls, adoption, roadmap, and remaining gaps |
| **LMP48** | **AI admin console v1** — configure assistant behavior | Admin can manage flags, prompt library, playbook templates, automation candidates, and quality thresholds in a focused console |
| **LMP49** | **End-to-end demo scenario pack** — repeatable demos across modules | Repo includes demo scenarios, seed expectations, and click-path scripts for sales/order/shipment/inventory/invoice assistant flows |
| **LMP50** | **AI operating system v1** — cohesive assistant layer across the platform | The assistant feels like one product layer with connected work queues, object memory, evidence, playbooks, approvals, quality gates, and executive reporting |

### 3B. How to execute Large Mega-Phases

When you ask for one of these, use:

> **“Execute LMP[N] from `docs/engineering/AI_ASSISTANT_MEGA_PHASES_AND_PROMPTS.md`. Treat it as a real large MP: UI, API/data, tests/checks, changelog, commit, and push. Do not satisfy it with only a roadmap row or status card.”**

If implementation discovers that an LMP is too large for one run, split it into **subtasks inside the same LMP** and keep the review gate at the LMP level.

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
| **MP45** | **SLA posture** — assistant-assisted work has service posture | Action completion, stale playbooks, and open inbox work produce a simple posture status |
| **MP46** | **Training queue** — good and weak examples are reusable | Helpful grounded answers and correction-needed answers are listed for future tuning |
| **MP47** | **Prompt library candidates** — repeat prompts become reusable starts | Frequent answer kinds / object contexts suggest prompt templates |
| **MP48** | **Decision journal** — assistant decisions are traceable over time | Recent feedback, action, and playbook events are shown as one timeline |
| **MP49** | **Signal hygiene** — noisy assistant telemetry is visible | Duplicate prompts, missing feedback, missing grounding, and unlinked memory produce cleanup items |
| **MP50** | **Governance baseline scorecard** — the assistant has a control baseline | Rollout, grounding, feedback, action, and stale-work indicators are summarized |
| **MP51** | **Control objectives** — assistant controls are explicit | Human approval, auditability, grounding, feedback, and inbox visibility show pass/watch status |
| **MP52** | **Access posture** — assistant scope is visible | Command center shows which workspace grants are represented in assistant operations |
| **MP53** | **Retention and sampling plan** — audit sample size is visible | Recent sample size and total audit volume are shown as the current evidence base |
| **MP54** | **Approval gate posture** — automation stays human-gated | Pending/done action counts show whether approval flow is under control |
| **MP55** | **Value proxy** — assistant value is measurable | Answers, actions, playbooks, and inbox deflection produce a lightweight value score |
| **MP56** | **Cycle-time proxy** — stale work indicates time risk | Stale playbooks and old actions are summarized as cycle-time drag |
| **MP57** | **Capacity proxy** — assistant workload is visible | Open inbox, pending actions, and review queue provide a workload estimate |
| **MP58** | **Deflection signal** — assistant self-service is visible | Helpful grounded answers are counted as candidate deflections |
| **MP59** | **Value backlog** — improvements are tied to value | Experiment backlog and prompt candidates identify next value opportunities |
| **MP60** | **Domain expansion ranking** — next domains are prioritized | Object coverage ranks candidate domains for expansion |
| **MP61** | **Data dependency map** — missing evidence/context is explicit | Domain gaps and evidence debt list data dependencies before expansion |
| **MP62** | **Integration readiness** — entry surfaces are measurable | Surface mix and action types show which integrations are already active |
| **MP63** | **Workflow gap map** — playbook gaps are visible | Template recommendations identify workflows without reusable playbooks |
| **MP64** | **Expansion cards** — domain candidates are packaged | Command center shows candidate domain, reason, and next human-approved step |
| **MP65** | **Enablement plan** — humans know how to adopt the assistant | Adoption heatmap and prompt library produce coaching targets |
| **MP66** | **Release train** — next assistant releases are sequenced | Now / Next / Later milestones become release-train cards |
| **MP67** | **Incident runbook** — assistant risks have response steps | Risk register items map to concrete response actions |
| **MP68** | **KPI board** — assistant operating KPIs are grouped | Rollout, SLA, quality, action, and evidence KPIs appear in one board |
| **MP69** | **30-day operating roadmap** — next month is visible | Command center summarizes governance, value, expansion, and scale next steps |
| **MP70** | **Process mining signal** — assistant activity reveals workflow paths | Recent answers, actions, and playbooks show which process paths are active |
| **MP71** | **Bottleneck detector** — blocked assistant work is visible | Review backlog, stale work, and aged actions identify bottlenecks |
| **MP72** | **Exception taxonomy** — recurring issues are categorized | Risks, low confidence, missing evidence, and pending work become exception groups |
| **MP73** | **Root-cause hints** — weak signals point to likely causes | Domain gaps, ungrounded answers, and objectless memory produce likely root-cause prompts |
| **MP74** | **Process recommendation queue** — improvements become actionable | Recommendations and experiments are grouped into process improvement candidates |
| **MP75** | **Knowledge base candidates** — reusable assistant knowledge is visible | Helpful answers, prompt starters, and evidence debt become KB candidates |
| **MP76** | **SOP gap list** — missing procedures are explicit | Workflow template recommendations identify missing SOPs |
| **MP77** | **Answer-to-playbook mapping** — repeated answer types map to workflows | Frequent answer kinds suggest playbook candidates |
| **MP78** | **Evidence starter packs** — grounding requirements are packaged | Ungrounded prompts and evidence-needed items show what evidence to collect |
| **MP79** | **Knowledge freshness** — the evidence base has age and sample context | Recent audit sample and latest generated timestamp show freshness posture |
| **MP80** | **Simulation readiness** — automation can be rehearsed before execution | Rollout, confidence, and action completion determine whether shadow testing is ready |
| **MP81** | **Shadow-mode score** — assistant automation stays in rehearsal | Pending and completed human-approved actions produce a shadow-mode score |
| **MP82** | **Controlled automation candidates** — safe next automations are ranked | High-completion action kinds and repeat candidates are listed |
| **MP83** | **Rollback checklist** — automation risks have reversibility steps | Risk and handoff data produce rollback checks before automation expansion |
| **MP84** | **Automation guardrails** — automation constraints are visible | Human approval, evidence, feedback, and stale-work gates are checked |
| **MP85** | **Stakeholder experience map** — assistant value is grouped by audience | User adoption, inbox work, and object coverage indicate stakeholder impact |
| **MP86** | **Communication pack** — assistant outputs are ready for status sharing | Brief, operating packet, and prompt library create communication starters |
| **MP87** | **Brief variants** — different audiences get different summaries | Executive, operator, and enablement brief lines are generated from the same data |
| **MP88** | **Adoption coaching queue** — users get targeted enablement | Adoption heatmap and prompt starters identify coaching targets |
| **MP89** | **Board-ready narrative** — AI progress can be reported clearly | KPIs, risks, roadmap, and value signals are summarized for leadership |
| **MP90** | **Predictive signal board** — weak signals become forecast inputs | Confidence, stale work, review debt, and action age produce early-warning signals |
| **MP91** | **Delay risk proxy** — old assistant work flags operational delay risk | Aged actions and stale playbooks show where work may miss expectations |
| **MP92** | **Demand signal proxy** — assistant usage hints at demand for help | Repeated prompts, surface usage, and answer kinds reveal demand patterns |
| **MP93** | **Exception forecast** — recurring risks become near-term exception warnings | Risk register and domain gaps summarize likely future exceptions |
| **MP94** | **Predictive next step** — the command center suggests what to watch next | Recommendations and experiments provide the next monitoring action |
| **MP95** | **Data quality scorecard** — assistant data quality is explicit | Missing feedback, grounding gaps, and objectless memory are scored together |
| **MP96** | **Object link quality** — assistant memory should attach to records | Object coverage and objectless events show link quality |
| **MP97** | **Feedback quality** — user review coverage is measurable | Feedback coverage and needs-review rate show review health |
| **MP98** | **Grounding quality** — evidence coverage is measurable | Grounded vs ungrounded answers show evidence quality |
| **MP99** | **Duplicate signal cleanup** — noisy repeated inputs are visible | Duplicate prompt and hygiene counts drive cleanup work |
| **MP100** | **Agent orchestration map** — assistant sub-capabilities are grouped | Answer, action, playbook, inbox, and governance signals show orchestration coverage |
| **MP101** | **Tool-use readiness** — proposed actions show tool readiness | Action queue completion and candidates identify tool-readiness state |
| **MP102** | **Playbook orchestration** — active/completed playbooks show workflow coverage | Playbook run status and template gaps summarize orchestration health |
| **MP103** | **Human-in-loop routing** — unresolved work has a human path | Handoff queue and review queue show routing coverage |
| **MP104** | **Agent boundary map** — assistant capability limits are visible | Low confidence, ungrounded answers, and pending approvals define boundaries |
| **MP105** | **Customer collaboration lens** — customer-facing assistance is measurable | Sales-order, mail, and customer-update signals show external collaboration readiness |
| **MP106** | **Supplier collaboration lens** — supplier-facing assistance is measurable | Supplier object coverage and handoff items show supplier collaboration readiness |
| **MP107** | **Carrier collaboration lens** — shipment-facing assistance is measurable | Shipment/Control Tower object coverage show carrier collaboration readiness |
| **MP108** | **Collaboration packet** — external updates are easier to prepare | Briefs, copyable packets, and prompt starters support stakeholder communication |
| **MP109** | **Collaboration risk watch** — external-facing gaps are flagged | Low confidence, missing evidence, and stale work highlight communication risk |
| **MP110** | **Commercial impact lens** — AI work ties to value themes | Helpful answers, completed actions, and automation candidates summarize commercial impact |
| **MP111** | **Pricing assistance watch** — pricing-related assistant activity is visible | Pricing/tariff object coverage can be tracked when present |
| **MP112** | **Invoice assistance watch** — invoice audit assistance is visible | Invoice-audit object coverage can be tracked when present |
| **MP113** | **Cost-to-serve proxy** — open work and stale actions indicate service cost | Pending actions, review debt, and inbox load estimate support burden |
| **MP114** | **Margin-risk hints** — commercial uncertainty is highlighted | Low confidence, ungrounded answers, and exceptions become margin-risk prompts |
| **MP115** | **Warehouse intelligence lens** — WMS-related assistance is visible | Warehouse/inventory object coverage and trace answers summarize WMS usefulness |
| **MP116** | **Logistics intelligence lens** — shipment assistance is visible | Shipment and Control Tower activity show logistics coverage |
| **MP117** | **Inventory intelligence lens** — product/stock assistance is visible | Product trace and inventory prompts show stock intelligence coverage |
| **MP118** | **Operational load board** — open work is grouped by operations burden | Inbox, pending actions, stale playbooks, and review items show load |
| **MP119** | **Ops resilience hints** — risk and stale work become resilience prompts | Risk register and escalation watch identify operational resilience needs |
| **MP120** | **Security posture board** — AI guardrails are visible | Human approval, feedback, grounding, and audit volume show security posture |
| **MP121** | **Permission coverage** — assistant scope follows grants | Control Tower and order access are reflected in assistant command-center scope |
| **MP122** | **Audit completeness** — durable AI events are monitored | Audit event volume and recent samples show logging completeness |
| **MP123** | **Policy exception watch** — policy gaps become watch items | Risk register and signal hygiene show policy-exception candidates |
| **MP124** | **Compliance packet** — compliance-ready summary is generated | Evidence, audit, feedback, and approval signals form a compliance summary |
| **MP125** | **Admin configuration map** — future admin controls are visible | Feature surfaces, prompts, playbooks, and guardrails become admin candidates |
| **MP126** | **Prompt governance map** — prompt starters get ownership signals | Prompt candidates and duplicate prompts show governance needs |
| **MP127** | **Playbook governance map** — playbooks get lifecycle signals | Active, stale, and completed playbooks show governance status |
| **MP128** | **Feature flag readiness** — rollout controls are tracked | Rollout score and readiness checklist indicate flag readiness |
| **MP129** | **Tenant rollout map** — rollout planning is grouped for tenants | Adoption, readiness, and value signals support tenant rollout planning |
| **MP130** | **Evaluation suite candidates** — real examples become tests | Training positives/corrections and low-confidence answers become evaluation candidates |
| **MP131** | **Regression watch** — weak answer patterns are tracked | Needs-review and low-confidence samples show regression risk |
| **MP132** | **Benchmark starter set** — representative prompts are selected | Prompt library and scenario coverage provide benchmark starters |
| **MP133** | **Tuning backlog** — improvement data becomes tuning work | Training queue, hygiene items, and experiments become tuning candidates |
| **MP134** | **Quality release gate** — quality signals gate future releases | Grounding, feedback, review, and stale-work checks form a release gate |
| **MP135** | **Enterprise readiness board** — enterprise adoption signals are grouped | Governance, security, compliance, value, and rollout signals are summarized |
| **MP136** | **Scale risk forecast** — expansion risks are visible before rollout | Risk register, handoff load, and grounding gaps forecast scale risk |
| **MP137** | **Operating model map** — roles and rhythms become explicit | Cadence, handoff, adoption, and release train summarize operating model |
| **MP138** | **Executive rollout narrative** — leadership gets a concise AI story | Board-ready narrative, KPI board, and roadmap combine into a rollout story |
| **MP139** | **AI operating system index** — the assistant program has one index | Command center indexes governance, value, maturity, horizon, and execution layers |
| **MP140** | **Digital twin readiness** — the assistant can mirror live operations | Object coverage, evidence, and action data show whether a lightweight twin is viable |
| **MP141** | **Order-flow twin** — orders can be represented as assistant signals | Sales/order activity and handoffs summarize order-flow coverage |
| **MP142** | **Shipment-flow twin** — shipments can be represented as assistant signals | Shipment/control-tower activity summarizes logistics flow coverage |
| **MP143** | **Inventory-flow twin** — inventory can be represented as assistant signals | Product/inventory activity summarizes stock-flow coverage |
| **MP144** | **Twin confidence score** — the digital twin has a trust posture | Grounding, object links, and feedback produce a twin confidence score |
| **MP145** | **Planning cockpit** — assistant insights support planning decisions | Recommendations, experiments, and milestones become planning inputs |
| **MP146** | **Capacity planning hint** — assistant workload indicates capacity needs | Inbox, pending actions, and stale playbooks show workload pressure |
| **MP147** | **Demand planning hint** — prompt and surface activity signal demand | Prompt patterns and surface mix show where users ask for help |
| **MP148** | **Exception planning queue** — likely exceptions become planning work | Risks, low-confidence answers, and evidence gaps drive exception planning |
| **MP149** | **Scenario planning starter** — next scenarios are packaged | Experiments and playbook templates form scenario starter cards |
| **MP150** | **Network collaboration hub** — external collaboration is grouped | Customer, supplier, carrier, and handoff signals share one collaboration view |
| **MP151** | **Customer promise watch** — customer-impact risk is visible | Order/customer signals plus stale work show customer-promise risk |
| **MP152** | **Supplier promise watch** — supplier-impact risk is visible | Supplier/SRM signals plus handoffs show supplier-promise risk |
| **MP153** | **Carrier promise watch** — carrier-impact risk is visible | Shipment/carrier signals plus stale work show carrier-promise risk |
| **MP154** | **Network escalation map** — external escalations have a route | Handoff, risk, and stale-work signals show escalation routes |
| **MP155** | **Finance control lens** — financial workflows have AI guardrails | Pricing, invoice, action, and evidence signals show finance-control readiness |
| **MP156** | **Revenue leakage watch** — low-confidence commercial work is flagged | Pricing/invoice gaps and low confidence highlight leakage risk |
| **MP157** | **Dispute readiness** — evidence supports dispute workflows | Evidence coverage and invoice/customer signals show dispute readiness |
| **MP158** | **Approval chain map** — financial actions remain human approved | Pending/done actions and approval posture summarize approval-chain health |
| **MP159** | **Finance packet** — finance status can be copied into updates | Commercial value, risk, and evidence signals create a finance brief |
| **MP160** | **Sustainability signal board** — sustainability data gaps are visible | Object coverage and evidence debt identify sustainability-readiness gaps |
| **MP161** | **Emissions data readiness** — emissions workflows need evidence | Shipment/inventory coverage plus grounding show emissions data readiness |
| **MP162** | **Compliance sustainability watch** — sustainability risks are tracked | Compliance, evidence, and risk signals show sustainability control posture |
| **MP163** | **Green logistics hint** — logistics data can support greener choices | Shipment/logistics signals become candidates for green routing analysis |
| **MP164** | **Sustainability reporting starter** — reporting has a starter packet | Evidence and operating packets become sustainability reporting inputs |
| **MP165** | **Resilience control tower** — operational resilience is summarized | Risk, stale work, review debt, and handoffs show resilience posture |
| **MP166** | **Disruption watch** — emerging disruptions are visible | Exceptions, stale playbooks, and aged actions indicate disruption pressure |
| **MP167** | **Recovery playbook candidates** — recovery workflows become reusable | Template recommendations and handoffs suggest recovery playbooks |
| **MP168** | **Continuity score** — continuity readiness is scored | Grounding, completion, and stale-work signals form a continuity score |
| **MP169** | **Resilience packet** — resilience updates are copy-ready | Risk, handoff, and milestone signals produce a resilience brief |
| **MP170** | **Ecosystem integration map** — external system needs are visible | Surfaces, action kinds, and object coverage reveal integration priorities |
| **MP171** | **ERP integration readiness** — order and finance signals show ERP fit | Orders, pricing, invoices, and actions indicate ERP integration readiness |
| **MP172** | **WMS integration readiness** — warehouse signals show WMS fit | Warehouse/inventory coverage indicates WMS integration readiness |
| **MP173** | **TMS integration readiness** — shipment signals show TMS fit | Shipment/carrier coverage indicates TMS integration readiness |
| **MP174** | **Integration backlog** — integrations become ranked work | Coverage gaps and automation candidates create integration backlog items |
| **MP175** | **Global rollout governance** — rollout can scale by region/team | Adoption, permissions, and rollout score guide global rollout governance |
| **MP176** | **Localization readiness** — assistant output can be localized later | Briefs, prompt starters, and object labels show localization candidates |
| **MP177** | **Regional risk watch** — regional gaps are flagged when data exists | Object coverage and handoff load create regional-risk placeholders |
| **MP178** | **Policy pack readiness** — policy assets can be assembled | Compliance packet, signal hygiene, and audit coverage show policy readiness |
| **MP179** | **Global operating cadence** — cadence can scale across teams | Daily cadence, release train, and handoff queues form a global rhythm |
| **MP180** | **Copilot experience map** — assistant UX surfaces are tracked | Surface mix, dock/chat usage, and command-center usage show experience coverage |
| **MP181** | **Prompt-to-action funnel** — prompt flow to action is measurable | Audit events, queued actions, and completed actions show funnel health |
| **MP182** | **Answer experience quality** — answers are judged by trust and usefulness | Helpful feedback, needs-review, grounding, and confidence show answer quality |
| **MP183** | **Action experience quality** — actions are judged by completion and age | Pending, done, and aged actions show action experience quality |
| **MP184** | **Copilot UX backlog** — UX improvements are prioritized | Experiments, hygiene, and prompt candidates create UX backlog items |
| **MP185** | **Autonomous readiness index** — autonomy remains gated and measurable | Guardrails, approval balance, grounding, and feedback produce an autonomy score |
| **MP186** | **Autonomy stage map** — automation maturity is staged | Shadow mode, controlled candidates, and release gates define autonomy stage |
| **MP187** | **Autonomy risk register** — automation risk is explicit | Risks, handoffs, evidence gaps, and stale actions form autonomy risk items |
| **MP188** | **Human override posture** — humans keep control | Pending approvals, handoffs, and review queues show override posture |
| **MP189** | **Next-generation AI roadmap** — the next era is indexed | Digital twin, planning, network, finance, sustainability, resilience, integration, global, UX, and autonomy layers form the next roadmap |

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
| 2026-04-28 | **AMP11 completed:** Assistant now has an Admin Console for rollout controls, pilot role/site scope, quality thresholds, permissions visibility, automation/release readiness, and compliance packet export; settings-view users can inspect controls while settings-edit users can persist `AssistantAdminControl` snapshots and audit packet exports, with focused helper tests and three acceptance scenarios in `prisma/amp11-assistant-admin-control-demo-scenarios.json`. |
| 2026-04-28 | **AMP10 completed:** Supply Chain Twin now has a Twin Assistant workspace that explains graph confidence from real entity/edge/scenario/risk counts, highlights missing graph coverage, creates what-if scenario drafts from prompts, links optional risk signals to review playbooks, writes assistant audit/evidence/action-queue records, persists durable twin assistant insights, and includes focused helper tests plus three acceptance scenarios in `prisma/amp10-supply-chain-twin-assistant-demo-scenarios.json`. |
| 2026-04-28 | **AMP9 completed:** API Hub now has an Assistant evidence workspace that turns connector, staging, mapping, and apply-conflict signals into redacted assistant evidence, durable review items, assistant audit events, and human action-queue work without exposing secrets or silently applying data; includes focused assistant-evidence tests and three acceptance scenarios in `prisma/amp9-apihub-assistant-evidence-demo-scenarios.json`. |
| 2026-04-28 | **AMP8 completed:** Assistant now has a Governed automation workspace with durable shadow/controlled/paused policies, readiness guardrails, shadow-run comparison against human decisions, release-gate enforcement, rollback plans, policy audit events, focused governed-automation tests, and three acceptance scenarios in `prisma/amp8-governed-automation-demo-scenarios.json`. |
| 2026-04-28 | **AMP7 completed:** Assistant now has an Evidence quality workspace with an inspectable evidence ledger, weak-answer review queue, durable correction/export examples, approved prompt library starters, quality release-gate snapshots, focused evidence-quality tests, and three acceptance scenarios in `prisma/amp7-evidence-quality-demo-scenarios.json`. |
| 2026-04-28 | **AMP6 completed:** Assistant now has a Work engine with owned/due/priority action queue items, decision notes, object links, editable playbook templates, SLA-backed playbook runs, stale-work detection, assistant memory archive controls, focused work-engine tests, and three acceptance scenarios in `prisma/amp6-assistant-work-engine-demo-scenarios.json`. |
| 2026-04-28 | **AMP5 completed:** invoice audit detail now has a durable AMP5 finance handoff panel that links RFQ/pricing snapshot evidence, audit variance lines, dispute note drafting, accounting packet JSON, human-reviewed status, action-queue handoffs, audit events, focused tests, and three acceptance scenarios in `prisma/amp5-invoice-finance-handoff-demo-scenarios.json`. |
| 2026-04-28 | **AMP4 completed:** product detail now has an AMP4 availability-to-promise panel that computes ATP from WMS stock, holds, WMS tasks, sales demand, and inbound PO lines; persists reviewed promise summary/recovery proposal; queues human-approved inventory recovery actions without silent stock mutation; includes focused tests and three acceptance scenarios in `prisma/amp4-product-promise-demo-scenarios.json`. |
| 2026-04-28 | **AMP3 completed:** Shipment 360 now includes a native Recovery tab for Control Tower exceptions with durable recovery state, customer impact, recovery plan, carrier/customer drafts, playbook checklist, carrier follow-up queue action, customer shared-note logging, audit events, focused tests, and three acceptance scenarios in `prisma/amp3-control-tower-recovery-demo-scenarios.json`. |
| 2026-04-28 | **AMP2 completed:** supplier detail now has an AMP2 execution panel with generated/editable supplier performance brief, onboarding gap plan, PO follow-up evidence, approved supplier follow-up queue actions, onboarding task creation, assistant audit logging, focused tests, and three acceptance scenarios in `prisma/amp2-supplier-execution-demo-scenarios.json`. |
| 2026-04-28 | **AMP1 completed:** sales-to-cash assistant drafts now support durable line-item intake, editable/copyable customer replies, SO-detail review/approve/needs-changes/reject workflow, assistant audit events, focused parser/review tests, and three acceptance scenarios in `prisma/amp1-sales-to-cash-demo-scenarios.json`. |
| 2026-04-28 | **AMP1.A shipped:** sales-to-cash assistant intake now persists structured sales-order lines, source request text, parser snapshot, customer reply draft, and assistant audit events for chat/email-created draft SOs; SO detail shows the structured intake and reply draft. |
| 2026-04-28 | **Assistant Mega-Program sizing reset:** documented that `LMP1-LMP50` are still workbench/scaffolding slices, introduced **AMP1-AMP12** as true multi-day assistant mega-programs, and added stricter completion gates requiring durable workflows, schema/data changes when needed, UI/API, tests, seed/demo acceptance, docs/changelog, commit, and push. |
| 2026-04-28 | **LMP31-LMP50 shipped as autonomy workbench:** added `/assistant/autonomy` plus `GET /api/assistant/autonomy-workbench` for controlled automation, override governance, domain expansion, API Hub readiness, rollout/enablement, policy/security controls, incident/resilience posture, digital-twin flow readiness, collaboration, sustainability data gaps, board reporting, AI admin readiness, demo scenario coverage, and AI operating-system scoring. |
| 2026-04-28 | **LMP11-LMP30 shipped as execution workbench:** added `/assistant/execution` plus `GET /api/assistant/execution-workbench` for carrier/customer communication, delivery promise risk, WMS task recovery, pricing/RFQ/invoice audit handoffs, commercial/executive signals, action queue operations, playbook/memory quality, evidence review, training/prompt candidates, quality gates, and shadow automation readiness. |
| 2026-04-28 | **LMP1-LMP10 shipped as first large-MP product slice:** added `/assistant/workbench` plus `GET /api/assistant/copilot-workbench` as a real copilot operating surface for assistant foundation hardening, sales-order drafts/customer replies, order exceptions, product availability/reallocation review, PO follow-up, supplier performance/onboarding, and shipment triage. |
| 2026-04-28 | **Large-MP process reset:** documented that previous MP50+ work became telemetry slices, added strict completion criteria for true Large Mega-Phases, and defined **LMP1-LMP50** as 50 much larger implementation programs that require real UI/API/data behavior, verification, changelog, commit, and push. |
| 2026-04-28 | **MP111-MP140 finished as MVP execution workbench:** command center now includes real operating sections for commercial/finance controls, operational and security controls, admin/evaluation governance, enterprise readiness, and digital-twin readiness using live assistant telemetry. |
| 2026-04-28 | **MP81-MP110 finished as MVP execution workbench:** command center now includes real operating sections for shadow automation, stakeholder reporting, predictive trust, orchestration/collaboration, and commercial impact using live assistant telemetry. |
| 2026-04-28 | **MP51-MP80 finished as MVP execution workbench:** command center now includes real operating sections for governance controls, value realization, domain expansion, scale operations, process intelligence, knowledge assets, and simulation readiness using live assistant telemetry. |
| 2026-04-28 | **MP140-MP189 shipped (MVP):** extended the assistant command center with advanced layers for digital twin readiness, planning, network collaboration, finance, sustainability, resilience, ecosystem integration, global governance, copilot UX, and autonomous readiness. |
| 2026-04-28 | **MP90-MP139 shipped (MVP):** extended the assistant command center with horizon layers for predictive operations, data quality, orchestration, collaboration, commercial/ops intelligence, security, admin governance, evaluation, and enterprise readiness. |
| 2026-04-27 | **MP70-MP89 shipped (MVP):** extended the assistant command center with maturity layers for process intelligence, knowledge system, automation rehearsal, and stakeholder experience. |
| 2026-04-27 | **MP50-MP69 shipped (MVP):** extended the assistant command center with grouped program layers for governance baseline, value realization, domain expansion, and scale operations. |
| 2026-04-27 | **MP45-MP49 shipped (MVP):** extended the assistant command center with SLA posture, training queue, prompt-library candidates, decision journal, and signal hygiene panels. |
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
