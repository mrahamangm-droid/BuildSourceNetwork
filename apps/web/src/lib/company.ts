/** Single source of truth for brand and company details. Only facts supplied by the owner belong here. */
export const BRAND = {
  name: "BuildSource Network",
  short: "BSN",
  tagline: "Find, compare and order construction materials.",
} as const;

export const COMPANY = {
  legalName: "PAPPLE WORLD FZE LLC",
  location: "RAK, UAE",
  supportEmail: "support@BuildSourceNetwork.com",
} as const;

export const companyLine = `${COMPANY.legalName} · ${COMPANY.location}`;

/** Plain-text footer appended to every outgoing email. */
export const MAIL_FOOTER = `\n\n—\n${BRAND.name}\n${companyLine}\nSupport: ${COMPANY.supportEmail}`;
