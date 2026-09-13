import { Suspense } from "react";
import { SearchView } from "@/components/SearchView";

export const metadata = { title: "Search — Beatly" };

export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}
