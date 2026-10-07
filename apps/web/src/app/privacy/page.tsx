import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/layout/legal-page";
import { BRAND, COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${BRAND.name} collects, uses and protects personal information.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`${BRAND.name} is operated by ${COMPANY.legalName}, ${COMPANY.location} ("we", "us"). This policy explains what personal information we collect when you use the site, why we collect it and the choices you have.`}
    >
      <LegalSection title="Information we collect">
        <p>
          <strong>Account details:</strong> your name, email address, password (stored only as a
          hash), role and the company you belong to.
        </p>
        <p>
          <strong>Company and listing details:</strong> business name, address, city, contact
          details, product listings, prices and any documents you upload for verification.
        </p>
        <p>
          <strong>Marketplace activity:</strong> requests for quotes, quotes, orders, delivery
          details, reviews, notifications and the messages and files you attach to them.
        </p>
        <p>
          <strong>Business records you enter:</strong> if you use our business tools (inventory,
          customers, invoices and similar), the records you create, including details of your own
          customers. You decide what to enter and remain responsible for it.
        </p>
        <p>
          <strong>Technical data:</strong> a session cookie that keeps you signed in, and basic
          server logs such as IP address and browser type that we use to keep the service secure.
        </p>
      </LegalSection>

      <LegalSection title="How we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>To create and run your account and show your company profile to other users.</li>
          <li>To route requests for quotes to suppliers and to deliver quotes, orders and updates.</li>
          <li>To verify businesses and keep the marketplace trustworthy.</li>
          <li>To send service emails such as sign-up, password reset and order notifications.</li>
          <li>To prevent fraud and abuse, to maintain audit records and to improve the service.</li>
          <li>To meet legal obligations.</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </LegalSection>

      <LegalSection title="What other users can see">
        <p>
          Supplier and store profiles, listings and reviews are public. When you send a request for
          quotes, the suppliers who receive it can see its contents and your company details. Your
          company&apos;s requests, quotes and orders are otherwise private to your company.
        </p>
        <p>Some profiles on the site are labelled as demo profiles and are not real businesses.</p>
      </LegalSection>

      <LegalSection title="Service providers we use">
        <p>
          We share information only as needed to run the service, with providers that act on our
          behalf: our web hosting provider, our managed database provider, our file storage
          provider, our email delivery provider and, when you use the optional AI bill-of-quantities
          feature, an AI provider that processes the text or files you submit to that feature. These
          providers may process data outside the UAE.
        </p>
        <p>
          We may also disclose information when the law requires it, or to protect our rights, our
          users or the service.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          We use a strictly necessary session cookie to keep you signed in. We do not currently use
          advertising cookies. If we add analytics or similar tools we will update this policy.
        </p>
      </LegalSection>

      <LegalSection title="Retention and security">
        <p>
          We keep information for as long as your account is active and for as long afterwards as
          needed for legitimate business, audit and legal purposes. We use access controls,
          encrypted connections and organisation-level separation of data to protect it, but no
          online service is completely secure.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <p>
          You can ask to access, correct or delete your personal information, to object to certain
          uses, or to close your account, subject to applicable UAE data protection law, including
          Federal Decree-Law No. 45 of 2021. Email us at{" "}
          <a className="text-brand-700 hover:underline" href={`mailto:${COMPANY.supportEmail}`}>
            {COMPANY.supportEmail}
          </a>{" "}
          and we will respond as soon as we reasonably can.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>The service is for businesses and is not directed at children under 18.</p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update this policy. The date at the top shows when it last changed. If the changes
          are significant we will notify account holders.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          {COMPANY.legalName}, {COMPANY.location}.{" "}
          <a className="text-brand-700 hover:underline" href={`mailto:${COMPANY.supportEmail}`}>
            {COMPANY.supportEmail}
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
