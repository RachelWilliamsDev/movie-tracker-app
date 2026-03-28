"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const navLinkClass =
  "rounded-sm text-sm font-medium text-gray-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2";

export function AppHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const onHome = pathname === "/";
  const onProfile = pathname === "/profile";
  const onFeed = pathname === "/feed";

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:justify-between"
      >
        <Link
          aria-current={onHome ? "page" : undefined}
          className={navLinkClass}
          href="/"
        >
          Home
        </Link>
        {status === "authenticated" && session?.user ? (
          <>
            <Link
              aria-current={onFeed ? "page" : undefined}
              className={navLinkClass}
              href="/feed"
            >
              Feed
            </Link>
            <Link
              aria-current={onProfile ? "page" : undefined}
              className={navLinkClass}
              href="/profile"
            >
              Profile
            </Link>
          </>
        ) : null}
      </nav>
    </header>
  );
}
