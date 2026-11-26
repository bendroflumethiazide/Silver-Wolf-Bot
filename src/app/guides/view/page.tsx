"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GuideContent } from "@/components/guides/GuideContent";
import { GuideImage } from "@/components/guides/GuideImage";
import { Loading } from "@/components/ui";
import { guide, GUIDES } from "@/lib/guides";

function View() {
  const slug = useSearchParams().get("g") ?? "";
  const g = guide(slug);
  const same = g ? GUIDES.filter((x) => x.section === g.section && x.slug !== g.slug && !x.href) : [];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/guides" className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"><ArrowLeft size={14} /> Guides</Link>
      {g && (
        <header className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-black/30"><GuideImage g={g} /></div>
          <div><div className="text-xs uppercase tracking-wider text-faint">{g.section}</div><h1 className="text-2xl font-semibold text-gradient">{g.title}</h1></div>
        </header>
      )}
      {g ? <GuideContent slug={slug} /> : (
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-gradient">Guide not found</h1>
          <p className="text-sm text-muted">That guide doesn&apos;t exist (maybe an old link). <Link href="/guides" className="text-cyan hover:underline">See all guides</Link>.</p>
        </div>
      )}
      {same.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm"><span className="text-faint">More {g!.section.toLowerCase()}:</span>{same.map((x) => <Link key={x.slug} href={`/guides/view?g=${x.slug}`} className="text-cyan hover:underline">{x.title}</Link>)}</div>
      )}
    </div>
  );
}

export default function GuidePage() {
  return <Suspense fallback={<Loading />}><View /></Suspense>;
}
