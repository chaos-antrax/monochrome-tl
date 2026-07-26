import Link from "next/link";
import { getSafeUser } from "@/lib/repository";
import { canAccessTranslationPortal } from "@/lib/roles";
import { getSession } from "@/lib/session";
import Image from "next/image";

export default async function Home() {
  const session = await getSession();
  const user = session ? await getSafeUser(session.userId) : null;
  const canOpenPortal = Boolean(user && canAccessTranslationPortal(user.role));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="animate-page mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <nav className="sm:flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl font-semibold">
            <div className="flex space-x-2 items-center">
              <Image
                src="/favicon.ico"
                alt=""
                loading="eager"
                width={40}
                height={40}
              />
              Monochrome Translations
            </div>
          </Link>
          <div className="flex items-center gap-8">
            {user ? (
              <span className="max-w-55 rounded-lg px-4 py-2 text-sm font-semibold text-foreground/55">
                {user.email}
              </span>
            ) : (
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground/60 transition hover:bg-[var(--surface)] hover:text-foreground"
              >
                Log in
              </Link>
            )}
            {canOpenPortal ? (
              <Link
                href="/app/library"
                className="hidden border border-foreground bg-foreground px-5 py-2.5 font-inter text-xs font-light text-background transition hover:bg-foreground/90 sm:block"
              >
                Open app
              </Link>
            ) : null}
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-foreground/55">
              Chinese web novel translation
            </p>
            <h1 className="mt-4 max-w-3xl font-serif text-5xl font-semibold leading-tight sm:text-7xl">
              A quiet desk for long-form translation.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-foreground/60">
              Manage novels, chapters, glossary terms, style guides, provider
              keys, translation versions, and exports from a focused monochrome
              workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={canOpenPortal ? "/app/library" : "/login"}
                className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-5 py-2.5 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
              >
                {canOpenPortal ? "Continue translating" : "Portal login"}
              </Link>
              {canOpenPortal ? (
                <Link
                  href="/app/library"
                  className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
                >
                  View library
                </Link>
              ) : null}
            </div>
          </div>

          <div className="animate-scale-in rounded-lg border border-foreground/10 bg-[var(--surface)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
            <div className="border-b border-foreground/10 pb-4">
              <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">
                Workspace preview
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold">
                Translation flow
              </h2>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-foreground/60">
              <div className="rounded-lg bg-foreground/[0.06] p-4">
                <span className="font-semibold text-foreground">1.</span>{" "}
                Create a novel and paste source chapters.
              </div>
              <div className="rounded-lg bg-foreground/[0.06] p-4">
                <span className="font-semibold text-foreground">2.</span>{" "}
                Attach glossary terms and a style guide.
              </div>
              <div className="rounded-lg bg-foreground/[0.06] p-4">
                <span className="font-semibold text-foreground">3.</span>{" "}
                Translate, review versions, and export.
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs uppercase tracking-[0.14em] text-foreground/55">
              <span className="rounded-lg bg-foreground/[0.06] p-3">Glossary</span>
              <span className="rounded-lg bg-foreground/[0.06] p-3">Versions</span>
              <span className="rounded-lg bg-foreground/[0.06] p-3">Export</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
