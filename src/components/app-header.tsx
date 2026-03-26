"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function AppHeader() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:justify-between"
      >
        <Link
          className="text-sm font-medium text-gray-900 underline-offset-4 hover:underline"
          href="/"
        >
          Home
        </Link>
        {status === "authenticated" && session?.user ? (
          <Link
            className="text-sm font-medium text-gray-900 underline-offset-4 hover:underline"
            href="/profile"
          >
            Profile
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
