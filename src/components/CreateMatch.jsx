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

const STEPS = [
  { id: 0, label: 'Partido', emoji: '🏆' },
  { id: 1, label: 'Equipos', emoji: '⚽' },
  { id: 2, label: 'Transmisión', emoji: '📡' },
]

function StepPartido({ form, set }) {
  return (
    <div className="wizard-step fade-in-step">
      <div className="field">
        <span>Nombre del campeonato o torneo *</span>
        <input
          type="text"
          placeholder="Ej: Copa de Barrio Los Pinos"
          value={form.tournament}
          autoFocus
          onChange={(e) => set({ tournament: e.target.value })}
        />
      </div>
      <div className="grid-2">
        <label className="field">
          <span>Título del partido <em>(opcional)</em></span>
          <input
            type="text"
            placeholder="Ej: Semifinal"
            value={form.matchTitle}
            onChange={(e) => set({ matchTitle: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Fecha y hora</span>
          <input
            type="datetime-local"
            value={form.dateTime}
            onChange={(e) => set({ dateTime: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}

function TeamMini({ title, team, onChange, accent }) {
  return (
    <div className="team-mini" style={{ '--team': team.color, borderTopColor: team.color }}>
      <h3>{title}</h3>
      <div className="shield-picker mini">
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
        <span>{title === 'Local' ? 'Nombre del local' : 'Nombre del visitante'} *</span>
        <input
          type="text"
          placeholder={title === 'Local' ? 'Ej: Los Leones FC' : 'Ej: Estrellas del Sur'}
          maxLength={24}
          value={team.name}
          onChange={(e) => onChange({ ...team, name: e.target.value })}
        />
      </label>
      <div className="color-row">
        <span className="color-row-label">Color</span>
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
          <label className="color-custom" style={{ background: team.color }}>
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(team.color) ? team.color : '#e11d48'}
              onChange={(e) => onChange({ ...team, color: e.target.value })}
            />
          </label>
        </div>
      </div>
    </div>
  )
}

function StepEquipos({ form, set }) {
  const setHome = (home) => set({ home })
  const setAway = (away) => set({ away })
  const swap = () => set({ home: form.away, away: form.home })
  return (
    <div className="wizard-step fade-in-step">
      <div className="teams-grid wizard-teams">
        <TeamMini title="Local" team={form.home} onChange={setHome} />
        <button type="button" className="vs-swap" onClick={swap} title="Intercambiar equipos">
          <span className="vs-swap-label">VS</span>
          <span className="vs-swap-hint">cambiar</span>
        </button>
        <TeamMini title="Visitante" team={form.away} onChange={setAway} />
      </div>
    </div>
  )
}

function StepTransmision({ form, set }) {
  return (
    <div className="wizard-step fade-in-step">
      <div className="trans-option">
        <div className="trans-option-head">
          <span className="trans-option-emoji">🔗</span>
          <div>
            <p>Enlace de una transmisión existente</p>
            <small>Facebook Live, YouTube, Twitch o TikTok. Se reproduce dentro de la plataforma.</small>
          </div>
        </div>
        <label className="field">
          <div className="input-icon">
            <span className="input-icon-sym">🌐</span>
            <input
              type="url"
              placeholder="Ej: https://www.facebook.com/…"
              value={form.streamUrl}
              onChange={(e) => set({ streamUrl: e.target.value })}
            />
          </div>
        </label>
        <label className="field">
          <span>Código de inserción (embed) <em>· opcional, más confiable</em></span>
          <textarea
            rows="3"
            spellCheck="false"
            placeholder="<iframe src=&#34;…&#34;></iframe>"
            value={form.embedCode}
            onChange={(e) => set({ embedCode: e.target.value })}
          />
        </label>
      </div>

      <div className="trans-option">
        <div className="trans-option-head">
          <span className="trans-option-emoji">🎥</span>
          <div>
            <p>O transmití con tu cámara</p>
            <small>Nada de enlaces: iniciás el directo con cámara y micrófono al entrar al marcador.</small>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CreateMatch({ match, onStart, onGoLive, onLogout }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() =>
    match ? JSON.parse(JSON.stringify(match)) : JSON.parse(JSON.stringify(EMPTY_MATCH))
  )

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const validStep = () => {
    if (step === 0) return !!form.tournament.trim()
    if (step === 1) return !!(form.home.name.trim() && form.away.name.trim())
    return true
  }

  const next = () => (step < 2 ? setStep(step + 1) : null)
  const back = () => setStep(Math.max(0, step - 1))

  const submit = (e) => {
    e.preventDefault()
    onStart({
      ...form,
      homeScore: Number(form.homeScore || 0),
      awayScore: Number(form.awayScore || 0),
    })
  }

  return (
    <div className="setup-page">
      <header className="setup-top">
        <div className="brand">
          <span className="brand-logo" aria-hidden="true" />
          <div>
            <h1>Liga Live</h1>
            <p>Nuevo evento</p>
          </div>
        </div>
        <div className="setup-top-actions">
          {onGoLive && (
            <button type="button" className="btn-ghost" onClick={onGoLive}>▶ Ver mi transmisión</button>
          )}
          <button type="button" className="btn-ghost" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <form className="setup-card" onSubmit={submit}>
        <div className="wizard-progress" aria-label="Progreso">
          {STEPS.map((s) => {
            const state = s.id === step ? 'current' : s.id < step ? 'done' : 'todo'
            return (
              <button
                key={s.id}
                type="button"
                className={`wizard-step-pill ${state}`}
                onClick={() => setStep(s.id)}
              >
                <span className="wizard-step-num">{state === 'done' ? '✓' : s.id + 1}</span>
                <span className="wizard-step-text">{s.emoji} {s.label}</span>
              </button>
            )
          })}
        </div>

        {step === 0 && <StepPartido form={form} set={set} />}
        {step === 1 && <StepEquipos form={form} set={set} />}
        {step === 2 && <StepTransmision form={form} set={set} />}

        <div className="wizard-nav">
          {step > 0 ? (
            <button type="button" className="btn-ghost wizard-back" onClick={back}>← Volver</button>
          ) : (
            <span />
          )}

          {step < 2 ? (
            <button type="button" className="btn-primary wizard-continue" disabled={!validStep()} onClick={next}>
              Continuar →
            </button>
          ) : (
            <button type="submit" className="btn-primary wizard-continue">
              ¡Ir al marcador en vivo!
              <span className="btn-live-dot" />
            </button>
          )}
        </div>

        {!validStep() && step < 2 && (
          <p className="form-hint">
            {step === 0
              ? 'Escribí el nombre del torneo para continuar.'
              : 'Completá el nombre de ambos equipos para continuar.'}
          </p>
        )}
      </form>

      <footer className="app-footer">Hecho con ⚽ para el fútbol de barrio</footer>
    </div>
  )
}