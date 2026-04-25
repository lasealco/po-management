# Platform roadmap — AI-first operations (draft for maintainers)

**Status:** Steering document. **Does not** replace module-specific GAP maps or the Control Tower / WMS phased backlog; it **sits above** them as the **automation + human-gate** narrative for the whole product.

**Audience:** Product, engineering, solution design.  
**Last updated:** 2026-04-23

---

## 1. Why this document exists

The product is built on strong **traditional** foundations: explicit forms, workflows, and approvals. That remains **necessary** for trust, compliance, and “last mile” judgment. The risk is **accidental** architecture: every new feature assumes a human at every step **forever**. This doc states the **intentional** alternative: **design for high automation with explicit, narrow human gates**—so that when models and policies improve, the product **does not** require a rewrite.

**Directional vision (not a promise or headcount plan):** large enterprises may shift from “many people entering and reconciling data” to “fewer people **monitoring**, **exception-handling**, and **approving** high-impact actions.” The platform should **allow** that trajectory without assuming a fixed ratio.

---

## 2. North-star goals

| # | Goal |
|---|------|
| **G1** | **AI automation across all modules**—not as a sidecar, but as a **first-class path**: understand state → propose → (optional) execute within **policy**. |
| **G2** | **Human-in-the-loop for critical commits** until policy and evidence allow otherwise: quotations, PO, SO, supplier approval, sensitive API/connector changes, **outbound email**, money-impacting actions, and anything with **legal exposure**. |
| **G3** | **Same story for ApiHub**: ingestion, mapping, and connector operations should be **agent-assistable** and **policy-governed**, with approval for production-impacting changes. |
| **G4** | **Learning from outcomes**: human corrections and approvals are **structured signal** (what changed, why, which alternative was chosen)—not an afterthought. |
| **G5** | **Cross-surface coherence**: desktop = full truth + deep exception handling; mobile = **attention, chat, approve/deny, agent Q&A**—without duplicating every form. |

---

## 3. Design principles (build for tomorrow in *concrete* terms)

These are **architectural**, not slogans.

1. **Draft vs commit**  
   Every automation path should distinguish **proposed** state from **committed** state. “Agent created a draft” must be a **normal** outcome, not a hack.

2. **Policy over prompt**  
   What the agent may do is defined by **tenant/role/workflow policy**, not by whatever the model suggests. Prompts improve; **policy** is the contract.

3. **Evidence and links**  
   Automated and semi-automated actions must store **pointers** to the data used (inventory snapshot, rule version, email id, document id). Humans and auditors must **verify in one click**.

4. **Idempotency and safety**  
   Email, webhooks, and agent runs will **retry**. Design so double-delivery does not double-commit.

5. **No silent external side effects**  
   Outbound customer email and external API writes default to **draft or require explicit send approval**—configurable per tenant/role.

6. **Inbox as coordination layer**  
   A future **Communication / Operations Inbox** (org vs personal, assignable, open/resolved) is the **spine** for “what needs a human” across modules—not a replacement for each domain’s system of record.

7. **Modular “chat”**  
   Real-time org chat can be a **separate** product module but must **link** to business objects (order, PO, shipment) so history is **one timeline** (email + chat + system events) where the product needs it.

---

## 4. Cross-cutting platform capabilities (the “ladder” every module climbs)

For **each** major domain (PO, SO, WMS, tariffs/RFQ, SRM, Control Tower, ApiHub, CRM, comms), plan three **capability levels**. Features can ship in any order, but the **interfaces** should not block level 2 and 3.

| Level | Name | What it means |
|-------|------|----------------|
| **L0** | Manual | User drives forms; system records. (Baseline today.) |
| **L1** | Assisted | **Same** forms, but AI fills, explains, checks; user confirms. **Learning hooks** store corrections. |
| **L2** | Draft automation | Agent creates/updates **drafts** in the right workflow; human **approves** a small set of high-impact steps. |
| **L3** | Monitored (policy-bound) | Agent executes within **explicit** policy; humans **monitor** exceptions and rare approvals. (Enable only when evidence + policy allow—not a universal default.) |

