import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata = { title: `About | ${SITE.name}`, description: `About the ${SITE.name} scene index.`, alternates: { canonical: "/about" } };

export default function AboutPage() {
  return <LegalPage title={`About ${SITE.name}`} intro={SITE.shortDescription}>
    <section><h2>What this site does</h2><p>{SITE.name} organizes scene metadata by performer, movie or television title, year and descriptive tags. The catalog is intended for adults who are 18 or older.</p></section>
    <section><h2>Third-party media</h2><p>Video playback may be provided through clearly identified third-party embeds. Unless expressly stated otherwise, this site does not claim ownership of third-party footage, trademarks, performer names or publicity rights.</p></section>
    <section><h2>Corrections and rights requests</h2><p>Catalog corrections, privacy questions and rights-holder notices can be submitted through the Contact or DMCA pages.</p></section>
  </LegalPage>;
}
