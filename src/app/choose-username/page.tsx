import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChooseUsernameForm } from "./choose-username-form";

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function ChooseUsernamePage(props: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }

  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true }
  });

  const sp = await props.searchParams;
  const nextRaw = sp.next?.trim() ?? "";
  const safeNext =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/discover";

  if (row?.username != null && row.username.length > 0) {
    redirect(safeNext);
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col gap-6 p-8">
      <div>
        <Link className="text-sm text-gray-600 underline" href="/">
          ← Home
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">
          Choose your username
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Pick a unique username to use Discover, Feed, and your profile with
          other people.
        </p>
      </div>
      <ChooseUsernameForm nextPath={safeNext} />
    </main>
  );
}
