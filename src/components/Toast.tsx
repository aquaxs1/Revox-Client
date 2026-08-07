import { CheckCircle2, X } from "lucide-react";

interface ToastProps {
  message: string;
  onClose: () => void;
}

export function Toast({ message, onClose }: ToastProps) {
  return (
    <div className="toast" role="status">
      <CheckCircle2 size={19} />
      <span>{message}</span>
      <button aria-label="Meldung schließen" onClick={onClose}>
        <X size={17} />
      </button>
    </div>
  );
}
