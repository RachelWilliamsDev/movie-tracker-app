import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { SocialGraphList } from "@/components/social-graph-list";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<{ userId?: string }>;
};

export default async function FollowingPage(props: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/profile");
  }

  const sp = await props.searchParams;
  const requested = sp.userId?.trim();
  const targetUserId =
    requested && requested.length > 0 ? requested : session.user.id;

  const profileUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true }
  });
  if (!profileUser) {
    notFound();
  }

  const label = profileUser.name?.trim() || profileUser.email || "User";
  const backHref =
    targetUserId === session.user.id
      ? "/profile"
      : `/profile/${encodeURIComponent(targetUserId)}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-8">
      <Link className="text-sm text-gray-600 underline" href={backHref}>
        ← Back to profile
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Following</h1>
        <p className="mt-1 text-sm text-gray-600">Accounts {label} follows</p>
      </div>
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <SocialGraphList mode="following" targetUserId={targetUserId} />
      </section>
    </main>
  );
}
