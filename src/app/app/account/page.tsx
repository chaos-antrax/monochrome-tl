"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PROVIDER_DEFAULTS } from "@/lib/constants";
import { type Provider } from "@/lib/schemas/translation";
import { useWorkspace, labelDate } from "../../workspace/state";
import { Card, Input } from "../../workspace/ui";

export default function AccountPage() {
  const router = useRouter();
  const { account, setAccount, saveProvider, signOut } = useWorkspace();
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<Provider>(account.provider);
  const [model, setModel] = useState(account.selectedModel);

  function submitProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiKey.trim()) return;
    void saveProvider(provider, apiKey, model);
    setApiKey("");
  }

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-neutral-200 bg-white/90 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]"><p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Settings</p><h1 className="mt-2 font-serif text-4xl font-semibold">Account</h1></header>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card><h2 className="font-serif text-2xl font-semibold">Session</h2><div className="mt-4 space-y-3"><Input label="Email" value={account.email} onChange={(email) => setAccount((current) => ({ ...current, email }))} /><p className="text-sm text-neutral-600">Session expires: {labelDate(account.sessionExpiresAt)}</p><button type="button" onClick={() => void signOut().then(() => router.push("/login"))} className="rounded-lg border border-neutral-200 px-4 py-3 text-sm font-semibold hover:border-neutral-950">Sign out</button></div></Card>
        <form onSubmit={submitProvider} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)]"><h2 className="font-serif text-2xl font-semibold">Provider</h2><div className="mt-4 space-y-3"><label className="block text-sm font-medium text-neutral-700">Provider<select value={provider} onChange={(event) => { const next = event.target.value as Provider; setProvider(next); setModel(PROVIDER_DEFAULTS[next].defaultModel); }} className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 outline-none focus:border-neutral-950"><option value="deepseek">DeepSeek</option><option value="openrouter">OpenRouter</option></select></label><Input label="Model" value={model} onChange={setModel} /><Input label="API key" value={apiKey} onChange={setApiKey} type="password" placeholder={account.apiKeyMasked ?? "Paste key"} /><p className="text-sm text-neutral-600">Saved key: {account.apiKeyMasked ?? "None"}</p></div><button type="submit" className="mt-4 w-full rounded-lg bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800">Save provider</button></form>
      </div>
    </div>
  );
}