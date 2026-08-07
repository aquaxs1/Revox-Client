import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Gauge,
  LayoutDashboard,
  Library,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { TopBar } from "./TopBar";

export type PageId =
  | "dashboard"
  | "library"
  | "accounts"
  | "performance"
  | "stats"
  | "settings";

interface NavItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "library", label: "Bibliothek", icon: Library },
  { id: "accounts", label: "Konten", icon: Users },
  { id: "performance", label: "Performance", icon: Gauge },
  { id: "stats", label: "Statistiken", icon: BarChart3 },
  { id: "settings", label: "Einstellungen", icon: Settings },
];

interface AppShellProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Hauptnavigation">
        <button
          className="brand-mark"
          aria-label="Dashboard"
          onClick={() => onNavigate("dashboard")}
          title="Rift Companion"
        >
          <span>R</span>
          <i />
        </button>

        <nav className="nav-stack">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={activePage === id ? "nav-button is-active" : "nav-button"}
              onClick={() => onNavigate(id)}
              aria-label={label}
              title={label}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-safety" title="Sicherer Begleiter">
          <ShieldCheck size={18} />
        </div>
      </aside>

      <div className="workspace">
        <TopBar activePage={activePage} />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
