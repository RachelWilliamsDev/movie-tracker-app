import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ProfileView } from "./profile-view";

type PageProps = {
  searchParams: Promise<{ userId?: string }>;
};

export default async function ProfilePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const sp = await searchParams;
  const requestedId = sp.userId?.trim() ?? "";

  if (requestedId.length > 0) {
    redirect(`/profile/${encodeURIComponent(requestedId)}`);
  }

  const user = session?.user;
  if (!user?.id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-8">
        <Link className="text-sm text-gray-600 underline" href="/">
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="text-sm text-gray-600">
          Sign in to view your profile.
        </p>
      </main>
    );
  }

  return <ProfileView targetUserId={user.id} viewerId={user.id} />;
}
