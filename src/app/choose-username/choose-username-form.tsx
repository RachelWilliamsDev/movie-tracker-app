"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { parseUsername } from "@/lib/username";

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
  const [blurred, setBlurred] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const trimmed = value.trim();
  const parsed = useMemo(() => parseUsername(trimmed), [trimmed]);
  const clientOk = parsed.ok;
  const showValidation = blurred || trimmed.length > 0;
  const formatError =
    showValidation && !parsed.ok ? parsed.error.message : null;
  const displayError = serverError ?? formatError;
  const describedBy = [
    "choose-username-hint",
    displayError ? "choose-username-err" : null
  ]
    .filter(Boolean)
    .join(" ");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!clientOk) {
      setBlurred(true);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: trimmed })
      });

      const data = (await res.json()) as ProfileOk | ProfileErr;

      if (!res.ok) {
        const msg =
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Could not save username.";
        setServerError(msg);
        setLoading(false);
        return;
      }

      const okPayload = data as ProfileOk;
      if (!okPayload.ok || !okPayload.user?.username) {
        setServerError("Could not save username.");
        setLoading(false);
        return;
      }

      await update({ username: okPayload.user.username });
      router.push(nextPath.startsWith("/") ? nextPath : `/${nextPath}`);
      router.refresh();
    } catch {
      setServerError("Something went wrong. Try again.");
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
          aria-describedby={describedBy}
          aria-invalid={displayError ? true : undefined}
          aria-required
          autoComplete="username"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          id="username"
          name="username"
          onBlur={() => setBlurred(true)}
          onChange={(e) => {
            setValue(e.target.value);
            setServerError(null);
          }}
          placeholder="e.g. movie_fan_42"
          type="text"
          value={value}
        />
        <p className="text-xs text-gray-500" id="choose-username-hint">
          Letters, numbers, and underscores (3–30). This is how others find you.
        </p>
      </div>

      {displayError ? (
        <p className="text-sm text-red-600" id="choose-username-err" role="alert">
          {displayError}
        </p>
      ) : null}

      <Button disabled={loading || !clientOk} type="submit">
        {loading ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
