import { useEffect, useState } from 'react';
import { navigate } from '../../hooks/useRoute';
import { joinByCode, roomErrorMessage } from '../../services/supabase/rooms';

/** /join/<código>: se une a la sala y entra. Unirse dos veces no hace nada. */
export default function JoinRoom({ code }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    joinByCode(code)
      .then((id) => alive && navigate(`/room/${id}`, { replace: true }))
      .catch((e) => alive && setError(roomErrorMessage(e)));
    return () => {
      alive = false;
    };
  }, [code]);

  return (
    <main className="stage">
      {error ? (
        <section className="panel">
          <p className="msg fail" role="alert">{error}</p>
          <button className="btn" onClick={() => navigate('/', { replace: true })}>&gt; ir a mis salas</button>
        </section>
      ) : (
        <p className="pending">entrando en la sala...</p>
      )}
    </main>
  );
}
