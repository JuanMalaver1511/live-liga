import { useState } from 'react'

const SHIELDS = ['🛡️', '🔥', '⚡', '🦁', '🐺', '🐂', '🦅', '🐉', '🧡', '💙', '⚓', '🚀', '🐲', '⚽', '🦇', '🌪️', '⛰️', '🎯']

const COLORS = ['#e11d48', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899']

const EMPTY_MATCH = {
  tournament: '',
  matchTitle: '',
  dateTime: '',
  streamUrl: '',
  embedCode: '',
  home: { name: '', emoji: '🛡️', color: '#e11d48' },
  away: { name: '', emoji: '⚡', color: '#3b82f6' },
  homeScore: 0,
  awayScore: 0,
}

function TeamEditor({ label, team, onChange }) {
  return (
    <div className="team-editor">
      <h3>{label}</h3>
      <div className="shield-picker">
        {SHIELDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`shield-opt ${team.emoji === s ? 'selected' : ''}`}
            onClick={() => onChange({ ...team, emoji: s })}
          >
            {s}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Nombre del equipo</span>
        <input
          type="text"
          placeholder="Ej: Los Leones FC"
          value={team.name}
          maxLength={24}
          onChange={(e) => onChange({ ...team, name: e.target.value })}
        />
      </label>
      <div className="color-picker">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`color ${c}`}
            className={`color-opt ${team.color === c ? 'selected' : ''}`}
            style={{ background: c }}
            onClick={() => onChange({ ...team, color: c })}
          />
        ))}
        <label className="color-custom" style={{ background: 'conic-gradient(from 0deg, #ef4444, #22c55e, #3b82f6, #f59e0b, #ef4444)' }}>
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(team.color) ? team.color : '#e11d48'}
            onChange={(e) => onChange({ ...team, color: e.target.value })}
          />
        </label>
      </div>
      <div className="team-preview" style={{ '--team': team.color, background: team.color }}>
        <span className="preview-shield">{team.emoji}</span>
        <span className="preview-name">{team.name || 'Nombre del equipo'}</span>
      </div>
    </div>
  )
}

export default function CreateMatch({ match, onStart }) {
  const [form, setForm] = useState(() =>
    match ? JSON.parse(JSON.stringify(match)) : JSON.parse(JSON.stringify(EMPTY_MATCH))
  )

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setHome = (home) => set({ home })
  const setAway = (away) => set({ away })

  const valid =
    form.tournament.trim() &&
    form.home.name.trim() &&
    form.away.name.trim()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!valid) return
    onStart({
      ...form,
      homeScore: Number(form.homeScore || 0),
      awayScore: Number(form.awayScore || 0),
    })
  }

  return (
    <div className="setup-page">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo" aria-hidden="true" />
          <div>
            <h1>Liga Live</h1>
            <p>Banner de transmisión deportiva</p>
          </div>
        </div>
      </header>

      <form className="setup-card" onSubmit={handleSubmit}>
        <h2 className="setup-title">Armá tu transmisión</h2>
        <p className="setup-subtitle">Completá los datos del encuentro y en un clic vas al marcador en vivo con tu video.</p>

        <div className="section-label">Partido</div>
        <div className="grid-2">
          <label className="field">
            <span>Nombre del campeonato / torneo</span>
            <input
              type="text"
              placeholder="Ej: Copa de Barrio Los Pinos"
              value={form.tournament}
              onChange={(e) => set({ tournament: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Título del partido <em>(opcional)</em></span>
            <input
              type="text"
              placeholder="Ej: Semifinal · Jornada 3"
              value={form.matchTitle}
              onChange={(e) => set({ matchTitle: e.target.value })}
            />
          </label>
        </div>

        <label className="field field-date">
          <span>Fecha y hora del encuentro</span>
          <input
            type="datetime-local"
            value={form.dateTime}
            onChange={(e) => set({ dateTime: e.target.value })}
          />
        </label>

        <div className="section-label">Equipos</div>
        <div className="teams-grid">
          <TeamEditor label="Equipo local" team={form.home} onChange={setHome} />
          <div className="vs-divider">VS</div>
          <TeamEditor label="Equipo visitante" team={form.away} onChange={setAway} />
        </div>

        <div className="section-label">Transmisión en vivo</div>
        <label className="field">
          <span>Link de la transmisión</span>
          <div className="input-icon">
            <span className="input-icon-sym">🔗</span>
            <input
              type="url"
              placeholder="Ej: https://www.facebook.com/… o https://youtu.be/…"
              value={form.streamUrl}
              onChange={(e) => set({ streamUrl: e.target.value })}
            />
          </div>
          <small>Funciona con Facebook Live, YouTube, Twitch y TikTok (link del video o <code>@usuario/live</code>). Si el link no se puede incrustar, se intenta igual dentro de la plataforma.</small>
        </label>

        <label className="field">
          <span>O pega el código de inserción (embed) <em>(opcional · más confiable)</em></span>
          <textarea
            rows="3"
            spellCheck="false"
            placeholder="<iframe src=&#34;https://www.facebook.com/plugins/video.php?…&#34; …></iframe>"
            value={form.embedCode}
            onChange={(e) => set({ embedCode: e.target.value })}
          />
          <small>
            En Facebook abrí tu transmisión → menú <strong>…</strong> → <strong>Insertar</strong> y copiá el código. En YouTube: <strong>Compartir → Insertar</strong>. En TikTok: <strong>Compartir → Copiar código de inserción</strong>. Ese código reproduce el video exactamente dentro de la plataforma.
          </small>
        </label>

        <button type="submit" className="btn-primary" disabled={!valid}>
          {match?.id ? 'Guardar y empezar' : '¡Empezar transmisión!'}
          <span className="btn-live-dot" />
        </button>
        {!valid && (
          <p className="form-hint">Completa el nombre del torneo y ambos equipos para continuar.</p>
        )}
      </form>

      <footer className="app-footer">
        Hecho con ⚽ para el fútbol de barrio · Compartí el link y que toda la banda vote el gol
      </footer>
    </div>
  )
}