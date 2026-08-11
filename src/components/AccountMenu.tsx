import { Check, Users } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { useAppStore } from "../state/AppStore";

/**
 * The dropdown behind the account chip in the title bar.
 *
 * Closes on outside click and on Escape so it never traps keyboard users.
 */
export function AccountMenu({
  anchor,
  onClose,
  onManage,
}: {
  /**
   * The button that opened the menu. Clicks on it are ignored here so its own
   * toggle handler can close the menu, instead of this closing it first and
   * the toggle immediately reopening it.
   */
  anchor: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onManage: () => void;
}) {
  const { t } = useI18n();
  const { state, selectAccount } = useAppStore();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (container.current?.contains(target) || anchor.current?.contains(target)) {
        return;
      }
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchor, onClose]);

  return (
    <div className="rv-account-menu" ref={container} role="menu">
      <h2>{t("profileMenu.title")}</h2>

      {state.accounts.length === 0 && (
        <p className="rv-account-option-body" style={{ padding: "4px 8px 8px" }}>
          <small>{t("profileMenu.noAccounts")}</small>
        </p>
      )}

      {state.accounts.map((account) => {
        const active = account.id === state.settings.selectedAccountId;
        return (
          <button
            key={account.id}
            className="rv-account-option"
            role="menuitemradio"
            aria-checked={active}
            onClick={() => {
              void selectAccount(account.id);
              onClose();
            }}
          >
            <span
              className="rv-avatar"
              style={{ ["--avatar-color" as string]: account.color }}
            >
              {account.initials}
            </span>
            <span className="rv-account-option-body">
              <strong>{account.username}</strong>
              <small>{account.label || t("profileMenu.title")}</small>
            </span>
            {active && <Check size={16} aria-hidden />}
          </button>
        );
      })}

      <div className="rv-menu-divider" />

      <button className="rv-account-option" role="menuitem" onClick={onManage}>
        <span className="rv-avatar is-small" style={{ background: "transparent" }}>
          <Users size={15} color="currentColor" />
        </span>
        <span className="rv-account-option-body">
          <strong>{t("profileMenu.manage")}</strong>
        </span>
      </button>
    </div>
  );
}
