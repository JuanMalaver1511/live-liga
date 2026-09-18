import { useCallback, useEffect, useMemo, useState } from 'react'
import CreateMatch from './components/CreateMatch.jsx'
import Scoreboard from './components/Scoreboard.jsx'
import Login from './components/Login.jsx'

const STORAGE_KEY = 'liga-live:match'
const TOKEN_KEY = 'liga-live:token'
const EMAIL_KEY = 'liga-live:email'

const newId = () => Math.random().toString(36).slice(2, 10)

export function decodeMatch(query) {
  try {
    const raw = new URLSearchParams(query).get('m')
    if (!raw) return null
    return JSON.parse(decodeURIComponent(atob(raw)))
  } catch {
    return null
  }
}

export default function App() {
  const [authed, setAuthed] = useState(() => {
    try {
      return !!localStorage.getItem(TOKEN_KEY)
    } catch {
      return false
    }
  })
  const [view, setView] = useState('home')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [match, setMatch] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const token = useMemo(() => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  }, [authed])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id')
    const legacy = params.get('m')

    if (id) {
      setLoading(true)
      setLoadError(null)
      fetch(`/api/matches/${id}`)
        .then(async (res) => {
          if (!res.ok) throw new Error('no-encontrado')
          const data = await res.json()
          setMatch({ ...data, currentId: null })
          setView('live')
        })
        .catch(() => {
          setLoadError('No encontramos ese partido en la base de datos.')
        })
        .finally(() => setLoading(false))
      return
    }

    if (legacy) {
      const decoded = decodeMatch(window.location.search)
      if (decoded) {
        setMatch(decoded)
        setView('live')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = useCallback((next) => {
    setMatch(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }, [])

  const saveMatch = useCallback(
    async (m) => {
      if (!token) return
      try {
        const res = await fetch('/api/matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(m),
        })
        if (res.status === 401) {
          try {
            localStorage.removeItem(TOKEN_KEY)
          } catch {}
          setAuthed(false)
        }
      } catch {}
    },
    [token]
  )

  const handleLogin = async (email, password) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) return false
      const data = await res.json()
      try {
        localStorage.setItem(TOKEN_KEY, data.token)
        localStorage.setItem(EMAIL_KEY, data.email)
      } catch {}
      setAuthed(true)
      return true
    } catch {
      return false
    }
  }

  const handleLogout = async () => {
    try {
      if (token) await fetch('/api/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    } catch {}
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(EMAIL_KEY)
    } catch {}
    setAuthed(false)
    setView('home')
  }

  const handleSave = async (next) => {
    const id = next.id || newId()
    const saved = { ...next, id, currentId: id, status: next.status || 'live' }
    persist(saved)
    await saveMatch(saved)
    setView('live')
  }

  const isCreator = useMemo(
    () => !!match && !!match.id && !!match.currentId && match.id === match.currentId && authed,
    [match, authed]
  )

  const handleScore = (team, delta) => {
    if (!isCreator) return
    const next = {
      ...match,
      [team === 'home' ? 'homeScore' : 'awayScore']: Math.max(
        0,
        (team === 'home' ? match.homeScore : match.awayScore) + delta
      ),
    }
    persist(next)
    saveMatch(next)
  }

  const handleFinish = async () => {
    if (!isCreator) return
    const next = { ...match, status: 'finalizado' }
    persist(next)
    try {
      if (token) {
        await fetch(`/api/matches/${match.id}/finish`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch {}
  }

  const handleReopen = async () => {
    if (!isCreator) return
    const next = { ...match, status: 'live' }
    persist(next)
    try {
      if (token) {
        await fetch(`/api/matches/${match.id}/reopen`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch {}
  }

  const handleEdit = () => setView('home')
  const handleReset = () => {
    if (!isCreator) return
    const next = { ...match, homeScore: 0, awayScore: 0 }
    persist(next)
    saveMatch(next)
  }

  const handleModeChange = (streamMode) => {
    if (!isCreator) return
    const next = { ...match, streamMode }
    persist(next)
    saveMatch(next)
  }

  const handleSync = (patch) => {
    if (!patch) return
    setMatch((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  if (loading) {
    return (
      <div className="loader-page">
        <span className="loader-spin" />
        <p>Cargando partido…</p>
      </div>
    )
  }

  if (view === 'live' && match) {
    return (
      <Scoreboard
        match={match}
        onScore={handleScore}
        isCreator={isCreator}
        onEdit={handleEdit}
        onReset={handleReset}
        onFinish={handleFinish}
        onReopen={handleReopen}
        onLogout={handleLogout}
        onModeChange={handleModeChange}
        onSync={handleSync}
      />
    )
  }

  if (loadError) {
    return (
      <div className="loader-page">
        <p>⚠️ {loadError}</p>
        <button type="button" className="btn-ghost" onClick={() => (window.location.href = '/')}>
          Volver al inicio
        </button>
      </div>
    )
  }

  if (!authed) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <CreateMatch
      match={match}
      onStart={handleSave}
      onGoLive={match?.id ? () => setView('live') : null}
      onLogout={handleLogout}
    />
  )
}