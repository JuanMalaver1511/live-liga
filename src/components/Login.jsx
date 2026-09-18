import { useState } from 'react'

export default function Login({ onLogin }) {
  const [pin, setPin] = useState('')
  const [link, setLink] = useState('')
  const [tab, setTab] = useState('organizador')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submitPin = async (e) => {
    e.preventDefault()
    if (!pin.trim()) return
    setBusy(true)
    setError(null)
    const ok = await onLogin(pin.trim())
    setBusy(false)
    if (!ok) setError('Código incorrecto. Probá de nuevo.')
  }

  const submitLink = (e) => {
    e.preventDefault()
    if (!link.trim()) return
    try {
      const url = new URL(link.trim())
      if (url.pathname.includes('?m=') || url.searchParams.has('m')) {
        window.location.href = url.href
        return
      }
      setError('Ese enlace no parece un enlace de Liga Live.')
    } catch {
      setError('Pegá el enlace completo de compartir (incluye el código).')
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
          <form className="login-form" onSubmit={submitPin}>
            <h2>Crear partidos y transmitir</h2>
            <p className="login-desc">
              Ingresá tu código de organización para crear partidos, manejar el marcador e iniciar el directo con cámara.
            </p>
            <label className="field">
              <span>Código de organización</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••"
                value={pin}
                maxLength={8}
                onChange={(e) => { setPin(e.target.value); setError(null) }}
                disabled={busy}
              />
            </label>
            {error && <p className="cam-error login-error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy || !pin.trim()}>
              {busy ? 'Verificando…' : 'Ingresar'}
            </button>
            <p className="login-note">
              El código lo configurás en Railway con la variable <code>ORGANIZER_PIN</code>.
            </p>
          </form>
        ) : (
          <form className="login-form" onSubmit={submitLink}>
            <h2>Ver un partido en vivo</h2>
            <p className="login-desc">
              Pegá el enlace de compartir que te mandó el organizador y entrás directo al marcador.
            </p>
            <label className="field">
              <span>Enlace del partido</span>
              <div className="input-icon">
                <span className="input-icon-sym">🔗</span>
                <input
                  type="url"
                  placeholder="https://…ligalive…?m=…"
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