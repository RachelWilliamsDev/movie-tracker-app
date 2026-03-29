import { NextResponse } from "next/server";
import type { UsernameValidationCode } from "@/lib/username";

/**
 * Consistent JSON errors for profile/discovery APIs (FEAT-120).
 * Success bodies may use `{ ok: true, ... }`; errors use `{ error, code }`.
 */
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "SEARCH_FAILED"
  | "SUGGESTIONS_FAILED"
  | "FOLLOW_STATE_FAILED"
  | "FOLLOW_FAILED"
  | "UNFOLLOW_FAILED"
  | "FOLLOWERS_LIST_FAILED"
  | "FOLLOWING_LIST_FAILED"
  | UsernameValidationCode;

export type ApiErrorBody = {
  error: string;
  code: ApiErrorCode;
};

export function jsonApiError(
  status: number,
  error: string,
  code: ApiErrorCode
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error, code }, { status });
}
