import { useEffect, useState } from 'react';
import { checkSupabase, TABLES } from './services/supabase/test-connection';

// Pantalla provisional: confirma que React, Vite y Supabase están enlazados.
// La sustituye la escena ASCII (src/core/engine) cuando exista.
export default function App() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    checkSupabase().then(setStatus);
  }, []);

  const line = (ok, text) => (
    <li className={ok === null ? 'pending' : ok ? 'ok' : 'fail'}>
      [{ok === null ? '..' : ok ? 'OK' : '!!'}] {text}
    </li>
  );

  return (
    <main className="stage">
      <pre className="tree" aria-hidden="true">
{`        *
       ###
      #####
     #######
    #########
       |||`}
      </pre>
      <ul className="status">
        {line(true, 'React + Vite')}
        {line(status && status.connected, 'Supabase Auth')}
        {TABLES.map((t) =>
          line(status && (status.connected ? !status.missing.includes(t) : false), `tabla ${t}`)
        )}
      </ul>
      {status?.errors.length > 0 && (
        <pre className="errors">{status.errors.join('\n')}</pre>
      )}
    </main>
  );
}
