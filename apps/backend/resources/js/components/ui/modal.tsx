import type { PropsWithChildren, ReactNode } from 'react';

type Props = PropsWithChildren<{
  open: boolean;
  title?: string;
  onClose: () => void;
  footer?: ReactNode;
}>;

export function Modal({ open, title, onClose, footer, children }: Props) {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{title ?? ''}</div>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
