# AI Assistant — user positioning, UI principles, and delivery plan (GTM priority)

**Status:** Active program document. **Priority:** High — *presentable* assistant-led experience is a **primary differentiator** for sales and narrative; delivery should be **incremental** but **orchestrated** so the story stays coherent.

**Audience:** Product, design, sales enablement, engineering leads.  
**Last updated:** 2026-04-23

**Parent strategy:** [`PLATFORM_AI_FIRST_OPERATIONS_ROADMAP.md`](./PLATFORM_AI_FIRST_OPERATIONS_ROADMAP.md) (automation, human gates, phases A–F). **This** doc answers: *how we **talk** about the assistant*, *how it should **feel** in the UI*, and *how we **ship** it until a demo is credible*.

**What to type in Cursor / how to run long builds without daily check-ins** (UI-first “mega-phases” + your John/ABC scenario spec):  
[`AI_ASSISTANT_MEGA_PHASES_AND_PROMPTS.md`](./AI_ASSISTANT_MEGA_PHASES_AND_PROMPTS.md)

---

## 1. Why this program exists

**Commercial intent:** Position the product as a suite where the **AI assistant is the primary way to drive work**—not a sidebar gimmick. Full-suite, policy-governed, human-gated automation at scale is still rare; a **credible, coherent story + working pilot** in the product is a legitimate game changer for enterprise conversations.

**Product intent:** The assistant is the **operating layer**: understand context, reduce busy work, **draft** next steps, and surface **only** the approvals and exceptions that need a person—while **evidence** (orders, lines, stock, documents) stays visible and trustworthy.

---

## 2. How we position the assistant to the user (user-facing)

### 2.1 One-sentence promise

**“The assistant is how you run the system: it works with you on the record in front of you, handles the heavy lifting, and only stops you for the decisions that matter—money, customers, and commitments.”**

### 2.2 What we say / what we do not say

| Say | Do not say (or use only with legal/comms review) |
|-----|---------------------------------------------------|
| Copilot, **draft** first, you **approve** commits | “The AI replaces your team” |
| **Frees time** for customers and high-value work | “You can ignore the data” (undermines trust) |
| **Linked** to real objects (SO, PO, shipment) | “It knows everything” (over-promise) |
| **Policy** and **your org’s rules** | “Autonomous” without qualifying scope |
| **Evidence** in one click (sources, links) | Black-box answers on critical questions |

### 2.3 Tone for sales and in-app copy

- **Confident, precise, humble on limits:** we **assist** and **propose**; the user and policy **govern**.  
- **B2B-safe:** emphasis on time with customers, fewer handoffs, fewer errors—not leisure.

---

## 3. UI / UX principles (the “#1 interface” without a blocking overlay)

**Mental model:** The assistant is **#1 in priority** (how I get work done), **not** necessarily one full-screen layer that covers the whole app all the time.

| Principle | Meaning for design |
|-----------|-------------------|
| **Context first** | The assistant is **grounded in the current object** (order, quote, shipment) when possible—not only a global chat. |
| **Evidence visible** | Prefer **split layout or docked panel** so forms, tables, and line items stay in view; users trust what they can see. |
| **Global entry** | A **persistent command / ask bar** (or equivalent) so the user never hunts for “where is AI?” |
| **Work, not just chat** | Outputs are **actions**: open draft, run check, add to **inbox**, show **next best step** with links. |
| **Inbox is home for humans** | “What needs me?” is a **first-class** surface; the assistant **feeds** and **resolves** items—it is not the only list. |
| **Mobile** | Thinner app: **notifications, approvals, short Q&A**, agent for triage; deep work can **hand off** to full web. |

**Summary line for designers:** *Primary in the **workflow**; not necessarily a full-screen **mask** on the **data**.*

---

## 4. What “presentable” means (definition of done for GTM v1)

**“Presentable”** = a **repeatable, scripted demo** (10–20 minutes) you can run for a serious prospect **without** apologizing for broken flows or “imagine that X exists.”

### 4.1 Minimum credible story (suggested)

1. **Global entry** — user opens the app and immediately sees *how to ask / command* and *what needs attention* (even if the inbox is still thin).  
2. **Object-grounded** — on at least **one** golden object (e.g. sales order or quote path), the assistant: summarizes state, points to **evidence** (link or section), and proposes a **draft** or next step.  
3. **Human gate** — one **clear** approval or confirm step for a **sensitive** action (e.g. “create draft but do not auto-send email”).  
4. **Trust** — **citations** or “open record” in one click from the assistant response (no black box on business facts).  
5. **Narrative** — a **one-pager** and **2-minute** pitch aligned with section 2 (for sales/CS).

*Optional for v1.5 (still “wow” but not blockers for first executive demo):* email ingested as an inbox item, internal comment thread on an object, second module touched (e.g. Control Tower or stock check).

### 4.2 Explicit non-goals for “first presentable”

- Full “every module fully agentic.”  
- Unsupervised **outbound** customer email.  
- Org-wide real-time **chat** as a full product (can remain **separate** on the roadmap; see platform doc).  

