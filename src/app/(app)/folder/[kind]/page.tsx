import { notFound } from "next/navigation";
import { FolderView, type FolderKind } from "@/components/FolderView";

const KINDS: FolderKind[] = ["downloaded", "cached", "uploaded", "top", "local"];

export default async function Page({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.includes(kind as FolderKind)) notFound();
  return <FolderView kind={kind as FolderKind} />;
}
