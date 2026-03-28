/**
 * FEAT-120 — Product rules for user existence vs privacy
 *
 * - **Unknown user id** in `/profile/[userId]`: HTTP 404 / `notFound()`. No extra signal beyond
 *   “not found” (treat like any missing page).
 * - **Existing user, private profile**: Profile shell (display name, follower counts, follow CTA)
 *   is shown; ratings / progress / watch list are hidden. This **does** confirm the account exists;
 *   activity remains protected by `resolveUserActivityAccess`.
 * - **User search**: Only returns users matching the authenticated viewer’s query; no endpoint
 *   to probe arbitrary ids.
 */

export {};
