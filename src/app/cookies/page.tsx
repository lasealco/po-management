import type { Metadata } from "next";

import { SITE_BRAND_HEX } from "@/components/brand-mark";
import { LegalSiteFooter, LegalSiteNav } from "@/components/legal-site-chrome";
import { LEGAL_COOKIES_PATH } from "@/lib/legal-public-paths";

export const metadata: Metadata = {
  title: "Cookie Notice | AR SCMP",
  description: "How AR SCMP uses cookies and similar technologies during the research phase.",
  alternates: { canonical: LEGAL_COOKIES_PATH },
};

const privacyEmail = "privacy@arscmp.com";

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800 antialiased">
      <LegalSiteNav />

      <div className="border-b border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="mb-4 text-balance text-4xl font-black text-slate-900 lg:text-5xl">
            Cookie Notice
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
              <strong>Personal Research Project:</strong> This notice explains how cookies are used on
              the AR SCMP project website during this research and testing phase.
            </p>
          </div>

          <article className="[&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-slate-900 [&_h2]:first:mt-0 [&_li]:mb-2 [&_p]:mb-5 [&_p]:leading-relaxed [&_p]:text-slate-600 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ul]:text-slate-600">
            <h2>1. What this notice covers</h2>
            <p>
              This Cookie Notice explains how the <strong>AR SCMP Research Initiative</strong>{" "}
              (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) uses cookies and similar technologies
              on our website and testing pages.
            </p>

            <h2>2. What cookies are</h2>
            <p>
              Cookies are small text files stored on your device. We may also use similar technologies
              like local storage or scripts to recognize your browser and remember your settings.
            </p>

            <h2>3. Types of cookies we use</h2>
            <ul>
              <li>
                <strong>Essential cookies:</strong> These are required for the site to work. They handle
                things like logging you in and keeping your session secure.
              </li>
              <li>
                <strong>Performance cookies:</strong> These help us understand how the platform is used so
                we can fix technical problems and improve the research project.
              </li>
              <li>
                <strong>Preference cookies:</strong> These remember your choices, like your preferred
                language or display settings.
              </li>
            </ul>

            <h2>4. How we use them</h2>
            <p>
              We use these technologies to keep you signed in, protect your account, and measure traffic
              to understand which features are most useful to our research participants.
            </p>

            <h2>5. Your choices</h2>
            <p>
              You can manage or disable cookies through your browser settings. Please note that if you
              disable essential cookies, some parts of the test platform may not function correctly.
            </p>

            <h2>6. Third-party services</h2>
            <p>
              We may use third-party tools for analytics or technical support. These providers may set
              their own cookies according to their own privacy policies.
            </p>

            <h2>7. Changes</h2>
            <p>
              We may update this notice as the project develops. The latest version will always be
              available here.
            </p>

            <h2>8. Contact</h2>
            <p>
              If you have questions about how we use cookies, please contact us at{" "}
              <a
                href={`mailto:${privacyEmail}`}
                className="font-bold underline-offset-2 hover:underline"
                style={{ color: SITE_BRAND_HEX }}
              >
                {privacyEmail}
              </a>
              .
            </p>
          </article>

          <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-slate-100 pt-10 sm:flex-row">
            <p className="text-sm text-slate-500">Need more information?</p>
            <a
              href={`mailto:${privacyEmail}?subject=Cookie%20Notice%20inquiry`}
              className="rounded-lg bg-slate-100 px-6 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
            >
              Email project team
            </a>
          </div>
        </div>
      </main>

      <LegalSiteFooter highlight="cookies" />
    </div>
  );
}
