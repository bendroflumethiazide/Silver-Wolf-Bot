"use client";

import { useEffect } from "react";
import { ChatComposer, ChatSettings, ChatThread } from "@/components/chat/ChatParts";
import { useWolfChat } from "@/components/chat/useWolfChat";
import { WolfAvatar } from "@/components/SilverWolf";
import { Loading, Notice } from "@/components/ui";
import { RELATIONSHIP_LABEL } from "@/lib/companion/casual";
import { SIGNATURE } from "@/lib/companion/voice";

/** Full-size version of the phone chat. Same history as the floating phone. */
export default function TerminalPage() {
  const chat = useWolfChat();
  useEffect(() => { if (chat.ready) void chat.open(); }, [chat.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!chat.ready) return <Loading label="Connecting to SW// terminal" />;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="glass hud flex h-[calc(100dvh-10rem)] min-h-[460px] flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-line bg-white/[0.03] px-4 py-3">
          <WolfAvatar size={40} />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">Silver Wolf</h1>
            <p className="truncate text-xs text-muted">{SIGNATURE} · {RELATIONSHIP_LABEL[chat.persona.relationship]}</p>
          </div>
          <ChatSettings chat={chat} />
        </header>
        <ChatThread chat={chat} />
        <ChatComposer chat={chat} chips="all" />
      </div>
      <div className="mt-3">
        {chat.useClaude
          ? <Notice>Claude mode: your message plus a compact facts block (roster, pity, resources, build grades; never your UID or name) goes to the Claude API from this app&apos;s local server.</Notice>
          : <Notice>Local mode: she answers from data on this device and does small talk offline. {chat.ai?.configured ? "Switch to Claude in the chat settings (gear) for free-form conversation." : "Add an Anthropic API key in Settings for free-form conversation."}</Notice>}
      </div>
    </div>
  );
}
