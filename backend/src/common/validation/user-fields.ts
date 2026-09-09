/**
 * Shared field rules for registration and profile update.
 * Names must stay compatible with OAuth providers (accents, hyphens, apostrophes,
 * multi-word family names) without accepting Discord discriminators like "#1234".
 */

export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const USERNAME_MESSAGE =
  "Username can only contain letters, numbers, underscores and hyphens";

/** Letters (any script) + combining marks, spaces, hyphens, apostrophes, periods. */
export const PERSON_NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;
export const FIRST_NAME_MESSAGE =
  "First name can only contain letters, spaces, hyphens, apostrophes and periods";
export const LAST_NAME_MESSAGE =
  "Last name can only contain letters, spaces, hyphens, apostrophes and periods";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PERSON_NAME_MIN = 1;
export const PERSON_NAME_MAX = 50;

export const PASSWORD_MIN = 8;
export const PASSWORD_COMPLEXITY_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
export const PASSWORD_COMPLEXITY_MESSAGE =
  "Password must contain at least one uppercase letter, one lowercase letter, and one number";
