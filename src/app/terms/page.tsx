import type { Metadata } from "next";

import { LegalSiteFooter, LegalSiteNav } from "@/components/legal-site-chrome";
import { SITE_BRAND_HEX } from "@/components/brand-mark";

export const metadata: Metadata = {
  title: "Terms of Use | AR SCMP",
  description: "Terms governing access to the AR SCMP research and evaluation environment.",
};

const legalEmail = "legal@arscmp.com";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800 antialiased">
      <LegalSiteNav />

      <div className="border-b border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="mb-4 text-balance text-4xl font-black text-slate-900 lg:text-5xl">
            Terms of Use
          </h1>
          <p className="text-sm font-medium uppercase italic tracking-wide text-slate-500">
            Last updated: April 17, 2026
          </p>
        </div>
      </div>

      <main className="py-20">
        <div className="mx-auto max-w-3xl px-4">
          <div
            className="mb-12 flex gap-3 rounded-r-xl border-l-4 p-6"
            style={{
              borderLeftColor: SITE_BRAND_HEX,
              backgroundColor: "rgba(22, 91, 103, 0.06)",
            }}
          >
            <svg
              className="h-6 w-6 shrink-0"
              style={{ color: SITE_BRAND_HEX }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm leading-relaxed text-slate-700">
              <strong>Evaluation &amp; Testing:</strong> These terms cover the use of AR SCMP as a
              personal research project. Access is provided for evaluation and feedback purposes during
              this pre-release phase.
            </p>
          </div>

          <article className="[&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-slate-900 [&_h2]:first:mt-0 [&_li]:mb-2 [&_p]:mb-5 [&_p]:leading-relaxed [&_p]:text-slate-600 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ul]:text-slate-600">
            <h2>1. Agreement to these Terms</h2>
            <p>
              These Terms of Use govern access to and use of the AR SCMP website and any related
              demonstration, testing, preview, sandbox, or pre-release platform environment made
              available by the <strong>AR SCMP Research Initiative</strong>. By accessing or using the
              website or platform, you agree to these Terms.
            </p>

            <h2>2. Development and testing status</h2>
            <p>
              AR SCMP is currently under development. Features, content, interfaces, and workflows may
              change at any time. The platform may be incomplete, unavailable, or reset without notice.
              Access is provided on a trial, evaluation, or testing basis.
            </p>

            <h2>3. Eligibility and accounts</h2>
            <p>
              You may use the platform only if you are authorized to do so. You are responsible for
              keeping your login details private and for all activities under your account. Please notify
              us immediately if you suspect unauthorized access.
            </p>

            <h2>4. Acceptable use</h2>
            <p>You must not:</p>
            <ul>
              <li>Misuse or interfere with the platform&apos;s security or integrity.</li>
              <li>Attempt unauthorized access or upload malicious code.</li>
              <li>Reverse engineer the platform or scrape data at scale.</li>
              <li>Use the platform for illegal purposes.</li>
              <li>Upload sensitive personal or export-controlled data without written authorization.</li>
            </ul>

            <h2>5. Test data and uploaded content</h2>
            <p>
              You retain rights to the content you upload, but you grant us the rights needed to host,
              process, and test the platform using that content. We may remove content that creates legal
              or security risks.
            </p>

            <h2>6. No production reliance</h2>
            <p>
              The platform is <strong>not intended for live production</strong> or critical business
              decisions during this development phase. Any tracking, reporting, or analytics outputs are
              provided for testing purposes only and should not be relied upon for financial or
              operational accuracy.
            </p>

            <h2>7. Intellectual property</h2>
            <p>
              We own the AR SCMP website, software, and design. No rights are granted to you except for
              the limited right to use the platform for evaluation as described in these Terms.
            </p>

            <h2>8. Availability and changes</h2>
            <p>
              We may modify, suspend, or stop any part of the platform at any time. We may also reset or
              delete test data as part of our development process.
            </p>

            <h2>9. Confidentiality</h2>
            <p>
              If you access non-public features, screenshots, or materials, please treat them as
              confidential unless we explicitly state they are public.
            </p>

            <h2>10. Disclaimers</h2>
            <p>
              The platform is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; We do not
              provide any warranties regarding its accuracy, completeness, or uninterrupted operation
              during this research phase.
            </p>

            <h2>11. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, the AR SCMP project team will not be liable for
              any indirect, special, or consequential damages resulting from your use of the platform.
            </p>

            <h2>12. Suspension and termination</h2>
            <p>
              We may suspend or stop your access at any time due to misuse, security risks, or the end of
              the testing phase.
            </p>

            <h2>13. Governing law</h2>
            <p>
              These Terms are governed by the laws of your country or region of residence, without
              regard to conflict-of-law principles, except where mandatory local law (including consumer
              protection) applies to you.
            </p>

            <h2>14. Contact</h2>
            <p>
              Questions regarding these Terms can be sent to{" "}
              <a
                href={`mailto:${legalEmail}`}
                className="font-bold underline-offset-2 hover:underline"
                style={{ color: SITE_BRAND_HEX }}
              >
                {legalEmail}
              </a>
              .
            </p>
          </article>

          <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-slate-100 pt-10 sm:flex-row">
            <p className="text-sm text-slate-500">Need clarification on these terms?</p>
            <a
              href={`mailto:${legalEmail}?subject=Terms%20of%20Use%20inquiry`}
              className="rounded-lg bg-slate-100 px-6 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
            >
              Email legal
            </a>
          </div>
        </div>
      </main>

      <LegalSiteFooter highlight="terms" />
    </div>
  );
}
