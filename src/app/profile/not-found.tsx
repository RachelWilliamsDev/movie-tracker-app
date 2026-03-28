import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Profile not found | MovieApp"
};

export default function ProfileNotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-3xl flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold text-gray-900">Profile not found</h1>
      <p className="text-sm text-gray-600">
        There is no member with this profile link. Check the URL or try finding them from{" "}
        <Link className="font-medium underline" href="/discover">
          Discover
        </Link>
        .
      </p>
      <Link className="text-sm font-medium text-gray-900 underline underline-offset-4" href="/">
        ← Back to home
      </Link>
    </main>
  );
}
