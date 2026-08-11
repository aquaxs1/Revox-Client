import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "../i18n";

/**
 * A modal shell shared by every dialog in the app.
 *
 * Closes on Escape and on a backdrop click, moves focus inside on open, and
 * restores it to the trigger afterwards.
 */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    panel.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="rv-backdrop" onMouseDown={onClose}>
      <section
        className="rv-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="rv-dialog-close"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          <X size={17} />
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
