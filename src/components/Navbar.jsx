import { useStore } from "../store";

const NAV = [
  { id: "algorithms", label: "Algorithms Practice" },
  { id: "scramble", label: "Scramble Generator" },
  { id: "notation", label: "Notation Reference" },
  { id: "settings", label: "Settings" },
];

export default function Navbar({ page, onNavigate }) {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  return (
    <header className="sticky top-0 z-30 border-b border-surface-700 bg-surface-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
        <button
          type="button"
          onClick={() => onNavigate("algorithms")}
          className="flex items-center gap-2.5 text-left"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-emerald-500 text-sm font-black text-white">
            3
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-zinc-100">SolveTheCube</span>
            <span className="block text-[11px] text-zinc-500">Speedcubing Trainer</span>
          </span>
        </button>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                page === item.id
                  ? "bg-surface-800 font-medium text-zinc-100"
                  : "text-zinc-400 hover:bg-surface-850 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-surface-700 text-zinc-400 transition hover:bg-surface-800 hover:text-zinc-100"
        >
          {theme === "dark" ? "☾" : "☀"}
        </button>

        <select
          value={page}
          onChange={(event) => onNavigate(event.target.value)}
          className="rounded-lg border border-surface-700 bg-surface-850 px-2 py-1.5 text-sm text-zinc-300 md:hidden"
        >
          {NAV.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
