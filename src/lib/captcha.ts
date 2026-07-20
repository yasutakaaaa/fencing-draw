export const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
export const isCaptchaConfigured = Boolean(turnstileSiteKey);
