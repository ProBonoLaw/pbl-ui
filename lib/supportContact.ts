// Public contact details are embedded in the static UI at build time.
export const supportEmail = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '').trim();

export const soc2ReportRequestHref = supportEmail
  ? `mailto:${supportEmail}?subject=SOC%202%20Type%202%20report%20request`
  : null;
