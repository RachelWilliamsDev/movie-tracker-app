import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found | MovieApp"
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
      <p className="max-w-md text-sm text-gray-600">
        We couldn’t find what you were looking for. The link may be wrong or the page may have
        been removed.
      </p>
      <Link
        className="text-sm font-medium text-gray-900 underline underline-offset-4"
        href="/"
      >
        Back to home
      </Link>
    </main>
  );
}
