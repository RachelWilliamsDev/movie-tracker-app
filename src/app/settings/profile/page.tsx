import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ProfileSettingsForm } from "./profile-settings-form";

export default async function SettingsProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-8">
      <div>
        <Link className="text-sm text-gray-600 underline" href="/profile">
          ← Profile
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">
          Profile settings
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Update how you appear and who can see your profile.
        </p>
      </div>
      <ProfileSettingsForm />
    </main>
  );
}
