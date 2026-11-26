import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Diálogo de confirmación con el estilo de la app (sustituye a window.confirm).
 *
 *   const [confirm, dialog] = useConfirm();
 *   if (await confirm({ title, message, confirmLabel, danger: true })) { ... }
 *   return <>{...}{dialog}</>;
 *
 * Esc o clic fuera = cancelar. El foco va al botón de cancelar (lo seguro).
 */
export function useConfirm() {
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    (options) => new Promise((resolve) => setRequest({ ...options, resolve })),
    []
  );

  const close = (answer) => {
    request?.resolve(answer);
    setRequest(null);
  };

  const dialog = request ? <ConfirmDialog {...request} onAnswer={close} /> : null;
  return [confirm, dialog];
}

function ConfirmDialog({ title, message, detail, confirmLabel = 'confirmar', cancelLabel = 'cancelar', danger = false, onAnswer }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onAnswer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAnswer]);

  return (
    <div className="modal-backdrop" onClick={() => onAnswer(false)}>
      <div
        className={`modal confirm ${danger ? 'danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="panel-title">[ {title} ]</h2>
        <p id="confirm-message" className="confirm-message">{message}</p>
        {detail && <p className="muted">{detail}</p>}
        <div className="row confirm-actions">
          <button ref={cancelRef} className="btn ghost" onClick={() => onAnswer(false)}>{cancelLabel}</button>
          <button className={`btn ${danger ? 'danger' : ''}`} onClick={() => onAnswer(true)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
