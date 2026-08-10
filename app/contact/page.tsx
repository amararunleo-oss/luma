import { LegalPage } from "@/components/legal-page";
import { legalDetails } from "@/lib/legal";
import { SITE } from "@/lib/site";

export const metadata = { title: `Contact | ${SITE.name}`, description: `Contact ${SITE.name}.`, alternates: { canonical: "/contact" } };

export default function ContactPage() {
  const details = legalDetails();
  return <LegalPage title="Contact" intro="Send catalog corrections, privacy questions and business inquiries.">
    <section><h2>General contact</h2>{details.contactEmail ? <p>Email <a href={`mailto:${details.contactEmail}`}>{details.contactEmail}</a>. Include the relevant page URL and a concise explanation.</p> : <p>A public contact email must be configured before launch. Set <code>SITE_CONTACT_EMAIL</code> in the production environment.</p>}</section>
    <section><h2>Copyright notices</h2><p>Use the DMCA page for the required notice contents and designated delivery address.</p></section>
    <section><h2>Urgent safety reports</h2><p>For suspected underage, non-consensual or unlawfully disclosed material, put “Urgent safety report” in the subject and include the exact catalog URL.</p></section>
  </LegalPage>;
}
