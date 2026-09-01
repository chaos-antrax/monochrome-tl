"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PROVIDER_DEFAULTS } from "@/lib/constants";
import { type Provider } from "@/lib/schemas/translation";
import { useAuth, labelDate } from "../../workspace/state";
import { Card, CustomSelect, Input, LoadingButton } from "../../workspace/ui";

export default function AccountPage() {
  const router = useRouter();
  const { account, setAccount, saveProvider, signOut } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<Provider>(account.provider);
  const [model, setModel] = useState(account.selectedModel);
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function submitProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiKey.trim() || isSavingProvider) return;
    setIsSavingProvider(true);
    try {
      await saveProvider(provider, apiKey, model);
      setApiKey("");
    } finally {
      setIsSavingProvider(false);
    }
  }

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      router.push("/login");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-foreground/10 bg-[var(--surface)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <p className="text-xs uppercase tracking-[0.22em] text-foreground/55">
          Settings
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold">Account</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-foreground/55">
          Manage your account settings and API configurations.
        </p>
      </header>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="font-serif text-2xl font-semibold">Session</h2>
          <div className="mt-4 space-y-3">
            <Input
              label="Email"
              value={account.email}
              onChange={(email) =>
                setAccount((current) => ({ ...current, email }))
              }
            />
            <p className="text-sm text-foreground/60">
              Session expires: {labelDate(account.sessionExpiresAt)}
            </p>
            <LoadingButton
              type="button"
              loading={isSigningOut}
              loadingLabel="Signing out ..."
              onClick={() => void handleSignOut()}
              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:bg-foreground/[0.06] disabled:text-foreground/35"
            >
              Sign out
            </LoadingButton>
          </div>
        </Card>
        <form
          onSubmit={submitProvider}
          className="rounded-lg border border-foreground/10 bg-[var(--surface)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)]"
        >
          <h2 className="font-serif text-2xl font-semibold">Provider</h2>
          <div className="mt-4 space-y-3">
            <CustomSelect
              label="Provider"
              value={provider}
              onChange={(value) => {
                const next = value as Provider;
                setProvider(next);
                setModel(PROVIDER_DEFAULTS[next].defaultModel);
              }}
              options={[
                { value: "deepseek", label: "DeepSeek" },
                { value: "openrouter", label: "OpenRouter" },
                { value: "zai", label: "Z.ai" },
              ]}
            />
            <Input label="Model" value={model} onChange={setModel} />
            <Input
              label="API key"
              value={apiKey}
              onChange={setApiKey}
              type="password"
              placeholder={account.apiKeyMasked ?? "Paste key"}
            />
            <p className="text-sm text-foreground/60">
              Saved key: {account.apiKeyMasked ?? "None"}
            </p>
          </div>
          <LoadingButton
            type="submit"
            loading={isSavingProvider}
            loadingLabel="Saving provider ..."
            disabled={!apiKey.trim()}
            className="mt-4 w-full inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-5 py-2.5 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:bg-foreground/10 disabled:text-foreground/40"
          >
            Save provider
          </LoadingButton>
        </form>
      </div>
    </div>
  );
}
