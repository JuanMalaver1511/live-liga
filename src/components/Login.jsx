import { useState } from 'react'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [link, setLink] = useState('')
  const [tab, setTab] = useState('organizador')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submitLogin = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setBusy(true)
    setError(null)
    const ok = await onLogin(email.trim(), password)
    setBusy(false)
    if (!ok) setError('Email o contraseña incorrectos. Probá de nuevo.')
  }

  const submitLink = (e) => {
    e.preventDefault()
    if (!link.trim()) return
    try {
      const url = new URL(link.trim())
      if (url.pathname.includes('?id=') || url.searchParams.has('id')) {
        window.location.href = url.href
        return
      }
      setError('Ese enlace no parece un enlace de Liga Live.')
    } catch {
      setError('Pegá el enlace completo de compartir.')
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <span className="brand-logo" aria-hidden="true" />
        <div>
          <h1>Liga Live</h1>
          <p>Transmisiones y marcador para tu campeonato</p>
        </div>
      </div>

      <div className="login-card">
        <div className="login-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'organizador'}
            className={`login-tab ${tab === 'organizador' ? 'active' : ''}`}
            onClick={() => { setTab('organizador'); setError(null) }}
          >
            🎙️ Organizador
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'espectador'}
            className={`login-tab ${tab === 'espectador' ? 'active' : ''}`}
            onClick={() => { setTab('espectador'); setError(null) }}
          >
            👀 Espectador
          </button>
        </div>

        {tab === 'organizador' ? (
          <form className="login-form" onSubmit={submitLogin}>
            <h2>Bienvenido, organizador</h2>
            <p className="login-desc">
              Iniciá sesión para crear partidos, manejar el marcador, transmitir con cámara y guardar resultados.
            </p>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                placeholder="organizador@live.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null) }}
                disabled={busy}
              />
            </label>
            {error && <p className="cam-error login-error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy || !email.trim() || !password}>
              {busy ? 'Verificando…' : 'Ingresar'}
            </button>
            <p className="login-note">
              Si querés cambiar las credenciales, usá <code>ADMIN_EMAIL</code> y <code>ADMIN_PASSWORD</code> en Railway.
            </p>
          </form>
        ) : (
          <form className="login-form" onSubmit={submitLink}>
            <h2>Ver un partido en vivo</h2>
            <p className="login-desc">
              Pegá el enlace de compartir que te mandó el organizador y entrás directo al marcador con el resultado guardado.
            </p>
            <label className="field">
              <span>Enlace del partido</span>
              <div className="input-icon">
                <span className="input-icon-sym">🔗</span>
                <input
                  type="url"
                  placeholder="https://…?id=…"
                  value={link}
                  onChange={(e) => { setLink(e.target.value); setError(null) }}
                />
              </div>
            </label>
            {error && <p className="cam-error login-error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={!link.trim()}>
              Ver marcador →
            </button>
            <p className="login-note">Los espectadores no necesitan cuenta.</p>
          </form>
        )}
      </div>

      <footer className="app-footer">Hecho con ⚽ para el fútbol de barrio</footer>
    </div>
  )
}