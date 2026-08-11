import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "../i18n";

export interface ToastMessage {
  text: string;
  tone: "success" | "error";
}

export function Toast({
  message,
  onClose,
}: {
  message: ToastMessage;
  onClose: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const timer = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className="rv-toast" data-tone={message.tone} role="status">
      {message.tone === "error" ? (
        <AlertTriangle size={18} aria-hidden />
      ) : (
        <CheckCircle2 size={18} aria-hidden />
      )}
      <span>{message.text}</span>
      <button onClick={onClose} aria-label={t("common.close")}>
        <X size={16} />
      </button>
    </div>
  );
}
