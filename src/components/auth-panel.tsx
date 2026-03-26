"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

export function AuthPanel() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "Sign up failed.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    if (result?.error) {
      setMessage("Account created, but login failed.");
    } else {
      setMessage("Signed up and logged in.");
    }
    setLoading(false);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    if (result?.error) {
      setMessage("Invalid email or password.");
    } else {
      setMessage("Logged in successfully.");
    }
    setLoading(false);
  };

  if (status === "loading") {
    return <p className="text-sm text-gray-600">Checking session...</p>;
  }

  if (session?.user) {
    return (
      <div className="w-full max-w-md rounded-lg border border-gray-200 p-6">
        <p className="text-sm text-gray-600">Logged in as</p>
        <p className="font-medium">{session.user.email}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="inline-flex rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            href="/profile"
          >
            Profile
          </Link>
          <button
            className="rounded bg-black px-4 py-2 text-sm text-white"
            onClick={() => signOut({ redirect: false })}
            type="button"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold">Authentication</h2>
      <form className="mt-4 space-y-3" onSubmit={handleSignup}>
        <input
          className="w-full rounded border border-gray-300 px-3 py-2"
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          value={name}
        />
        <input
          className="w-full rounded border border-gray-300 px-3 py-2"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          type="email"
          value={email}
        />
        <input
          className="w-full rounded border border-gray-300 px-3 py-2"
          minLength={8}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8)"
          required
          type="password"
          value={password}
        />
        <div className="flex gap-2">
          <button
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            Sign up
          </button>
          <button
            className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
            disabled={loading}
            onClick={handleLogin}
            type="button"
          >
            Log in
          </button>
        </div>
      </form>
      {message ? <p className="mt-3 text-sm text-gray-600">{message}</p> : null}
    </div>
  );
}