---

## 5. Workstreams (how we parallelize work)

Workstreams are **ownable slices**; they can be staffed by different people. **Dependencies** are noted so sequencing stays clear. (This is a **human** coordination model, not a technical requirement for a specific tool or agent framework.)

| ID | Workstream | Purpose |
|----|------------|---------|
| **WS-A** | **Shell & navigation** | Persistent ask/command entry, layout pattern (side panel + main content), “assistant home” or equivalent entry. |
| **WS-B** | **Attention / Inbox (MVP)** | Unified or semi-unified “needs me” list; link-out to system of record; status open/resolved; assignment optional in MVP. |
| **WS-C** | **Agent depth (golden path)** | One **end-to-end** scenario (e.g. “explain + draft next step” on a commercial object) with **allowlisted** tools and **policy** flags. |
| **WS-D** | **Trust & audit UX** | Citations, “why this,” links to record/draft, audit trail discoverable from the object. |
| **WS-E** | **GTM & narrative** | One-pager, demo script, FAQ for objections, competitive framing (assisted, not “magic”). |
| **WS-F** | **Policy & platform hooks** | Where draft/commit and approval live per tenant/role; ADR-level alignment with [`PLATFORM_AI_FIRST_OPERATIONS_ROADMAP.md`](./PLATFORM_AI_FIRST_OPERATIONS_ROADMAP.md). |

**Typical dependencies:**  
- WS-A and WS-B **reinforce** each other: inbox without entry feels orphaned; entry without work feels empty. **Ship a thin version of both** in the first milestone.  
- WS-C needs **F** (policy) to avoid throwaway work.  
- WS-D is **non-optional** for enterprise credibility.  
- **WS-E** can start **in parallel** with build (narrative can track reality).

---

## 6. Phased delivery (milestones toward presentable)

Milestones are **ordered**; some tasks **inside** a milestone can run in parallel across workstreams.

| Milestone | Target outcome | Workstreams (primary) |
|-----------|----------------|------------------------|
| **M0 — Align** | Locked **golden path** scenario, user principles (this doc §2–3), “presentable” checklist (§4). | E, F, product |
| **M1 — Shell** | **Persistent** assistant entry + **docked** contextual surface; works on at least one page without breaking legacy flows. | A |
| **M2 — Attention** | **MVP** inbox or unified “open items” fed by ≥2 **real** producers (e.g. existing alerts + one workflow). | B, (A) |
| **M3 — Golden path** | **L1–L2** on one object: assist + **draft** + **one** clear approval; citations/links (WS-D). | C, D, F |
| **M4 — Presentable** | **Scripted demo** passes §4.1; one-pager and pitch (§4.1 item 5). | E + hardening of A–D |

**Dates:** set in planning (e.g. quarterly). This file stays **milestone-based** so it does not go stale the day a calendar slips.

**Review cadence (suggested):** **Weekly** 30 min sync: demo risk, blockers, scope guard (avoid scope creep in “M4”). **Milestone** review: “Does this still look like *one* product story?”

---

## 7. How engineering can execute (practical, no specific tooling)

1. **Single product narrative owner** (product or lead engineer): resolves conflicts between “just add a chat” vs “inbox + shell.”  
2. **Demo-first inside milestones:** the **shortest** path that **films** well often beats the **most complete** back-office slice.  
3. **One golden path to completion** before a **second** path: parallel **workstreams**, but **one** story for M4.  
4. **Feature flags** for half-baked **assistant** features so the **rest** of the app stays shippable.  
5. **Track against §4.1** weekly; if the demo script grows, **cut** scope, not trust (WS-D).  

*Optional:* Internal runbooks (not in this repo) can name **DRI** per workstream. Sub-agents or AI coding tools are **implementation choices** and do not change the milestones above.

---

## 8. Relationship to other documents

| Document | Role |
|----------|------|
| [`PLATFORM_AI_FIRST_OPERATIONS_ROADMAP.md`](./PLATFORM_AI_FIRST_OPERATIONS_ROADMAP.md) | Platform-wide automation, human gates, phases A–F, L0–L3 ladder. |
| `docs/controltower/GAP_MAP.md`, `docs/wms/GAP_MAP.md`, etc. | Module gaps; **feed** the inbox and agent tools, not the assistant narrative. |
| Future **inbox / comms** spec | Detailed data model; should align with **WS-B** and Phase B in the platform doc. |
| This file | **GTM + UX + delivery plan** for the assistant *experience* and *presentable demo*. |

---

## 9. Changelog

| Date | Change |
|------|--------|
| 2026-04-23 | Link to [`AI_ASSISTANT_MEGA_PHASES_AND_PROMPTS.md`](./AI_ASSISTANT_MEGA_PHASES_AND_PROMPTS.md) (what to type; MP1–MP4). |
| 2026-04-23 | Initial version: positioning, UI principles, presentable definition, workstreams, milestones M0–M4, execution notes. |
