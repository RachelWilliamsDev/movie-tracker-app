"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { parseUsername } from "@/lib/username";

type ProfileUser = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  profileVisibility: "PUBLIC" | "PRIVATE";
};

type ProfileOk = { ok: true; user: ProfileUser };
type ProfileErr = { error: string; code?: string };

const USERNAME_CODES = new Set([
  "USERNAME_EMPTY",
  "USERNAME_TOO_SHORT",
  "USERNAME_TOO_LONG",
  "USERNAME_INVALID_CHARS",
  "USERNAME_TAKEN"
]);

export function ProfileSettingsForm() {
  const { update: updateSession } = useSession();
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">(
    "loading"
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [initialUsername, setInitialUsername] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    displayName?: string;
    profileVisibility?: string;
  }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const res = await fetch("/api/me/profile", { credentials: "include" });
      const data = (await res.json()) as ProfileOk | ProfileErr;

      if (!res.ok) {
        setLoadError(
          "error" in data && data.error
            ? data.error
            : "Could not load your profile."
        );
        setLoadState("error");
        return;
      }

      const u = (data as ProfileOk).user;
      setEmail(u.email);
      setInitialUsername(u.username);
      setUsername(u.username ?? "");
      setDisplayName(u.displayName ?? "");
      setVisibility(u.profileVisibility);
      setLoadState("ready");
    } catch {
      setLoadError("Network error. Check your connection and try again.");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const trimmedUsername = username.trim();
  const usernameParsed = useMemo(
    () => parseUsername(trimmedUsername),
    [trimmedUsername]
  );
  const usernameNonEmptyInvalid =
    trimmedUsername.length > 0 && !usernameParsed.ok;
  const usernameFormatMessage =
    usernameNonEmptyInvalid ? usernameParsed.error.message : null;
  const displayUsernameError =
    fieldErrors.username ?? usernameFormatMessage;
  const usernameBlocksSubmit = usernameNonEmptyInvalid;
  const usernameDescribedBy = [
    "sett-username-hint",
    displayUsernameError ? "sett-username-err" : null
  ]
    .filter(Boolean)
    .join(" ");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setSaveError(null);
    setSuccessMessage(null);
    setSaving(true);

    const body: Record<string, unknown> = {
      displayName: displayName.trim().length === 0 ? null : displayName.trim(),
      profileVisibility: visibility
    };

    if (trimmedUsername.length > 0) {
      if (!usernameParsed.ok) {
        setFieldErrors((prev) => ({
          ...prev,
          username: usernameParsed.error.message
        }));
        setSaving(false);
        return;
      }
      const initial = initialUsername ?? "";
      if (usernameParsed.username !== initial) {
        body.username = trimmedUsername;
      }
    } else if (initialUsername != null && initialUsername.length > 0) {
      body.username = null;
    }

    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });

      const data = (await res.json()) as ProfileOk | ProfileErr;

      if (!res.ok) {
        const code =
          "code" in data && typeof data.code === "string" ? data.code : "";
        const msg =
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Save failed.";

        if (USERNAME_CODES.has(code)) {
          setFieldErrors((prev) => ({ ...prev, username: msg }));
        } else if (
          code === "BAD_REQUEST" &&
          msg.toLowerCase().includes("display name")
        ) {
          setFieldErrors((prev) => ({ ...prev, displayName: msg }));
        } else if (
          code === "BAD_REQUEST" &&
          msg.toLowerCase().includes("profilevisibility")
        ) {
          setFieldErrors((prev) => ({ ...prev, profileVisibility: msg }));
        } else {
          setSaveError(msg);
        }
        setSaving(false);
        return;
      }

      const u = (data as ProfileOk).user;
      setInitialUsername(u.username);
      setUsername(u.username ?? "");
      setDisplayName(u.displayName ?? "");
      setVisibility(u.profileVisibility);
      await updateSession({ username: u.username });
      setSuccessMessage("Saved.");
      setSaving(false);
    } catch {
      setSaveError("Something went wrong. Try again.");
      setSaving(false);
    }
  }

  if (loadState === "loading") {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-600">Loading your settings…</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-800">
          {loadError ?? "Could not load settings."}
        </p>
        <Button
          className="mt-4"
          onClick={() => void loadProfile()}
          type="button"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-8 rounded-lg border border-gray-200 bg-white p-6"
      onSubmit={onSubmit}
    >
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Identity</h2>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-900" htmlFor="sett-username">
            Username
          </label>
          <input
            aria-describedby={usernameDescribedBy}
            aria-invalid={displayUsernameError ? true : undefined}
            autoComplete="username"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
            id="sett-username"
            onChange={(e) => {
              setUsername(e.target.value);
              setFieldErrors((prev) => {
                if (!prev.username) return prev;
                const next = { ...prev };
                delete next.username;
                return next;
              });
            }}
            placeholder="letters, numbers, underscores"
            type="text"
            value={username}
          />
          {displayUsernameError ? (
            <p className="text-sm text-red-600" id="sett-username-err" role="alert">
              {displayUsernameError}
            </p>
          ) : null}
          <p className="text-xs text-gray-500" id="sett-username-hint">
            Public URL:{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-gray-800">
              /user/
              {username.trim() || "yourname"}
            </code>
            . Changing username invalidates old links (404; no redirect in MVP). No per-month
            change limit in MVP.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-900" htmlFor="sett-display">
            Display name{" "}
            <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <input
            aria-invalid={fieldErrors.displayName ? true : undefined}
            aria-describedby={
              fieldErrors.displayName ? "sett-display-err" : undefined
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
            id="sett-display"
            onChange={(e) => setDisplayName(e.target.value)}
            type="text"
            value={displayName}
          />
          {fieldErrors.displayName ? (
            <p className="text-sm text-red-600" id="sett-display-err" role="alert">
              {fieldErrors.displayName}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-900" id="sett-email-label">
            Email
          </span>
          <p
            aria-labelledby="sett-email-label"
            className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800"
          >
            {email}
          </p>
          <p className="text-xs text-gray-500">
            Email is tied to your login and cannot be changed here (MVP).
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Privacy</h2>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-900" htmlFor="sett-vis">
            Profile visibility
          </label>
          <select
            aria-invalid={fieldErrors.profileVisibility ? true : undefined}
            aria-describedby={
              fieldErrors.profileVisibility ? "sett-vis-err" : undefined
            }
            className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
            id="sett-vis"
            onChange={(e) =>
              setVisibility(e.target.value as "PUBLIC" | "PRIVATE")
            }
            value={visibility}
          >
            <option value="PUBLIC">Public — anyone can find you in Discover</option>
            <option value="PRIVATE">Private — tighter visibility for social features</option>
          </select>
          {fieldErrors.profileVisibility ? (
            <p className="text-sm text-red-600" id="sett-vis-err" role="alert">
              {fieldErrors.profileVisibility}
            </p>
          ) : null}
        </div>
      </section>

      {saveError ? (
        <p className="text-sm text-red-600" role="alert">
          {saveError}
        </p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-green-700" role="status">
          {successMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button disabled={saving || usernameBlocksSubmit} type="submit">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
