import { LegalPage } from "@/components/legal-page";
import { legalDetails } from "@/lib/legal";
import { SITE } from "@/lib/site";

export const metadata = { title: `DMCA & Copyright | ${SITE.name}`, description: `Copyright notice process for ${SITE.name}.`, alternates: { canonical: "/dmca" } };

export default function DmcaPage() {
  const details = legalDetails();
  return <LegalPage eyebrow="Rights" title="DMCA & Copyright" intro="A documented process for copyright owners and authorized agents.">
    <section><h2>Submitting a notice</h2><p>A complete notice should identify the copyrighted work, identify the material and its exact page URL, include your contact information, state your good-faith belief that the use is unauthorized, state under penalty of perjury that the notice is accurate and that you are authorized to act, and include a physical or electronic signature.</p></section>
    <section><h2>Where to send it</h2>{details.dmcaEmail ? <p>Email: <a href={`mailto:${details.dmcaEmail}`}>{details.dmcaEmail}</a>{details.dmcaAddress ? <><br />Mailing address: {details.dmcaAddress}</> : null}</p> : <p>The operator must configure a public copyright-notice email and, where required, a designated-agent address before launch.</p>}</section>
    <section><h2>What happens next</h2><p>Valid notices will be reviewed promptly. The relevant catalog entry or embed may be disabled while the claim is investigated. Knowingly making a material misrepresentation in a notice or counter-notice may create legal liability.</p></section>
    <section><h2>Non-copyright concerns</h2><p>Privacy, identity, performer-consent, correction and other legal concerns should be sent through the Contact page with the exact URL and enough information to evaluate the request.</p></section>
  </LegalPage>;
}
