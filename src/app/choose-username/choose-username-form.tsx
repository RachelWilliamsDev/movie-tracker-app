"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

type ProfileOk = {
  ok: true;
  user: { username: string | null };
};

type ProfileErr = {
  error: string;
  code?: string;
};

export function ChooseUsernameForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setError("Enter a username.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed })
      });

      const data = (await res.json()) as ProfileOk | ProfileErr;

      if (!res.ok) {
        const msg =
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Could not save username.";
        setError(msg);
        setLoading(false);
        return;
      }

      const okPayload = data as ProfileOk;
      if (!okPayload.ok || !okPayload.user?.username) {
        setError("Could not save username.");
        setLoading(false);
        return;
      }

      await update({ username: okPayload.user.username });
      router.push(nextPath.startsWith("/") ? nextPath : `/${nextPath}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-900" htmlFor="username">
          Username
        </label>
        <input
          autoComplete="username"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          id="username"
          name="username"
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. movie_fan_42"
          type="text"
          value={value}
        />
        <p className="text-xs text-gray-500">
          Letters, numbers, and underscores. This is how others find you.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <Button disabled={loading} type="submit">
        {loading ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
