import { useEffect, useRef, type ReactNode } from "react";
export function Modal({
  title,
  children,
  onCancel,
  mandatory = false,
}: {
  title: string;
  children: ReactNode;
  onCancel?: () => void;
  mandatory?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    d?.showModal();
    return () => {
      d?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={mandatory ? "crisis-dialog" : "confirm-dialog"}
      onCancel={(e) => {
        e.preventDefault();
        if (!mandatory) onCancel?.();
      }}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
export function ConfirmDialog({
  title,
  children,
  onConfirm,
  onCancel,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onCancel={onCancel}>
      {children}
      <div className="actions">
        <button
          autoFocus
          onClick={onCancel}
          className="secondary"
          disabled={busy}
        >
          Keep it
        </button>
        <button className="danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : "Confirm"}
        </button>
      </div>
    </Modal>
  );
}
