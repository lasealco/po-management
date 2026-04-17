import type { Metadata } from "next";

import { LegalSiteFooter, LegalSiteNav } from "@/components/legal-site-chrome";
import { SITE_BRAND_HEX } from "@/components/brand-mark";

export const metadata: Metadata = {
  title: "Privacy Policy | AR SCMP",
  description: "How AR SCMP handles personal data during the research and development phase.",
};

const privacyEmail = "privacy@arscmp.com";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800 antialiased">
      <LegalSiteNav />

      <div className="border-b border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="mb-4 text-balance text-4xl font-black text-slate-900 lg:text-5xl">
            Privacy Policy
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
              <strong>Project Status:</strong> AR SCMP is currently a personal research project. This
              privacy policy describes our current data practices during the development and testing
              phase.
            </p>
          </div>

          <article className="[&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-slate-900 [&_h2]:first:mt-0 [&_li]:mb-2 [&_p]:mb-5 [&_p]:leading-relaxed [&_p]:text-slate-600 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ul]:text-slate-600">
            <h2>1. Who we are</h2>
            <p>
              The <strong>AR SCMP Project</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
              is a personal research initiative developing a modular supply chain management platform.
              As this is currently a research project and not a commercial entity, the project is operated
              by the AR SCMP project team. Our contact email for privacy-related questions is{" "}
              <a
                href={`mailto:${privacyEmail}`}
                className="font-bold underline-offset-2 hover:underline"
                style={{ color: SITE_BRAND_HEX }}
              >
                {privacyEmail}
              </a>
              .
            </p>

            <h2>2. Scope</h2>
            <p>
              This Privacy Policy explains how we collect, use, store, and share personal data when you
              visit the AR SCMP website, request a demo, contact us, create a test account, or otherwise
              interact with the site during this current research and development phase.
            </p>

            <h2>3. Data we may collect</h2>
            <p>During the development phase, we may collect:</p>
            <ul>
              <li>
                <strong>Identity data:</strong> such as name, project role, or company name if provided.
              </li>
              <li>
                <strong>Contact data:</strong> primarily your email address for account management or
                enquiries.
              </li>
              <li>
                <strong>Technical data:</strong> such as IP address, browser type, and device information
                used to access the test environment.
              </li>
              <li>
                <strong>Usage data:</strong> details of how you interact with the platform features to help
                us improve the system.
              </li>
              <li>
                <strong>Project Content:</strong> data entered into modules (e.g., sample shipment info)
                for the purpose of testing platform logic.
              </li>
            </ul>

            <h2>4. Why we use personal data</h2>
            <p>We use your data strictly to:</p>
            <ul>
              <li>Operate and secure the development environment.</li>
              <li>Gather feedback to improve platform functionality.</li>
              <li>Provide access to demo accounts or technical support.</li>
              <li>Maintain basic security logs for the research environment.</li>
            </ul>

            <h2>5. Legal basis</h2>
            <p>
              We process your data based on your <strong>consent</strong> (e.g., when you sign up for a
              demo) and our <strong>legitimate interest</strong> in developing and testing the AR SCMP
              platform.
            </p>

            <h2>6. Cookies</h2>
            <p>
              We use essential cookies to keep you logged in to the test environment. We do not
              currently use third-party advertising trackers.
            </p>

            <h2>7. Sharing of data</h2>
            <p>
              We do not sell your data. Data may be stored with our infrastructure providers (such as
              cloud hosting services) solely for the purpose of running the project.
            </p>

            <h2>8. International transfers</h2>
            <p>
              As a global research project, data may be processed in countries where our hosting providers
              maintain servers. We ensure basic security standards are met for these services.
            </p>

            <h2>9. Data retention</h2>
            <p>
              We retain personal data only for the duration of the research project or until you request
              its deletion. Test data may be reset or deleted periodically as we update the platform.
            </p>

            <h2>10. Security</h2>
            <p>
              We use standard security measures to protect the platform. However, as this is a{" "}
              <strong>research project in development</strong>, you should not upload highly sensitive
              personal or commercial information that requires enterprise-grade legal guarantees.
            </p>

            <h2>11. Your rights</h2>
            <p>
              You can request to see, correct, or delete your data at any time by contacting us at the
              project email address provided above.
            </p>

            <h2>12. Children</h2>
            <p>
              This project is intended for professional and research audiences and is not intended for
              children.
            </p>

            <h2>13. Changes</h2>
            <p>We will update this policy as the project evolves towards a more formal structure.</p>
          </article>

          <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-slate-100 pt-10 sm:flex-row">
            <p className="text-sm text-slate-500">Have questions about this project?</p>
            <a
              href={`mailto:${privacyEmail}?subject=Privacy%20inquiry`}
              className="rounded-lg bg-slate-100 px-6 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
            >
              Email the Project Lead
            </a>
          </div>
        </div>
      </main>

      <LegalSiteFooter highlight="privacy" />
    </div>
  );
}
