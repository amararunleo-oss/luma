import { LegalPage } from "@/components/legal-page";
import { legalDetails } from "@/lib/legal";
import { SITE } from "@/lib/site";

export const metadata = { title: `Rights & Content Ownership | ${SITE.name}`, description: `Content ownership and rights information for ${SITE.name}.`, alternates: { canonical: "/rights" } };

export default function RightsPage() {
  const details = legalDetails();
  return <LegalPage eyebrow="Rights" title="Rights & Content Ownership" intro="How original site material, third-party embeds and removal requests are handled.">
    <section><h2>Site material</h2><p>The interface, original written copy, software and original catalog organization are protected by applicable intellectual-property laws. They may not be reproduced as a competing service without permission.</p></section>
    <section><h2>Third-party media</h2><p>Names, trademarks, films, television programs, thumbnails and videos supplied or embedded by third parties remain subject to the rights and terms of their respective owners and publishers. Inclusion does not transfer ownership to {SITE.displayName}.</p></section>
    <section><h2>Embedded players</h2><p>External players are delivered from their publisher&apos;s systems. Playback, availability, advertising and player controls are governed by that publisher. We may remove an entry or disable an embed when a valid rights or safety concern is received.</p></section>
    <section><h2>Report a rights concern</h2><p>Send the exact page URL, the work or person concerned, your relationship to the rights holder and supporting information to {details.dmcaEmail ? <a href={`mailto:${details.dmcaEmail}`}>{details.dmcaEmail}</a> : "the address shown on the DMCA page"}. Copyright notices should follow the process on the <a href="/dmca">DMCA page</a>.</p></section>
  </LegalPage>;
}
