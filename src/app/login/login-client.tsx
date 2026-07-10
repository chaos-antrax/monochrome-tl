"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceProvider, useAuth, useToast } from "../workspace/state";
import { Input, LoadingButton } from "../workspace/ui";

function LoginForm() {
  const router = useRouter();
  const { submitAuth } = useAuth();
  const { message, setMessage } = useToast();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateEmail(value: string) {
    setEmail(value);
    if (message) setMessage("");
  }

  function updatePassword(value: string) {
    setPassword(value);
    if (message) setMessage("");
  }

  function toggleMode() {
    setMode((current) => current === "login" ? "signup" : "login");
    if (message) setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const ok = await submitAuth(mode, email, password);
      if (ok) router.push("/app/library");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="animate-scale-in w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
      <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Account</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">{mode === "login" ? "Log in" : "Create account"}</h1>
      <div className="mt-6 space-y-4">
        <Input label="Email" value={email} onChange={updateEmail} />
        <Input label="Password" type="password" value={password} onChange={updatePassword} />
      </div>
      {message ? <p className="mt-4 rounded-lg bg-neutral-100 p-3 text-sm text-neutral-600">{message}</p> : null}
      <LoadingButton type="submit" loading={isSubmitting} loadingLabel={mode === "login" ? "Logging in ..." : "Creating account ..."} className="mt-6 w-full rounded-lg bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500">{mode === "login" ? "Log in" : "Sign up"}</LoadingButton>
      <button type="button" onClick={toggleMode} disabled={isSubmitting} className="mt-3 w-full rounded-lg px-4 py-3 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300">
        {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
      </button>
    </form>
  );
}

export function LoginClient() {
  return (
    <WorkspaceProvider>
      <main className="grid min-h-screen place-items-center bg-[#f7f7f5] px-6 py-10 text-neutral-950">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-6 block text-center font-serif text-2xl font-semibold">Monochrome</Link>
          <LoginForm />
        </div>
      </main>
    </WorkspaceProvider>
  );
}