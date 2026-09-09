import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  isEmail,
} from "class-validator";

/**
 * 3+ letter generic TLDs. Two-letter ccTLDs (`fr`, `io`, `me`, …) are always
 * allowed. Keep in sync with frontend/src/constants/userFields.ts.
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
  if (/^[a-z]{2}$/.test(value))
    return true;
  if (/^xn--[a-z0-9-]{2,59}$/.test(value))
    return true;
  return GENERIC_TLDS.has(value);
}

export function isValidEmail(value: unknown): boolean {
  if (typeof value !== "string")
    return false;
  const email = value.trim();
  if (email.length === 0 || email.length > EMAIL_MAX)
    return false;
  if (!isEmail(email, { allow_ip_domain: false, require_tld: true }))
    return false;
  const domain = email.slice(email.lastIndexOf("@") + 1);
  const dot = domain.lastIndexOf(".");
  if (dot < 0)
    return false;
  return isAllowedTld(domain.slice(dot + 1));
}

@ValidatorConstraint({ name: "isStrictEmail", async: false })
export class IsStrictEmailConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isValidEmail(value);
  }

  defaultMessage(): string {
    return "email must be a valid email address";
  }
}
