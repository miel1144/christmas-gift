import { useState } from 'react';
import { createGift, giftErrorMessage } from '../../services/supabase/gifts';
import { GIFT_COLORS, placeGift } from '../../utils/giftSpec';
import PasswordInput from '../ui/PasswordInput';

const MAX = 5000;

/** Enviar un regalo: destinatario, carta, color y contraseña opcional. */
export default function SendGiftForm({ room, gifts, members, me, onSent }) {
  const others = members.filter((m) => m.id !== me.id);
  const [receiverId, setReceiverId] = useState(others[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [color, setColor] = useState(GIFT_COLORS[0].hex);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sentTo, setSentTo] = useState(null);

  if (others.length === 0) {
    return <p className="muted">Por ahora eres la única persona en esta sala. Invita a alguien desde «miembros» para poder enviarle un regalo.</p>;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { x, y } = placeGift(gifts);
      const to = receiverId || others[0].id;
      await createGift({ roomId: room.id, receiverId: to, message: message.trim(), password, color, x, y });
      setMessage('');
      setPassword('');
      onSent(others.find((m) => m.id === to)?.name);
    } catch (err) {
      setError(giftErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <label className="field">
        <span>para</span>
        <select value={receiverId} onChange={(e) => setReceiverId(e.target.value)}>
          {others.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>carta <span className="muted">({message.length}/{MAX})</span></span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={MAX} rows={7} placeholder="Escribe tu carta…" />
      </label>

      <fieldset className="field">
        <legend>color de la caja</legend>
        <div className="swatches">
          {GIFT_COLORS.map((c) => (
            <label key={c.hex} className={`swatch-pick ${color === c.hex ? 'active' : ''}`} title={c.name}>
              <input type="radio" name="gift-color" value={c.hex} checked={color === c.hex} onChange={() => setColor(c.hex)} />
              <span className="swatch" style={{ background: c.hex }} />
              <span className="sr-only">{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>contraseña <span className="muted">(opcional)</span></span>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="sin contraseña" />
        <span className="muted small">Si pones una, tendrá que escribirla para leer la carta. Díselo por otro lado.</span>
      </label>

      {error && <p className="msg fail" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={busy || !message.trim()}>{busy ? '...' : '> dejar regalo bajo el árbol'}</button>
    </form>
  );
}
