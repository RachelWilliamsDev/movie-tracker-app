import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileView } from "../profile-view";

/** Public profile (FEAT-119); social header via shared `ProfileView` (FEAT-126). */

type PageProps = {
  params: Promise<{ userId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { userId: raw } = await params;
  const id = raw.trim();
  if (!id) {
    return { title: "Profile | MovieApp" };
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true, email: true }
  });
  if (!user) {
    notFound();
  }

  const displayName = user.name?.trim() || user.email || "User";
  return {
    title: `${displayName} | MovieApp`,
    description: `${displayName} on MovieApp`
  };
}

export default async function ProfileByUserIdPage({ params }: PageProps) {
  const { userId: raw } = await params;
  const targetUserId = raw.trim();
  if (!targetUserId) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;

  return <ProfileView targetUserId={targetUserId} viewerId={viewerId} />;
}
