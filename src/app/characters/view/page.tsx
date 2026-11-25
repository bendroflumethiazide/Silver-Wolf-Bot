"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CharacterDetail } from "@/components/CharacterDetail";
import { Loading } from "@/components/ui";

function View() {
  const id = useSearchParams().get("id") ?? "";
  return <CharacterDetail id={id} />;
}

export default function CharacterViewPage() {
  return <Suspense fallback={<Loading label="Loading character" />}><View /></Suspense>;
}
