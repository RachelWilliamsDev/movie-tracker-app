import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  // Logged out: show prompt only; do not attempt to render profile data.
  if (!user) {
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

  const displayName = user.name ?? user.email ?? "User";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-8">
      <Link className="text-sm text-gray-600 underline" href="/">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold">Your profile</h1>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Signed in as</p>
        <p className="mt-1 text-lg font-medium text-gray-900">{displayName}</p>
      </section>
    </main>
  );
}

