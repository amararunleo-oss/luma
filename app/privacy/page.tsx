import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata = { title: `Privacy Policy | ${SITE.name}`, description: `${SITE.name} privacy and data-use policy.`, alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return <LegalPage eyebrow="Policy" title="Privacy Policy" intro="How technical and advertising data is handled.">
    <section><h2>Data collected automatically</h2><p>Hosting and security providers may process IP addresses, request headers, device information, timestamps and requested URLs to deliver the site, prevent abuse and diagnose errors.</p></section>
    <section><h2>Search and catalog use</h2><p>Search terms are used to return results. The current site does not require visitor accounts and does not intentionally request sensitive personal information.</p></section>
    <section><h2>Advertising and third parties</h2><p>When advertising is enabled, advertising partners may use cookies or similar technologies for delivery, frequency control, fraud prevention and reporting. Third-party video players may receive browser and network information when their embed loads. Their own policies govern their processing.</p></section>
    <section><h2>Your choices</h2><p>You can block or clear cookies in your browser. Where required by law, advertising that needs consent must remain disabled until a compliant consent mechanism records your choice.</p></section>
    <section><h2>Retention and changes</h2><p>Operational logs should be retained only as long as needed for security, diagnostics and legal obligations. This policy may be updated when hosting, analytics or advertising services change.</p></section>
  </LegalPage>;
}
