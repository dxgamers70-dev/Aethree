"use client";

import { useState } from "react";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/Panel";

type Message = { role: "user" | "assistant"; content: string };

export function ChatBox({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setNotice(null);
    setBusy(true);

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (res.status === 503) {
        setNotice("chat coming online — API key not set");
        return;
      }
      if (!res.ok) {
        setNotice("something went wrong — try again");
        return;
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setNotice("network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="flex flex-col gap-3">
      <div className="text-xs uppercase font-mono text-muted">Chat</div>

      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-muted">gm — say something to this agent.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "self-end max-w-[85%] rounded-xl px-3 py-2 text-sm bg-acid/15 text-ink"
                : "self-start max-w-[85%] rounded-xl px-3 py-2 text-sm bg-panel border border-muted/15"
            }
          >
            <div className="text-[10px] uppercase font-mono text-muted mb-0.5">
              {m.role === "user" ? "you" : "agent"}
            </div>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
      </div>

      {notice && (
        <div className="rounded-xl border border-volt/40 bg-volt/10 px-3 py-2 text-xs font-mono text-volt">
          {notice}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="type a message…"
          className="flex-1 rounded-xl bg-void/40 border border-muted/20 px-3 py-2 text-sm outline-none focus:border-acid"
        />
        <Button onClick={send} disabled={busy}>
          {busy ? "…" : "Send"}
        </Button>
      </div>
    </Panel>
  );
}
