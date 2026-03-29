/**
 * FEAT-129 (MEM-68): Server-enforced routes — signed-in users without a username
 * are redirected to `/choose-username` (see `src/middleware.ts`).
 *
 * Prefixes match exact path or nested segments (e.g. `/profile/xyz`, `/feed`).
 */
export const USERNAME_GATE_PREFIXES = ["/discover", "/feed", "/profile"] as const;

export function pathnameRequiresUsername(pathname: string): boolean {
  return USERNAME_GATE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
