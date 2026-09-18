import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import StreamPlayer from './StreamPlayer.jsx'
import CameraStream from './CameraStream.jsx'

function TeamSide({ team, score, side, isCreator, finished, onScore }) {
  return (
    <div className={`team-side ${side}`} style={{ '--team': team.color }}>
      <span className="team-stripe" aria-hidden="true" style={{ background: team.color }} />
      <button type="button" className="shield-btn" aria-label={`Escudo ${team.name}`}>
        <span className="team-shield">{team.emoji}</span>
      </button>
      <h1 className="team-name">{team.name}</h1>
      <div className="score-wrap">
        <span className="score-num" key={score}>{String(score).padStart(2, '0')}</span>
        {isCreator && !finished && (
          <button type="button" className="score-btn plus" aria-label="Sumar gol" onClick={() => onScore(side, 1)}>+</button>
        )}
      </div>
      {isCreator && !finished && (
        <div className="score-controls">
          <button type="button" className="ctrl" aria-label="Restar gol" onClick={() => onScore(side, -1)}>−</button>
          <span>gol</span>
          <button type="button" className="ctrl" aria-label="Sumar gol" onClick={() => onScore(side, 1)}>+</button>
        </div>
      )}
    </div>
  )
}

export default function Scoreboard({
  match,
  onScore,
  isCreator,
  onEdit,
  onReset,
  onFinish,
  onReopen,
  onLogout,
  onModeChange,
  onSync,
}) {
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState(() => match.streamMode || 'link')
  const modeSocketRef = useRef(null)

  const finished = match.status === 'finalizado'
  const room = `match:${match.id}`

  useEffect(() => {
    if (!match.id) return
    const socket = io()
    modeSocketRef.current = socket
    socket.emit('join', { room, role: isCreator ? 'organizer' : 'watcher' })
    if (!isCreator) {
      socket.on('stream-mode', ({ mode: m }) => setMode(m))
      socket.on('score', ({ patch }) => onSync?.(patch))
    }
    return () => {
      socket.disconnect()
      modeSocketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreator, match.id])

  useEffect(() => {
    if (isCreator && modeSocketRef.current) {
      modeSocketRef.current.emit('stream-mode', { room, mode })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isCreator])

  useEffect(() => {
    if (isCreator && modeSocketRef.current) {
      modeSocketRef.current.emit('score', {
        room,
        patch: { homeScore: match.homeScore, awayScore: match.awayScore, status: match.status },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreator, match.homeScore, match.awayScore, match.status])

  const selectMode = (m) => {
    setMode(m)
    if (isCreator) onModeChange?.(m)
  }

  const shareUrl = () =>
    `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(match.id)}`

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
          {finished ? (
            <span className="live-pill final"><span className="final-dot" /> FINAL</span>
          ) : (
            <span className="live-pill"><span className="live-pill-dot" /> EN VIVO</span>
          )}
          <h2 className="tournament-name">{match.tournament}</h2>
          <div className="match-meta">
            {match.matchTitle && <span className="match-title">{match.matchTitle}</span>}
            {finished && <span className="result-chip">Resultado final</span>}
          </div>
          <time className="match-date">{fmtDate()}</time>
        </div>

        <div className="scoreboard-card" style={{ '--hero1': match.home.color, '--hero2': match.away.color }}>
          <TeamSide
            team={match.home}
            score={match.homeScore}
            side="home"
            isCreator={isCreator}
            finished={finished}
            onScore={onScore}
          />
          <div className="score-divider">:</div>
          <TeamSide
            team={match.away}
            score={match.awayScore}
            side="away"
            isCreator={isCreator}
            finished={finished}
            onScore={onScore}
          />
        </div>

        {isCreator && !finished && (
          <div className="creator-actions">
            <p className="creator-tip">Tocá los botones para sumar goles al marcador en vivo ⚽</p>
            <button type="button" className="btn-finish" onClick={onFinish}>
              🏁 Finalizar partido y guardar resultado
            </button>
          </div>
        )}
        {isCreator && finished && (
          <div className="creator-actions">
            <button type="button" className="btn-ghost" onClick={onReopen}>↩ Reabrir partido</button>
          </div>
        )}
      </section>

      <main className="stream-section">
        {!isCreator && (
          <div className="stream-tabs stream-tabs-mini" role="presentation">
            <button
              type="button"
              aria-hidden="true"
              className="stream-tab active"
              tabIndex={-1}
            >
              {mode === 'camera' ? '🎥 Transmisión con cámara' : '🔗 Transmisión externa'}
            </button>
          </div>
        )}

        {isCreator && (
          <div className="stream-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'link'}
              className={`stream-tab ${mode === 'link' ? 'active' : ''}`}
              onClick={() => selectMode('link')}
            >
              🔗 Enlace externo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'camera'}
              className={`stream-tab ${mode === 'camera' ? 'active' : ''}`}
              onClick={() => selectMode('camera')}
            >
              🎥 Cámara directo
            </button>
          </div>
        )}

        {mode === 'camera' ? (
          <CameraStream match={match} isCreator={isCreator} onModeChange={selectMode} />
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