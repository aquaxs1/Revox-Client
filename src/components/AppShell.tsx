import {
  BarChart3,
  Bookmark,
  ChevronDown,
  Compass,
  LogOut,
  Minus,
  Play,
  Settings,
  Square,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n/types";
import {
  closeWindow,
  minimizeWindow,
  toggleMaximizeWindow,
} from "../services/window";
import { isTauri } from "../services/backend";
import { useAppStore, useSelectedAccount } from "../state/AppStore";
import { AccountMenu } from "./AccountMenu";
import { Logo } from "./Logo";

export type PageId =
  | "play"
  | "profile"
  | "saved"
  | "stats"
  | "explore"
  | "friends"
  | "settings"
  | "exit";

const NAV_ITEMS: Array<{ id: PageId; icon: LucideIcon; label: TranslationKey }> = [
  { id: "play", icon: Play, label: "nav.play" },
  { id: "profile", icon: User, label: "nav.profile" },
  { id: "saved", icon: Bookmark, label: "nav.saved" },
  { id: "stats", icon: BarChart3, label: "nav.stats" },
  { id: "explore", icon: Compass, label: "nav.explore" },
  { id: "friends", icon: Users, label: "nav.friends" },
  { id: "settings", icon: Settings, label: "nav.settings" },
];

const PAGE_TITLES: Record<PageId, TranslationKey> = {
  play: "play.title",
  profile: "profile.title",
  saved: "saved.title",
  stats: "stats.title",
  explore: "explore.title",
  friends: "friends.title",
  settings: "settings.title",
  exit: "exit.title",
};

export function AppShell({
  activePage,
  onNavigate,
  children,
}: {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const { state, saveSettings } = useAppStore();
  const account = useSelectedAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountChip = useRef<HTMLButtonElement>(null);
  const expanded = state.settings.sidebarExpanded;

  return (
    <div className="rv-app">
      <aside className="rv-rail" data-expanded={expanded}>
        <button
          className="rv-rail-logo"
          onClick={() => void saveSettings({ sidebarExpanded: !expanded })}
          aria-label={expanded ? t("nav.collapse") : t("nav.expand")}
          aria-expanded={expanded}
          title={t("app.name")}
        >
          <Logo size={26} />
          {expanded && <span>REVOX</span>}
        </button>

        <nav className="rv-nav" aria-label={t("app.name")}>
          {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className="rv-nav-button"
              aria-current={activePage === id ? "page" : undefined}
              onClick={() => onNavigate(id)}
              title={t(label)}
            >
              <Icon size={19} strokeWidth={1.9} />
              {expanded && <span>{t(label)}</span>}
            </button>
          ))}

          <button
            className="rv-nav-button is-exit"
            aria-current={activePage === "exit" ? "page" : undefined}
            onClick={() => onNavigate("exit")}
            title={t("nav.exit")}
          >
            <LogOut size={19} strokeWidth={1.9} />
            {expanded && <span>{t("nav.exit")}</span>}
          </button>
        </nav>
      </aside>

      <div className="rv-main">
        <header className="rv-titlebar">
          <h1>{t(PAGE_TITLES[activePage])}</h1>
          {/* The empty stretch is the drag handle for the frameless window. */}
          <div className="rv-titlebar-spacer" data-tauri-drag-region />

          <button
            ref={accountChip}
            className="rv-account-chip"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t("profileMenu.open")}
          >
            <span>{account?.username ?? t("profileMenu.addAccount")}</span>
            <ChevronDown size={14} />
          </button>

          {isTauri() && (
            <div className="rv-window-buttons">
              <button
                className="rv-window-button"
                onClick={() => void minimizeWindow()}
                aria-label={t("window.minimize")}
              >
                <Minus size={15} />
              </button>
              <button
                className="rv-window-button"
                onClick={() => void toggleMaximizeWindow()}
                aria-label={t("window.maximize")}
              >
                <Square size={12} />
              </button>
              <button
                className="rv-window-button is-close"
                onClick={() => void closeWindow()}
                aria-label={t("window.close")}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {menuOpen && (
            <AccountMenu
              anchor={accountChip}
              onClose={() => setMenuOpen(false)}
              onManage={() => {
                setMenuOpen(false);
                onNavigate("profile");
              }}
            />
          )}
        </header>

        <main className="rv-content">{children}</main>
      </div>
    </div>
  );
}
