import { useEffect, useState } from 'react';
import { giftErrorMessage, openGift } from '../../services/supabase/gifts';
import PasswordInput from '../ui/PasswordInput';
import { play } from '../../core/audio/sfx';

/**
 * Abre un regalo y muestra la carta.
 * - Destinatario de un regalo con contraseña: la pide primero (la comprueba el servidor).
 * - Sin contraseña, o si soy quien lo envió: se abre directamente.
 */
export default function LetterModal({ gift, me, nameOf, onOpened, onClose }) {
  const needsPassword = gift.is_locked && gift.receiver_id === me.id;
  const [message, setMessage] = useState(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(!needsPassword);
  const [error, setError] = useState(null);

  async function open(pw) {
    setBusy(true);
    setError(null);
    try {
      setMessage(await openGift(gift.id, pw));
      play('letter');
      if (gift.receiver_id === me.id && !gift.opened_at) onOpened?.();
    } catch (e) {
      setError(giftErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!needsPassword) open();
    // Solo al montar: abrir el regalo una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const from = nameOf(gift.sender_id), to = nameOf(gift.receiver_id);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Carta de ${from}`} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 className="panel-title">[ carta de {from} para {to} ]</h2>
          <button className="link" onClick={onClose} aria-label="Cerrar">cerrar</button>
        </div>

        {message !== null ? (
          <pre className="letter">{message}</pre>
        ) : needsPassword ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              open(password);
            }}
          >
            <p className="muted">Este regalo tiene contraseña. {from} debería habértela dado.</p>
            <label className="field">
              <span>contraseña</span>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required autoComplete="off" />
            </label>
            {error && <p className="msg fail" role="alert">{error}</p>}
            <button className="btn" type="submit" disabled={busy || !password}>{busy ? '...' : '> abrir'}</button>
          </form>
        ) : error ? (
          <p className="msg fail" role="alert">{error}</p>
        ) : (
          <p className="pending">abriendo...</p>
        )}
      </div>
    </div>
  );
}
