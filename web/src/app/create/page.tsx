"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/Panel";
import AvatarViewer from "@/ui/AvatarViewer";
import { CATEGORIES, MODELS, getModel, DEFAULT_AVATAR } from "@/lib/avatars";

export default function Create() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [skillFile, setSkillFile] = useState("");
  const [provider, setProvider] = useState<"openai-compatible" | "anthropic">("openai-compatible");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR);
  const [cat, setCat] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MODELS.filter(
      (mo) => (cat === "all" || mo.category === cat) && (!q || mo.name.toLowerCase().includes(q)),
    );
  }, [cat, query]);

  const selected = getModel(avatarUrl);

  async function loadSkillFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setSkillFile(await file.text());
  }

  function buildLlm() {
    if (provider === "anthropic") {
      return apiKey.trim()
        ? { provider, apiKey: apiKey.trim(), model: model.trim() || "claude-opus-4-8" }
        : undefined;
    }
    return baseUrl.trim()
      ? { provider, baseUrl: baseUrl.trim(), apiKey: apiKey.trim() || undefined, model: model.trim() || "default" }
      : undefined;
  }

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, skillFile, avatarRef: avatarUrl, llm: buildLlm() }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "failed");
      setBusy(false);
      return;
    }
    const { agent } = await res.json();
    router.push(`/agent/${agent.id}`);
  }

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <Link href="/" className="text-xs font-mono text-muted">← back</Link>
      <h1 className="text-3xl font-black my-5">
        Deploy an <span className="text-acid">agent</span>
      </h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* live 3D preview */}
        <Panel className="p-0 overflow-hidden glow-acid lg:sticky lg:top-20 self-start">
          <AvatarViewer url={avatarUrl} className="h-[460px] w-full" />
          <div className="px-5 py-3 border-t border-muted/15 font-mono text-xs uppercase text-muted flex justify-between">
            <span>{selected?.name ?? "avatar"}</span>
            <span className="text-acid">{MODELS.length} unique models</span>
          </div>
        </Panel>

        {/* form */}
        <div className="space-y-5">
          <Panel className="space-y-5">
            <label className="block">
              <span className="text-xs uppercase font-mono text-muted">Name</span>
              <input
                className="mt-1 w-full bg-void border border-muted/30 rounded-xl px-3 py-2 focus:border-acid outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Degen Oracle"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-mono text-muted">Skill file — defines behavior</span>
                <label className="text-[11px] font-mono text-acid cursor-pointer hover:underline">
                  load .md
                  <input type="file" accept=".md,.markdown,.txt" className="hidden" onChange={loadSkillFile} />
                </label>
              </div>
              <textarea
                className="mt-1 w-full bg-void border border-muted/30 rounded-xl px-3 py-2 h-48 font-mono text-xs focus:border-acid outline-none"
                value={skillFile}
                onChange={(e) => setSkillFile(e.target.value)}
                placeholder={"---\nname: market-sage\ndescription: snarky on-chain analyst\nmodel: any\n---\n\nYou are Market Sage, a dry-witted on-chain analyst.\n- never give financial advice\n- cite on-chain data when you can"}
              />
              <p className="text-[11px] text-muted">
                Markdown with optional frontmatter. The instructions body becomes the agent&apos;s system
                prompt — and is anchored on-chain so holders govern it.
              </p>
            </div>
          </Panel>

          {/* bring your own model */}
          <Panel className="space-y-4">
            <span className="text-xs uppercase font-mono text-acid">Bring your own model</span>
            <div className="flex gap-1.5 flex-wrap">
              <Chip active={provider === "openai-compatible"} onClick={() => setProvider("openai-compatible")}>
                tunnel · openai-compatible
              </Chip>
              <Chip active={provider === "anthropic"} onClick={() => setProvider("anthropic")}>anthropic</Chip>
            </div>
            {provider === "openai-compatible" ? (
              <>
                <Field label="Endpoint URL (ngrok / cloudflare → your /v1)" value={baseUrl} onChange={setBaseUrl} placeholder="https://abc.ngrok.app/v1" />
                <Field label="Model" value={model} onChange={setModel} placeholder="llama-3.1-8b-instruct" />
                <Field label="API key (optional)" value={apiKey} onChange={setApiKey} placeholder="if your server requires one" type="password" />
              </>
            ) : (
              <>
                <Field label="Anthropic API key" value={apiKey} onChange={setApiKey} placeholder="sk-ant-…" type="password" />
                <Field label="Model" value={model} onChange={setModel} placeholder="claude-opus-4-8" />
              </>
            )}
            <p className="text-[11px] text-muted">
              Point the agent at any model you already run. Stored per-agent for its chat only — your key is
              never written on-chain.
            </p>
          </Panel>

          {/* model library */}
          <Panel className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs uppercase font-mono text-muted">Avatar model</span>
              <input
                className="bg-void border border-muted/30 rounded-lg px-2 py-1 text-xs font-mono w-32 focus:border-acid outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search…"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Chip active={cat === "all"} onClick={() => setCat("all")}>all</Chip>
              {CATEGORIES.map((c) => (
                <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>
              ))}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-80 overflow-y-auto pr-1">
              {filtered.map((mo) => (
                <button
                  key={mo.url}
                  type="button"
                  onClick={() => setAvatarUrl(mo.url)}
                  title={mo.name}
                  className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 transition ${
                    avatarUrl === mo.url ? "border-acid glow-acid bg-acid/5" : "border-muted/15 hover:border-muted/50"
                  }`}
                >
                  <span className="text-2xl">{mo.emoji}</span>
                  <span className="text-[10px] font-mono text-muted truncate w-full text-center px-1">{mo.name}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="col-span-full text-xs text-muted font-mono py-4 text-center">no matches</p>
              )}
            </div>
          </Panel>

          {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? "deploying…" : "Deploy agent"}
          </Button>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase font-mono text-muted">{label}</span>
      <input
        type={type}
        className="mt-1 w-full bg-void border border-muted/30 rounded-xl px-3 py-2 text-sm font-mono focus:border-acid outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-mono uppercase px-2.5 py-1 rounded-full border transition ${
        active ? "border-acid text-acid" : "border-muted/25 text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
