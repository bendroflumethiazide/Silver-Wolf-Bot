"use client";

import { GuideImage } from "@/components/guides/GuideImage";
import { CardGrid, ImageCard, PageHeader, SectionTitle } from "@/components/ui";
import { GUIDE_SECTIONS, GUIDES } from "@/lib/guides";

export default function GuidesPage() {
  return (
    <div className="space-y-7">
      <PageHeader title="Guides" subtitle="Short, visual, in Silver Wolf's app. Start at the top if you're new." />
      {GUIDE_SECTIONS.map((sec) => (
        <section key={sec}>
          <SectionTitle>{sec}</SectionTitle>
          <CardGrid>
            {GUIDES.filter((g) => g.section === sec).map((g) => (
              <ImageCard key={g.slug} href={g.href ?? `/guides/view?g=${g.slug}`} title={g.title} sub={g.blurb} image={<GuideImage g={g} />} />
            ))}
          </CardGrid>
        </section>
      ))}
    </div>
  );
}
