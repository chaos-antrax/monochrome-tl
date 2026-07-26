"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceProvider, useAuth, useToast } from "../workspace/state";
import { ThemeLogo } from "../theme/theme-logo";
import { Input, LoadingButton } from "../workspace/ui";

function LoginForm({ initialMessage = "" }: { initialMessage?: string }) {
  const router = useRouter();
  const { submitAuth } = useAuth();
  const { message, setMessage } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialMessage) setMessage(initialMessage);
  }, [initialMessage, setMessage]);

  function updateEmail(value: string) {
    setEmail(value);
    if (message) setMessage("");
  }

  function updatePassword(value: string) {
    setPassword(value);
    if (message) setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const ok = await submitAuth(email, password);
      if (ok) router.push("/app/library");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="animate-scale-in w-full max-w-md rounded-lg border border-foreground/10 bg-[var(--surface)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
      <p className="text-xs uppercase tracking-[0.22em] text-foreground/55">Translation portal</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">Log in</h1>
      <p className="mt-3 text-sm leading-6 text-foreground/55">Use an approved writer or admin account.</p>
      <div className="mt-6 space-y-4">
        <Input label="Email" value={email} onChange={updateEmail} />
        <Input label="Password" type="password" value={password} onChange={updatePassword} />
      </div>
      {message ? <p className="mt-4 rounded-lg border border-foreground/10 bg-foreground/[0.025] p-3 text-sm leading-6 text-foreground/60">{message}</p> : null}
      <LoadingButton type="submit" loading={isSubmitting} loadingLabel="Logging in ..." className="mt-6 w-full inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-5 py-2.5 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:bg-foreground/10 disabled:text-foreground/40">Log in</LoadingButton>
    </form>
  );
}

export function LoginClient({ initialMessage = "" }: { initialMessage?: string }) {
  return (
    <WorkspaceProvider>
      <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <Link href="/" aria-label="Back to home" className="transition hover:opacity-75">
            <ThemeLogo alt="Monochrome Translations" width={72} height={72} className="h-[72px] w-[72px] object-contain" />
            </Link>
          </div>
          <LoginForm initialMessage={initialMessage} />
        </div>
      </main>
    </WorkspaceProvider>
  );
}
