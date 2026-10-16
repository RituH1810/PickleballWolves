"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CHAT_MESSAGE_MAX, QUICK_MESSAGES } from "@/lib/chat";

type Message = { id: string; body: string; createdAt: string; author: { id: string; name: string; photoUrl: string | null }; isMine: boolean; canDelete: boolean };

// Chat is for coordinating today, so check for new messages often while the page is open.
const REFRESH_MS = 15_000;

function timeLabel(iso: string) {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return date.toLocaleString(undefined, sameDay ? { hour: "numeric", minute: "2-digit" } : { weekday: "short", hour: "numeric", minute: "2-digit" });
}

/** "Running 10 min late" -- the game's message thread. Everyone in the game is notified of new messages. */
export function GameChat({ roundRobinId }: { roundRobinId: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/round-robin/${roundRobinId}/messages`).then((response) => response.ok ? response.json() : null).then((data) => { if (!cancelled && data?.messages) setMessages(data.messages); });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", load); };
  }, [roundRobinId]);

  // Keep the newest message in view.
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages?.length]);

  async function send(body: string) {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    const response = await fetch(`/api/round-robin/${roundRobinId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
    const data = await response.json().catch(() => null);
    setSending(false);
    if (!response.ok) { setError(data?.error ?? "Couldn't send."); return; }
    setMessages((current) => [...(current ?? []), data.message]);
    setDraft("");
  }

  async function remove(message: Message) {
    if (!window.confirm("Delete this message?")) return;
    const response = await fetch(`/api/round-robin/${roundRobinId}/messages/${message.id}`, { method: "DELETE" });
    if (response.ok) setMessages((current) => current?.filter((entry) => entry.id !== message.id) ?? null);
  }

  if (!messages) return null;
  return (
    <section id="chat" className="mt-6 scroll-mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
      <div className="flex items-center gap-2"><MessageCircle size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Game chat</h2></div>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">Running late, courts wet, can&apos;t make it? Everyone in the game gets a notification.</p>

      <div ref={listRef} className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && <p className="text-sm text-[var(--ink-soft)]">No messages yet.</p>}
        {messages.map((message) => (
          <div key={message.id} className={`group flex items-end gap-2 ${message.isMine ? "flex-row-reverse" : ""}`}>
            {!message.isMine && <Avatar name={message.author.name} photoUrl={message.author.photoUrl} className="h-7 w-7 shrink-0 rounded-full bg-[#22331f] text-[9px] font-black text-[var(--lime)]" />}
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${message.isMine ? "rounded-br-md bg-[var(--lime)] text-[#0f1712]" : "rounded-bl-md bg-[#131f19]"}`}>
              {!message.isMine && <p className="text-[11px] font-bold text-[var(--lime-deep)]">{message.author.name}</p>}
              <p className="whitespace-pre-line break-words text-sm leading-5">{message.body}</p>
              <p className={`mt-0.5 text-[10px] ${message.isMine ? "text-[#3c4a1e]" : "text-[var(--ink-soft)]"}`}>{timeLabel(message.createdAt)}</p>
            </div>
            {message.canDelete && <button onClick={() => remove(message)} aria-label="Delete message" className="mb-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--ink-soft)] opacity-0 transition-opacity hover:text-[var(--coral)] focus:opacity-100 group-hover:opacity-100"><Trash2 size={12} /></button>}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {QUICK_MESSAGES.map((quick) => <button key={quick} onClick={() => send(quick)} disabled={sending} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[11px] font-bold text-[var(--foreground)] hover:bg-[#1c2a1a] disabled:opacity-50">{quick}</button>)}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); send(draft); }} className="mt-3 flex gap-2">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={CHAT_MESSAGE_MAX} placeholder="Message everyone in this game" aria-label="Message" className="h-11 min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[#0f1712] px-4 text-sm outline-none focus:border-[var(--lime-deep)]" />
        <button type="submit" disabled={sending || !draft.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--lime)] text-[#0f1712] hover:bg-[#c3e043] disabled:opacity-50"><Send size={16} /></button>
      </form>
      {error && <p role="alert" className="mt-2 text-xs font-bold text-[var(--coral)]">{error}</p>}
    </section>
  );
}
