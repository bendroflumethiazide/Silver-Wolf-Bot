"use client";

import { useParams } from "next/navigation";
import { CharacterDetail } from "@/components/CharacterDetail";

/** Legacy URL (/characters/1003); the app now links to /characters/view?id=1003, which also works as a static site. */
export default function CharacterPage() {
  const { id } = useParams<{ id: string }>();
  return <CharacterDetail id={id} />;
}
