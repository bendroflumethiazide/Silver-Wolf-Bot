"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Check, Copy, ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import { WolfComment } from "@/components/SilverWolf";
import { Badge, Button, Empty, Notice, PageHeader, Panel } from "@/components/ui";
import { kvGet, kvSet, newId, nowIso } from "@/lib/db";
import { useApp } from "@/lib/store";
import { cleanCode, codesKey as key, redeemUrl, type RedeemCode } from "@/lib/codes";

export default function CodesPage() {
  const profileId = useApp((s) => s.profileId);
  const codes = useLiveQuery(() => kvGet<RedeemCode[]>(key(profileId), []), [profileId]);
  const [code, setCode] = useState("");
  const [reward, setReward] = useState("");
  const [expires, setExpires] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const save = (list: RedeemCode[]) => kvSet(key(profileId), list);
  const list = codes ?? [];
  const now = Date.now();
  const expired = (c: RedeemCode) => !!c.expires && Date.parse(c.expires) < now;
  const open = list.filter((c) => !c.redeemed && !expired(c));
  const add = async () => {
    const clean = cleanCode(code);
    if (clean.length < 6 || list.some((c) => c.code === clean)) return;
    await save([{ id: newId("code"), code: clean, reward: reward.trim() || undefined, expires: expires || undefined, redeemed: false, addedAt: nowIso() }, ...list]);
    setCode(""); setReward(""); setExpires("");
  };
  const copy = async (c: string) => { try { await navigator.clipboard.writeText(c); setCopied(c); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ } };

  return (
    <div className="space-y-5">
      <PageHeader title="Codes" subtitle="Keep track of redeem codes from official posts and livestreams." />
      <WolfComment comment={{ mood: open.length ? "alert" : "smug", line: open.length ? `${open.length} code${open.length === 1 ? "" : "s"} u haven't used|Free Jade is free Jade|Go` : "No unused codes|I'd tell u if there were", facts: [`${list.length} code(s) saved, ${open.length} not redeemed.`] }} />
      <Panel title="Add a code">
        <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" aria-label="Code" className="font-mono uppercase" />
          <input value={reward} onChange={(e) => setReward(e.target.value)} placeholder="Reward (optional)" aria-label="Reward" />
          <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} aria-label="Expires" />
          <Button variant="primary" type="submit" disabled={cleanCode(code).length < 6}>Add</Button>
        </form>
        <div className="mt-3"><Notice>Codes come from official HoYoverse posts and livestreams; this page only stores the ones you add. “Redeem” opens the official redemption page with the code filled in, where you confirm it while logged in.</Notice></div>
      </Panel>
      <Panel title="Your codes">
        {!list.length ? <Empty title="No codes yet">Add one above when you see it in an official post.</Empty> : (
          <ul className="divide-y divide-line">
            {list.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className={`font-mono text-sm ${c.redeemed || expired(c) ? "text-faint line-through" : "text-text"}`}>{c.code}</span>
                {c.reward && <span className="text-xs text-muted">{c.reward}</span>}
                {c.redeemed ? <Badge tone="ok">redeemed</Badge> : expired(c) ? <Badge tone="bad">expired</Badge> : c.expires ? <Badge tone="warn">until {c.expires}</Badge> : null}
                <span className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => copy(c.code)} aria-label={`Copy ${c.code}`}>{copied === c.code ? <Check size={14} /> : <Copy size={14} />}</Button>
                  {!c.redeemed && !expired(c) && <a className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cyan hover:bg-white/5" href={redeemUrl(c.code)} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Redeem</a>}
                  <Button size="sm" variant="ghost" onClick={() => save(list.map((x) => (x.id === c.id ? { ...x, redeemed: !x.redeemed } : x)))}>{c.redeemed ? "Undo" : "Mark redeemed"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => save(list.filter((x) => x.id !== c.id))} aria-label={`Delete ${c.code}`}><Trash2 size={14} /></Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
