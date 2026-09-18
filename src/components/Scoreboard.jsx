import { useState } from 'react'
import StreamPlayer from './StreamPlayer.jsx'
import CameraStream from './CameraStream.jsx'
import { encodeMatch } from '../App.jsx'

function TeamSide({ team, score, side, isCreator, onScore }) {
  return (
    <div className={`team-side ${side}`} style={{ '--team': team.color }}>
      <span className="team-stripe" aria-hidden="true" style={{ background: team.color }} />
      <button type="button" className="shield-btn" aria-label={`Escudo ${team.name}`}>
        <span className="team-shield">{team.emoji}</span>
      </button>
      <h1 className="team-name">{team.name}</h1>
      <div className="score-wrap">
        <span className="score-num" key={score}>{String(score).padStart(2, '0')}</span>
        {isCreator && (
          <button type="button" className="score-btn plus" aria-label="Sumar gol" onClick={() => onScore(side, 1)}>+</button>
        )}
      </div>
      {isCreator && (
        <div className="score-controls">
          <button type="button" className="ctrl" aria-label="Restar gol" onClick={() => onScore(side, -1)}>−</button>
          <span>gol</span>
          <button type="button" className="ctrl" aria-label="Sumar gol" onClick={() => onScore(side, 1)}>+</button>
        </div>
      )}
    </div>
  )
}

export default function Scoreboard({ match, onScore, isCreator, onEdit, onReset, onLogout }) {
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState('link')

  const shareUrl = () => {
    const { currentId, ...shareable } = match
    return `${window.location.origin}${window.location.pathname}?m=${encodeMatch(shareable)}`
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const fmtDate = () => {
    if (!match.dateTime) return 'En vivo ahora'
    try {
      const d = new Date(match.dateTime)
      return d.toLocaleString('es', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    } catch {
      return match.dateTime
    }
  }

  return (
    <div className="live-page">
      <header className="live-topbar">
        <div className="live-brand"><span className="brand-dot" aria-hidden="true" /> Liga Live</div>
        <div className="topbar-actions">
          {isCreator && (
            <>
              <button type="button" className="btn-ghost" onClick={onReset} title="Poner el marcador en 0">↺ Reiniciar</button>
              <button type="button" className="btn-ghost" onClick={onEdit}>✏️ Editar</button>
              <button type="button" className="btn-ghost" onClick={onLogout}>Salir</button>
            </>
          )}
          <button type="button" className="btn-share" onClick={handleShare}>
            {copied ? '✓ Enlace copiado' : '🔗 Compartir'}
          </button>
        </div>
      </header>

      <section className="live-hero" style={{ '--hero1': match.home.color, '--hero2': match.away.color }}>
        <div className="tournament-band">
          <span className="live-pill"><span className="live-pill-dot" /> EN VIVO</span>
          <h2 className="tournament-name">{match.tournament}</h2>
          {match.matchTitle && <span className="match-title">{match.matchTitle}</span>}
          <time className="match-date">{fmtDate()}</time>
        </div>

        <div className="scoreboard-card" style={{ '--hero1': match.home.color, '--hero2': match.away.color }}>
          <TeamSide
            team={match.home}
            score={match.homeScore}
            side="home"
            isCreator={isCreator}
            onScore={onScore}
          />
          <div className="score-divider">:</div>
          <TeamSide
            team={match.away}
            score={match.awayScore}
            side="away"
            isCreator={isCreator}
            onScore={onScore}
          />
        </div>
        {isCreator && <p className="creator-tip">Tocá los botones para sumar goles al marcador en vivo ⚽</p>}
      </section>

      <main className="stream-section">
        <div className="stream-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'link'}
            className={`stream-tab ${mode === 'link' ? 'active' : ''}`}
            onClick={() => setMode('link')}
          >
            🔗 Enlace externo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'camera'}
            className={`stream-tab ${mode === 'camera' ? 'active' : ''}`}
            onClick={() => setMode('camera')}
          >
            🎥 Cámara directo
          </button>
        </div>

        {mode === 'camera' ? (
          <CameraStream match={match} isCreator={isCreator} />
        ) : (
          <StreamPlayer
            url={match.streamUrl}
            embedCode={match.embedCode}
            title={`${match.home.name} vs ${match.away.name}`}
          />
        )}
      </main>

      <footer className="live-footer">
        {isCreator
          ? '👈 Compartí el enlace para que todos vean el marcador en vivo'
          : 'Marcador en vivo — Liga Live'}
      </footer>

      <div className="mobile-action-bar">
        <button type="button" className="btn-share mobile-share" onClick={handleShare}>
          {copied ? '✓ Enlace copiado' : '🔗 Compartir este en vivo'}
        </button>
      </div>
    </div>
  )
}