import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata = { title: `Terms of Use | ${SITE.name}`, description: `${SITE.name} visitor terms.`, alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return <LegalPage eyebrow="Policy" title="Terms of Use" intro="Rules for accessing and using this adult catalog.">
    <section><h2>Adults only</h2><p>You may use this site only if you are at least 18 years old and legally permitted to view adult material where you live.</p></section>
    <section><h2>Catalog and embeds</h2><p>The site provides descriptive metadata and links or embeds supplied by third parties. Availability, accuracy and playback are not guaranteed. A third party may change or remove its content without notice.</p></section>
    <section><h2>Acceptable use</h2><p>Do not bypass security controls, overload the service, scrape restricted information, introduce malicious code, impersonate another person or use the catalog to violate privacy, intellectual-property or other legal rights.</p></section>
    <section><h2>Ownership</h2><p>The site interface, original organization and original written material belong to their respective owner. Names, films, television programs, images, videos and marks supplied by third parties remain subject to the rights of their respective owners.</p></section>
    <section><h2>Disclaimer</h2><p>The service is provided as available without a promise that it will be uninterrupted or error-free. These terms do not exclude rights that cannot legally be excluded.</p></section>
  </LegalPage>;
}
