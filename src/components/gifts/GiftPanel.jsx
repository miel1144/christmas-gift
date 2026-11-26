import { useState } from 'react';
import { deleteGift, giftErrorMessage } from '../../services/supabase/gifts';
import SendGiftForm from './SendGiftForm';
import { useConfirm } from '../ui/useConfirm';

/** Panel lateral de regalos: recibidos, enviados y formulario para enviar. */
export default function GiftPanel({ room, gifts, members, me, nameOf, onRead, onChanged, onClose }) {
  const received = gifts.filter((g) => g.receiver_id === me.id);
  const sent = gifts.filter((g) => g.sender_id === me.id);
  const [tab, setTab] = useState(received.some((g) => !g.opened_at) ? 'received' : 'send');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirm, dialog] = useConfirm();

  const remove = async (g) => {
    const ok = await confirm({
      title: 'borrar regalo',
      message: `¿Borrar el regalo para ${nameOf(g.receiver_id)}?`,
      detail: g.opened_at ? 'Ya lo abrió, pero la carta desaparecerá también para esa persona.' : 'Todavía no lo ha abierto. La carta se perderá para siempre.',
      confirmLabel: 'borrar',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteGift(g.id);
      setNotice(`Regalo para ${nameOf(g.receiver_id)} borrado.`);
      onChanged();
    } catch (e) {
      setError(giftErrorMessage(e));
    }
  };

  return (
    <aside className="drawer" aria-label="Regalos">
      <div className="drawer-head">
        <h2 className="panel-title">[ regalos ]</h2>
        <button className="link" onClick={onClose} aria-label="Cerrar">cerrar</button>
      </div>

      <div className="tabs" role="tablist">
        {[
          ['received', `para ti (${received.length})`],
          ['sent', `enviados (${sent.length})`],
          ['send', 'enviar'],
        ].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => { setTab(id); setNotice(null); }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'received' &&
        (received.length === 0 ? (
          <p className="muted">Todavía no tienes regalos en esta sala.</p>
        ) : (
          <ul className="list">
            {received.map((g) => (
              <li key={g.id} className="list-row">
                <span>
                  <span className="swatch" style={{ background: g.color }} aria-hidden="true" />
                  de {nameOf(g.sender_id)}
                  {g.is_locked && <span className="tag">con clave</span>}
                  {!g.opened_at && <span className="tag new">nuevo</span>}
                </span>
                <button className="link" onClick={() => onRead(g)}>{g.opened_at ? 'leer' : 'abrir'}</button>
              </li>
            ))}
          </ul>
        ))}

      {tab === 'sent' &&
        (sent.length === 0 ? (
          <p className="muted">No has enviado regalos en esta sala.</p>
        ) : (
          <ul className="list">
            {sent.map((g) => (
              <li key={g.id} className="list-row">
                <span>
                  <span className="swatch" style={{ background: g.color }} aria-hidden="true" />
                  para {nameOf(g.receiver_id)}
                  <span className="tag">{g.opened_at ? 'abierto' : 'sin abrir'}</span>
                </span>
                <span className="row">
                  <button className="link" onClick={() => onRead(g)}>ver carta</button>
                  <button className="link" onClick={() => remove(g)}>borrar</button>
                </span>
              </li>
            ))}
          </ul>
        ))}

      {tab === 'send' && (
        <SendGiftForm
          room={room}
          gifts={gifts}
          members={members}
          me={me}
          onSent={(name) => {
            onChanged();
            setNotice(`Tu regalo para ${name ?? 'esa persona'} ya está bajo el árbol.`);
            setTab('sent');
          }}
        />
      )}

      {notice && <p className="msg ok" role="status">{notice}</p>}
      {error && <p className="msg fail" role="alert">{error}</p>}
      {dialog}
    </aside>
  );
}
