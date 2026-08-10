export function legalDetails() {
  const contactEmail = process.env.SITE_CONTACT_EMAIL?.trim();
  const dmcaEmail = process.env.SITE_DMCA_EMAIL?.trim() || contactEmail;
  return {
    legalName: process.env.SITE_LEGAL_NAME?.trim() || "Luma",
    contactEmail,
    dmcaEmail,
    dmcaAddress: process.env.SITE_DMCA_ADDRESS?.trim(),
    isConfigured: Boolean(contactEmail && dmcaEmail && process.env.SITE_LEGAL_NAME?.trim()),
  };
}
