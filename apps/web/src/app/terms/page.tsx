import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/layout/legal-page";
import { BRAND, COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: `The terms that apply when you use ${BRAND.name}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro={`These terms apply to your use of ${BRAND.name}, operated by ${COMPANY.legalName}, ${COMPANY.location} ("we", "us"). By creating an account or using the site you agree to them. If you use it for a company, you confirm you are authorised to bind that company.`}
    >
      <LegalSection title="What the service is">
        <p>
          {BRAND.name} is an online marketplace and software service for the building-materials
          industry. It helps buyers find suppliers, request and compare quotes and manage orders,
          and helps suppliers and stores list products and respond to requests.
        </p>
        <p>
          We are a platform. Quotes, orders and deliveries are agreements between buyers and
          suppliers. Unless we say otherwise in writing, we are not a party to them and we do not
          sell, store or deliver the materials.
        </p>
      </LegalSection>

      <LegalSection title="Accounts">
        <ul className="list-disc space-y-1 pl-5">
          <li>Give accurate information and keep it up to date.</li>
          <li>
            Keep your password confidential. You are responsible for activity on your account.
          </li>
          <li>Tell us promptly if you think your account has been misused.</li>
          <li>You must be at least 18 and able to enter a binding contract.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Listings, quotes and reviews">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Suppliers and stores are responsible for the accuracy of their listings, prices, stock,
            delivery terms and quotes, and for having the right to sell what they list.
          </li>
          <li>
            A verified badge means a business passed our document checks at the time. It is not a
            guarantee of quality, financial standing or performance. Do your own due diligence.
          </li>
          <li>
            Reviews must be honest and based on a real transaction. We may remove reviews that are
            not.
          </li>
          <li>
            Some profiles are labelled as demo profiles. They are examples and not real businesses
            you can buy from.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            post false, misleading or unlawful content, or content that infringes others&apos;
            rights;
          </li>
          <li>
            use the service to harass others, send spam or request quotes you do not intend to
            consider;
          </li>
          <li>scrape the site, bypass its security or access another company&apos;s data;</li>
          <li>interfere with the service or use it to distribute malware;</li>
          <li>
            take deals that began on the platform off it in order to avoid obligations you owe us.
          </li>
        </ul>
        <p>We may suspend or remove accounts and content that breach these terms.</p>
      </LegalSection>

      <LegalSection title="Plans and fees">
        <p>
          Some features are free and others need a paid plan, as shown on our{" "}
          <Link className="text-brand-700 hover:underline" href="/pricing">
            pricing page
          </Link>
          . Paid plans are currently activated by our team rather than by online checkout. We will
          agree the price and billing period with you before charging anything. We may change plans
          and prices with reasonable notice.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          You keep ownership of what you upload. You give us a licence to host, display and process
          it as needed to run the service, including showing your public profile and listings to
          other users. You confirm you have the right to provide it.
        </p>
      </LegalSection>

      <LegalSection title="Our service and intellectual property">
        <p>
          The site, software, design and brand belong to us or our licensors. These terms do not
          give you any right to them except to use the service as intended. Tools such as
          calculators and smart matching give estimates and suggestions only. Check quantities,
          specifications and suitability yourself or with a qualified professional before ordering.
        </p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          We work to keep the service available but do not promise it will be uninterrupted or
          error-free. We may change or withdraw features. You may close your account at any time by
          contacting us, and we may suspend or close accounts that breach these terms.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers and liability">
        <p>
          The service is provided &quot;as is&quot;. To the extent the law allows, we are not liable
          for disputes between users, for the quality, safety or delivery of materials, or for
          indirect or consequential loss, lost profit or lost data. Our total liability to you for
          any claim relating to the service is limited to the fees you paid us in the 12 months
          before the claim, or AED 1,000 if you paid nothing. Nothing in these terms excludes
          liability that cannot be excluded by law.
        </p>
      </LegalSection>

      <LegalSection title="Privacy">
        <p>
          Our{" "}
          <Link className="text-brand-700 hover:underline" href="/privacy">
            Privacy Policy
          </Link>{" "}
          explains how we handle personal information.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These terms are governed by the laws of the United Arab Emirates as applied in the Emirate
          of Ras Al Khaimah, and the courts there have jurisdiction, unless mandatory law says
          otherwise.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          We may update these terms. The date at the top shows the latest version, and continued use
          after a change means you accept it. Questions:{" "}
          <a className="text-brand-700 hover:underline" href={`mailto:${COMPANY.supportEmail}`}>
            {COMPANY.supportEmail}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
