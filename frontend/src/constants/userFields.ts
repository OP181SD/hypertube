/** Keep in sync with backend/src/common/validation/user-fields.ts */

export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const PERSON_NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;
export const PASSWORD_COMPLEXITY_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

/** Shape only — also call `isValidEmail` (rejects fake TLDs like `.ccefeweagreergv`). */
export const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/**
 * 3+ letter generic TLDs. Two-letter ccTLDs (`fr`, `io`, `me`, …) are always
 * allowed. Keep in sync with backend/src/common/validation/email.ts.
 */
const GENERIC_TLDS = new Set(
  `aero app art asia bank biz blog cam cat cloud club com coop
   dev digital edu email fun gov icu info international jobs
   life live llc ltd media mil mobi museum name net network news ngo
   one online org page pro shop site space store studio
   tech tel today top travel website wiki work world xxx xyz`
    .trim()
    .split(/\s+/),
);

export const EMAIL_MAX = 254;

export function isAllowedTld(tld: string): boolean {
  const value = tld.toLowerCase();
  if (/^[a-z]{2}$/.test(value)) return true;
  if (/^xn--[a-z0-9-]{2,59}$/.test(value)) return true;
  return GENERIC_TLDS.has(value);
}

export function isValidEmail(email: string): boolean {
  const value = email.trim();
  if (value.length === 0 || value.length > EMAIL_MAX) return false;
  if (!EMAIL_PATTERN.test(value)) return false;
  const domain = value.slice(value.lastIndexOf("@") + 1);
  const dot = domain.lastIndexOf(".");
  if (dot < 0) return false;
  return isAllowedTld(domain.slice(dot + 1));
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PERSON_NAME_MIN = 1;
export const PERSON_NAME_MAX = 50;
export const PASSWORD_MIN = 8;

export function passwordPolicyErrorKey(
  password: string,
): "error_password_too_short" | "error_password_complexity" | null {
  if (password.length < PASSWORD_MIN) return "error_password_too_short";
  if (!PASSWORD_COMPLEXITY_PATTERN.test(password)) return "error_password_complexity";
  return null;
}
