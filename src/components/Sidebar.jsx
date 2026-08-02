const CATEGORIES = [
  { id: "f2l", label: "F2L", blurb: "First two layers" },
  { id: "oll", label: "OLL", blurb: "Orient last layer" },
  { id: "pll", label: "PLL", blurb: "Permute last layer" },
];

/** Category + subsection menu, mirroring the source page's structure. */
export default function Sidebar({
  category,
  onCategoryChange,
  groups,
  activeGroup,
  onGroupChange,
  query,
  onQueryChange,
}) {
  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-64 lg:overflow-y-auto lg:border-r lg:border-surface-800">
      <div className="space-y-5 p-4">
        <div className="grid grid-cols-3 gap-1.5">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onCategoryChange(item.id)}
              title={item.blurb}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                category === item.id
                  ? "bg-accent text-white"
                  : "bg-surface-850 text-zinc-400 hover:bg-surface-800 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter cases or moves…"
          className="w-full rounded-lg border border-surface-700 bg-surface-850 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-accent focus:outline-none"
        />

        <nav className="space-y-0.5">
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
            Subsections
          </div>
          <button
            type="button"
            onClick={() => onGroupChange("all")}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              activeGroup === "all"
                ? "bg-surface-800 text-zinc-100"
                : "text-zinc-400 hover:bg-surface-850 hover:text-zinc-200"
            }`}
          >
            <span>All cases</span>
            <span className="font-mono text-xs text-zinc-600">
              {groups.reduce((n, g) => n + g.cases.length, 0)}
            </span>
          </button>
          {groups.map((group, index) => (
            <button
              key={group.id ?? index}
              type="button"
              onClick={() => onGroupChange(group.id ?? String(index))}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                activeGroup === (group.id ?? String(index))
                  ? "bg-surface-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-surface-850 hover:text-zinc-200"
              }`}
            >
              <span className="truncate">
                <span className="mr-1.5 text-zinc-600">{index + 1}.</span>
                {group.title}
              </span>
              <span className="font-mono text-xs text-zinc-600">{group.cases.length}</span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
