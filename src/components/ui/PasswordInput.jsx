import { useState } from 'react';

/**
 * Campo de contraseña con botón para mostrarla u ocultarla.
 * Acepta las mismas props que un <input>; `type` lo gestiona el componente.
 */
export default function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className={`password-input ${className}`}>
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? 'ocultar' : 'ver'}
      </button>
    </span>
  );
}
