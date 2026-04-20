import Link from "next/link";

export const dynamic = "force-dynamic";

const GITHUB_DOCS_APIHUB_TREE =
  "https://github.com/lasealco/po-management/tree/main/docs/apihub";
const GITHUB_SPEC_BLOB =
  "https://github.com/lasealco/po-management/blob/main/docs/apihub/integrations-ai-assisted-ingestion.md";

const STEP_PLACEHOLDERS = [
  {
    n: 1,
    title: "Intent",
    body: "Pick scenario and target (for example, new shipments from a partner file or API shape).",
  },
  {
    n: 2,
    title: "Uploads + optional docs",
    body: "Bring sample files, example API JSON, and optional reference documents — not as a secret channel.",
  },
  {
    n: 3,
    title: "AI analysis job",
    body: "Async job proposes structured mappings under guardrails; operators stay in control.",
  },
  {
    n: 4,
    title: "Mapping editor",
    body: "Confirm source paths or columns → canonical fields, transforms, and required vs optional rules.",
  },
  {
    n: 5,
    title: "Validate + real UI preview",
    body: "Dry-run against staging and open real app surfaces (read-only or flagged preview) where possible.",
  },
] as const;

export default function ApihubHomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900">Integration and ingestion hub</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Single place for AI-assisted mapping proposals, human confirmation, and repeatable runs across file
              upload and server-to-server APIs. This page is a{" "}
              <span className="font-medium text-zinc-800">Phase P0</span> shell: documentation and UX scaffolding only
              — no connector database or live ingestion yet.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <a
              href={GITHUB_DOCS_APIHUB_TREE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
            >
              View docs on GitHub
            </a>
            <a
              href={GITHUB_SPEC_BLOB}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
            >
              Open full spec (markdown)
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STEP_PLACEHOLDERS.map((step) => (
            <div
              key={step.n}
              className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step {step.n} / 5</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900">{step.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600">{step.body}</p>
              <p className="mt-3 text-[11px] font-medium text-zinc-500">Placeholder — P1+</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">Health:</span>{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-zinc-800">GET /api/apihub/health</code>{" "}
          returns <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">ok</code>,{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">service</code>, and{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">phase</code> (no auth, no secrets).{" "}
          <Link href="/api/apihub/health" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            Try it
          </Link>
          .
        </div>
      </section>
    </main>
  );
}
