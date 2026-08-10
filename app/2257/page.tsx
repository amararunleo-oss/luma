import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata = { title: `18 U.S.C. 2257 Notice | ${SITE.name}`, description: `Recordkeeping notice for ${SITE.name}.`, alternates: { canonical: "/2257" } };

export default function RecordsPage() {
  return <LegalPage eyebrow="Compliance" title="18 U.S.C. 2257 Notice" intro="Recordkeeping information for material indexed by this service.">
    <section><h2>Indexed third-party material</h2><p>This site is designed as a catalog and embed index and does not itself produce the third-party motion-picture or television footage shown in external players. Production and performer records, where applicable, are maintained by the original producers or providers.</p></section>
    <section><h2>Launch requirement</h2><p>Before public operation, qualified counsel should review the actual content, hosting model and operator role and provide any required custodian-of-records name and address. This page is a technical placeholder and is not a substitute for that legal determination.</p></section>
    <section><h2>Reporting concerns</h2><p>If an indexed page appears to depict a person under 18, non-consensual material or incorrectly identified content, report the exact URL immediately through the Contact page so access can be disabled during review.</p></section>
  </LegalPage>;
}