**Important:** L3 is **not** “turn off humans.” It is “humans are **exception handlers** and **policy owners**, not data entry by default.”

---

## 5. Executable phases (high level)

Phases are **sequenced for risk reduction**, not for “AI glitter.” Each phase has **deliverables** and **exit criteria** so you can stop or parallelize per module.

### Phase A — **Foundations (no new “AI feature” required to start)**

**Deliverables**

- **Unify language**: “draft / pending approval / committed” where applicable per module.  
- **Audit & actor**: who approved what, on which version (already partially present; extend consistently).  
- **Event or activity list** (even if per-object first): a **timeline** on key entities (order, PO, shipment, connector run).  
- **Policy placeholders**: document which actions are *never* auto-commit without approval (tenant-configurable list as a product artifact).

**Exit criteria**

- A new engineer can answer: “If an agent created a draft SO, where would approval live and what would be audited?” for **at least two** core domains (e.g. one commercial + one logistics).

---

### Phase B — **In-app Communication & Inbox (MVP)**

**Intent:** One place for **actionable** work (open / resolved, assign to me / team, link to source record). **Not** a full email client on day one.

**Deliverables**

- Inbox model: **actionable item** (type, priority, link-out, status, assignee, team queue).  
- Producers: start with 2–3 you control (e.g. Control Tower exceptions/alerts, selected workflow events, import failures).  
- **Optional** per item: “agent summary” and “suggested next action” (read-only assist).

**Exit criteria**

- A user can clear their “my open items” without opening five different apps inside the product.  
- Every inbox row deep-links to a **system-of-record** screen.

*Email as ingestion* can **start in Phase C** or be an **optional track** in parallel if OAuth and security are ready—do not block Phase B on it.

---

### Phase C — **Email integration (optional feature flag)**

**Deliverables**

- OAuth connectors (Gmail, Microsoft 365) **per user or per shared mailbox** (product decision; document it).  
- Inbound: normalized **external thread** + attachment references → **inbox item** or attached to an entity.  
- Outbound: **draft reply** in system; default **“confirm before send”** (tenant/role config).  
- **No silent send** for external customer mail unless explicitly policy-enabled.

**Exit criteria**

- Sales scenario at least in **pilot** form: “email in → item created → user sees draft + linked entity → optional send with confirmation.”

---

### Phase D — **Cross-module “agentic” playbooks (draft + approval)**

**Intent:** The scenarios you described: inventory check → **draft SO**; trace → **explain**; no supply → **draft PO to preferred supplier**—all as **staged** automations with **citations** to internal data.

**Deliverables**

- **Playbook** definition (inputs, steps, which APIs/tools are called, which outputs are drafts).  
- **Allowlisted tools** and **per-step approval** (similar in spirit to existing Control Tower assist allowlisting, expanded by domain).  
- **Correction capture**: when a human edits a draft, store **field-level or semantic diff** for future suggestions.

**Exit criteria**

- One end-to-end **pilot** playbook with measurable time saved and **zero** unapproved external commits in default config.

---

### Phase E — **ApiHub: automation + governance**

**Deliverables**

- **Agent-assist** for: mapping suggestions, error triage, documentation of connector behavior, “what failed and why” summaries.  
- **Policy**: production connector changes, credentials, and **send-to-partner** actions require **approval** (or dual control if you go there).  
- **Run observability** as first-class: runs, retries, idempotency keys, “safe replay” where applicable.

**Exit criteria**

- Clear matrix: which ApiHub operations are L1 vs L2 vs (future) L3, and who can approve.

---

### Phase F — **Mobile: attention + agent surface**

**Deliverables**

- Notifications, inbox, approve/deny for **gated** actions, **chat** linked to objects.  
- “Open in full web app” for heavy exceptions.  
- Agent Q&A with **strict scope** (what data the mobile client may surface).

**Exit criteria**

- A field user can **act** on a time-sensitive approval without using a laptop for the full ERP.

---

## 6. “We’re building for today” — what to **stop** and what to **do instead**

