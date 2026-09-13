"use client";

import { Trash2 } from "lucide-react";
import { fromSnapshot } from "@/lib/types";
import { useLocal } from "@/store/local";
import { useLibrary } from "@/store/library";
import { TrackList } from "@/components/TrackList";
import { PageHeader, PlayAllButton } from "@/components/Cards";

export function HistoryView() {
  const { history, clearHistory } = useLocal();
  const notify = useLibrary((s) => s.notify);
  const groups = new Map<string, typeof history>();
  for (const h of history) {
    const d = new Date(h.at);
    const today = new Date();
    const key = d.toDateString() === today.toDateString() ? "Today" : d.getTime() > today.getTime() - 86400000 * 2 ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }
  const all = history.map((h) => fromSnapshot(h.track));
  return (
    <div className="pb-6">
      <PageHeader
        title="History"
        subtitle={`${history.length} plays`}
        right={history.length > 0 ? <button onClick={() => { clearHistory(); notify("History cleared"); }} className="rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="Clear history"><Trash2 size={20} /></button> : undefined}
      />
      {history.length === 0 && (
        <div className="mx-4 rounded-3xl bg-white/5 p-6 text-center md:mx-6">
          <p className="text-3xl">🕘</p>
          <p className="mt-2 font-bold">No listening history</p>
          <p className="text-sm text-muted">Songs you play will show up here.</p>
        </div>
      )}
      {history.length > 0 && <div className="px-4 pb-4 md:px-6"><PlayAllButton tracks={all} /></div>}
      {[...groups.entries()].map(([label, items]) => (
        <section key={label} className="mb-4">
          <p className="px-4 pb-1 text-xs font-bold uppercase tracking-wider text-muted md:px-6">{label}</p>
          <div className="px-2 md:px-4"><TrackList tracks={items.map((h) => fromSnapshot(h.track))} numbered={false} /></div>
        </section>
      ))}
    </div>
  );
}
