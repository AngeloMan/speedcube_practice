import { useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import CaseCard from "../components/CaseCard";
import PracticeModal from "../components/PracticeModal";
import f2l from "../data/f2l.json";
import oll from "../data/oll.json";
import pll from "../data/pll.json";

const DATA = { f2l, oll, pll };

export default function AlgorithmsPage() {
  const [category, setCategory] = useState("f2l");
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [openIndex, setOpenIndex] = useState(null);

  const groups = DATA[category];

  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups
      .map((entry, index) => ({ ...entry, key: entry.id ?? String(index) }))
      .filter((entry) => group === "all" || entry.key === group)
      .map((entry) => ({
        ...entry,
        cases: entry.cases.filter(
          (item) =>
            !needle ||
            item.title.toLowerCase().includes(needle) ||
            item.number.toLowerCase().includes(needle) ||
            item.alg.toLowerCase().includes(needle),
        ),
      }))
      .filter((entry) => entry.cases.length > 0);
  }, [groups, group, query]);

  // Flattened order drives ← / → navigation inside the modal.
  const flattened = useMemo(
    () => visibleGroups.flatMap((entry) => entry.cases),
    [visibleGroups],
  );

  const openCase = (caseData) =>
    setOpenIndex(flattened.findIndex((item) => item.id === caseData.id));

  const navigate = (delta) =>
    setOpenIndex((current) => {
      if (current === null) return current;
      return (current + delta + flattened.length) % flattened.length;
    });

  const changeCategory = (next) => {
    setCategory(next);
    setGroup("all");
  };

  let counter = 0;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
      <Sidebar
        category={category}
        onCategoryChange={changeCategory}
        groups={groups}
        activeGroup={group}
        onGroupChange={setGroup}
        query={query}
        onQueryChange={setQuery}
      />

      <main className="min-w-0 flex-1 p-4 pb-16">
        <div className="mb-6 flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-100">
            {category}
          </h1>
          <p className="text-sm text-zinc-500">
            {flattened.length} cases · click any card for the interactive 3D trainer
          </p>
        </div>

        {visibleGroups.map((entry) => (
          <section key={entry.key} className="mb-10 scroll-mt-16" id={entry.key}>
            <h2 className="mb-3 flex items-center gap-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              {entry.title}
              <span className="h-px flex-1 bg-surface-800" />
              <span className="font-mono text-xs text-zinc-600">{entry.cases.length}</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {entry.cases.map((item) => {
                counter += 1;
                return (
                  <CaseCard
                    key={item.id}
                    caseData={item}
                    index={counter}
                    onOpen={openCase}
                  />
                );
              })}
            </div>
          </section>
        ))}

        {flattened.length === 0 && (
          <p className="rounded-xl border border-dashed border-surface-700 p-10 text-center text-zinc-500">
            No cases match “{query}”.
          </p>
        )}
      </main>

      {openIndex !== null && flattened[openIndex] && (
        <PracticeModal
          caseData={flattened[openIndex]}
          category={category}
          onClose={() => setOpenIndex(null)}
          onNavigate={navigate}
        />
      )}
    </div>
  );
}
