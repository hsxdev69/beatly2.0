"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useLibrary } from "@/store/library";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const bootstrap = useLibrary((s) => s.bootstrap);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "Something went wrong");
    await bootstrap();
    router.push("/");
    router.refresh();
  }

  const input =
    "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-brand";

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30">
            <Sparkles size={22} />
          </span>
          <span className="text-2xl font-extrabold">Beatly</span>
        </Link>
        <h1 className="mb-6 text-center text-3xl font-extrabold">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <label className="block text-sm font-semibold">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?" className={`mt-1.5 ${input}`} required />
            </label>
          )}
          <label className="block text-sm font-semibold">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@domain.com" className={`mt-1.5 ${input}`} required />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 6 characters" : "Password"}
              className={`mt-1.5 ${input}`}
              required
              minLength={6}
            />
          </label>
          {error && <p className="rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-brand py-3 font-bold text-white shadow-lg shadow-brand/30 transition hover:scale-[1.02] disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-semibold text-white underline">
                Sign up for Beatly
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-white underline">
                Log in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
