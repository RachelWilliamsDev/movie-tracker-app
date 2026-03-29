/**
 * Shared username rules for onboarding, settings, and APIs (FEAT-128).
 * Charset: ASCII letters, digits, underscore only (no hyphen).
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/** Stable codes for clients and `jsonApiError` once profile APIs wire this in. */
export type UsernameValidationCode =
  | "USERNAME_EMPTY"
  | "USERNAME_TOO_SHORT"
  | "USERNAME_TOO_LONG"
  | "USERNAME_INVALID_CHARS";

export type UsernameValidationError = {
  code: UsernameValidationCode;
  message: string;
};

export type ParseUsernameResult =
  | { ok: true; username: string }
  | { ok: false; error: UsernameValidationError };

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

const MESSAGES: Record<UsernameValidationCode, string> = {
  USERNAME_EMPTY: "Username is required.",
  USERNAME_TOO_SHORT: `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
  USERNAME_TOO_LONG: `Username must be at most ${USERNAME_MAX_LENGTH} characters.`,
  USERNAME_INVALID_CHARS:
    "Username can only contain letters, numbers, and underscores."
};

/**
 * Trims input; returns a canonical lowercase username on success.
 */
export function parseUsername(raw: unknown): ParseUsernameResult {
  if (raw === null || raw === undefined) {
    return {
      ok: false,
      error: { code: "USERNAME_EMPTY", message: MESSAGES.USERNAME_EMPTY }
    };
  }

  const trimmed = String(raw).trim();

  if (trimmed.length === 0) {
    return {
      ok: false,
      error: { code: "USERNAME_EMPTY", message: MESSAGES.USERNAME_EMPTY }
    };
  }

  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return {
      ok: false,
      error: {
        code: "USERNAME_TOO_SHORT",
        message: MESSAGES.USERNAME_TOO_SHORT
      }
    };
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      error: {
        code: "USERNAME_TOO_LONG",
        message: MESSAGES.USERNAME_TOO_LONG
      }
    };
  }

  if (!USERNAME_RE.test(trimmed)) {
    return {
      ok: false,
      error: {
        code: "USERNAME_INVALID_CHARS",
        message: MESSAGES.USERNAME_INVALID_CHARS
      }
    };
  }

  return { ok: true, username: trimmed.toLowerCase() };
}

/**
 * Convenience: boolean check without allocating error objects when valid.
 */
export function isValidUsername(raw: unknown): boolean {
  return parseUsername(raw).ok;
}
