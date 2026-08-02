import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import AlgorithmsPage from "./pages/AlgorithmsPage";
import ScramblePage from "./pages/ScramblePage";
import NotationPage from "./pages/NotationPage";
import SettingsPage from "./pages/SettingsPage";
import { useStore } from "./store";

const PAGES = {
  algorithms: AlgorithmsPage,
  scramble: ScramblePage,
  notation: NotationPage,
  settings: SettingsPage,
};

const pageFromHash = () => {
  const id = window.location.hash.replace("#", "");
  return id in PAGES ? id : "algorithms";
};

export default function App() {
  const [page, setPage] = useState(pageFromHash);
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = (next) => {
    window.location.hash = next;
    setPage(next);
  };

  const Page = PAGES[page];

  return (
    <div className="min-h-screen bg-surface-950 text-zinc-200">
      <Navbar page={page} onNavigate={navigate} />
      <Page />
    </div>
  );
}
