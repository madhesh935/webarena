import { forwardRef, useRef, type ButtonHTMLAttributes, type ReactNode, type RefObject } from "react";
import { Music2, House, ShoppingBag } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { SourceId } from "../lib/model";
import { SOURCE_META } from "../lib/model";
import type { ButtonVariant } from "../types/ui";

export function SourceChip({ source }: { source: SourceId }) {
  const meta = SOURCE_META[source];
  const Icon = source === "spotify" ? Music2 : source === "household" ? House : ShoppingBag;
  return (
    <span className={`chip chip-${source}`}>
      <Icon size={14} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

export function SourceIcon({ source }: { source: SourceId }) {
  const Icon = source === "spotify" ? Music2 : source === "household" ? House : ShoppingBag;
  return <Icon size={16} aria-hidden="true" />;
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(function Button({ children, variant = "secondary", ...props }, ref) {
  return (
    <button ref={ref} className={`btn btn-${variant}`} {...props}>
      {children}
    </button>
  );
});

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty" role="status">
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function ErrorBox({ title, children, onRetry }: { title: string; children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      <h3>{title}</h3>
      <p>{children}</p>
      {onRetry ? (
        <Button type="button" variant="primary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function LiveRegion({ message }: { message: string }) {
  return (
    <p className="sr-only" aria-live="polite">
      {message}
    </p>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function DialogSheet({
  open,
  title,
  onClose,
  children,
  desktop,
  closeRef,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  desktop: boolean;
  closeRef: RefObject<HTMLButtonElement | null>;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const headingId = "receipt-dialog-title";
  useFocusTrap(open, !desktop, sheetRef, onClose, closeRef);

  if (!open) return null;
  if (desktop) {
    return (
      <aside className="detail-panel" aria-labelledby={headingId}>
        <div ref={sheetRef}>
          <div className="sheet-head">
            <h2 id={headingId}>{title}</h2>
            <Button ref={closeRef} type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
          {children}
        </div>
      </aside>
    );
  }
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 id={headingId}>{title}</h2>
          <Button ref={closeRef} type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
