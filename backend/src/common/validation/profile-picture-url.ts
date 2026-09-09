import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

const LOCAL_AVATAR = /^\/uploads\/avatars\/[A-Za-z0-9._-]+$/;

/** Same shapes GET /users/:id already returns: http(s) or a hosted upload path. */
export function isAllowedProfilePictureUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return false;
  }
  if (value.startsWith("/")) {
    return LOCAL_AVATAR.test(value);
  }
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

@ValidatorConstraint({ name: "isAllowedProfilePictureUrl", async: false })
export class IsAllowedProfilePictureUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isAllowedProfilePictureUrl(value);
  }

  defaultMessage(): string {
    return "profilePictureUrl must be an http(s) URL or a /uploads/avatars/ path";
  }
}
