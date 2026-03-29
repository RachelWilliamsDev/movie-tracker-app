import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { ProfileView } from "@/app/profile/profile-view";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseUsername } from "@/lib/username";

/**
 * FEAT-132 (MEM-70): Public profile at `/user/[username]`.
 *
 * - Slug is validated with FEAT-128 rules (`parseUsername`). Invalid slugs → 404.
 * - Lookup uses the normalized (lowercase) value stored on `User.username`.
 * - **Users without a username** cannot be reached here (no row matches); treat as 404.
 *   With FEAT-129, active members should have a username before using social surfaces; legacy
 *   or incomplete accounts still resolve via `/profile/[userId]` (FEAT-134 links prefer `/user/…`).
 * - `ProfileView` reuses the same privacy / follow behavior as `/profile/[userId]`.
 */

type PageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { username: raw } = await props.params;
  const decoded = decodeURIComponent(raw).trim();
  const parsed = parseUsername(decoded);
  if (!parsed.ok) {
    return { title: "Profile | MovieApp" };
  }

  const user = await prisma.user.findUnique({
    where: { username: parsed.username },
    select: { name: true, email: true }
  });
  if (!user) {
    return { title: "Profile | MovieApp" };
  }

  const displayName = user.name?.trim() || user.email || "User";
  return {
    title: `${displayName} | MovieApp`,
    description: `${displayName} on MovieApp`
  };
}

export default async function ProfileByUsernamePage(props: PageProps) {
  const { username: raw } = await props.params;
  const decoded = decodeURIComponent(raw).trim();
  const parsed = parseUsername(decoded);
  if (!parsed.ok) {
    notFound();
  }

  const row = await prisma.user.findUnique({
    where: { username: parsed.username },
    select: { id: true }
  });
  if (!row) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;

  return <ProfileView targetUserId={row.id} viewerId={viewerId} />;
}