| Anti-pattern | Instead |
|--------------|--------|
| Every new screen is a form with no “draft from agent” hook | **Same** form, but API + state support **AI-filled drafts** and **version compare** before commit. |
| Integrations that only work if a human clicks through | Headless path for **proposed** payload + **approval** event. |
| Inbox in each module with no common ID for “work item” | **One** work-item contract (or clear bridge) to the Communication layer. |
| “We’ll add AI later” with no event or audit | **Log decisions and corrections** from day one—they're the **training set** and the **trust** story. |

---

## 7. Learning from actions (realistic stages)

- **Stage 1 — Structured corrections:** store before/after on drafts, who changed, optional reason code.  
- **Stage 2 — Preference and ranking:** e.g. supplier A vs B when price and history differ; “prefer domestic when delta < X” as **rules**, not only ML.  
- **Stage 3 — Model-assisted policy:** only after measurement; **governance** for bias and drift.

Label “learning” honestly in the product: **assisted** recommendations are not the same as **autonomous** learning.

---

## 8. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Over-automation in regulated contexts | **Policy**, approval tiers, and audit by default. |
| Users don’t trust the agent | **Citations**, drafts, and “why this suggestion” with links. |
| Email integration scope creep | **Feature flag**, pilot tenant, and **confirm-before-send** default. |
| Org change narrative (20k → 2k) | **Directional** only; real adoption is **per tenant** and **per process**. The platform enables **reduction in manual touchpoints**, not headcount planning. |

---

## 9. How this document relates to other plans

- **GTM + assistant UX + “presentable demo” delivery** — how we *position* the assistant, *shell/inbox* principles, and **milestone M0–M4** to ship a **sales-ready** experience:  
  [`AI_ASSISTANT_UX_GTM_AND_DELIVERY_PLAN.md`](./AI_ASSISTANT_UX_GTM_AND_DELIVERY_PLAN.md)  
- **What to ask the build agent, UI-first mega-phases (MP1 = demo SO path), copy-paste prompts:**  
  [`AI_ASSISTANT_MEGA_PHASES_AND_PROMPTS.md`](./AI_ASSISTANT_MEGA_PHASES_AND_PROMPTS.md)  
- **Control Tower + WMS** five-phase post-tranche backlog: [`CONTROL_TOWER_WMS_BACKLOG_5_PHASES.md`](./CONTROL_TOWER_WMS_BACKLOG_5_PHASES.md) — keep module delivery there; this doc explains **why** those slices fit the larger automation story.  
- **Module GAPs** (e.g. `docs/controltower/GAP_MAP.md`, `docs/wms/GAP_MAP.md`): use them for *what’s missing*; use **this** doc for *how AI and human gates should evolve together*.  
- **Comms / inbox / email / chat** product spec: when written, it should **reference Phase B–C** here and add **data model and UX** detail; align with **WS-B** in the GTM/UX plan.

---

## 10. Recommended next steps (so this becomes executable)

1. **Run the GTM/UX program** in [`AI_ASSISTANT_UX_GTM_AND_DELIVERY_PLAN.md`](./AI_ASSISTANT_UX_GTM_AND_DELIVERY_PLAN.md) (M0–M4, workstreams) as the **priority track** for a coherent assistant story.  
2. **Product sign-off** on Phase A–B scope and the **inbox** vs **per-module queue** question (complementary vs. replacement).  
3. **One** “golden path” pilot (e.g. sales email → SO draft) with **non-negotiables**: draft-only, confirm send, full audit.  
4. **Architecture decision record (ADR)**: *policy store* (where rules live) and *agent tool allowlist* per tenant—**before** scaling playbooks.  
5. **ApiHub** row in the L0–L3 matrix filled by owners (ingestion, mapping, credentials, production sends).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-23 | Linked **AI assistant mega-phases + prompting** (`AI_ASSISTANT_MEGA_PHASES_AND_PROMPTS.md`). |
| 2026-04-23 | Linked **AI assistant UX + GTM delivery plan**; extended recommended next steps. |
| 2026-04-23 | Initial draft: vision, principles, phases A–F, learning and risk sections. |
