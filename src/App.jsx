import { useCallback, useEffect, useMemo, useState } from 'react'
import CreateMatch from './components/CreateMatch.jsx'
import Scoreboard from './components/Scoreboard.jsx'
import Login from './components/Login.jsx'

const STORAGE_KEY = 'liga-live:match'
const AUTH_KEY = 'liga-live:auth'
const PIN_KEY = 'liga-live:pin'
const DEFAULT_PIN = '2255'

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

export function encodeMatch(match) {
  return btoa(encodeURIComponent(JSON.stringify(match)))
}

async function fetchPin() {
  try {
    const cached = localStorage.getItem(PIN_KEY)
    if (cached) return cached
    const res = await fetch('/api/config')
    const data = await res.json()
    const pin = String(data.pin || DEFAULT_PIN)
    try {
      localStorage.setItem(PIN_KEY, pin)
    } catch {}
    return pin
  } catch {
    return DEFAULT_PIN
  }
}

export default function App() {
  const [authed, setAuthed] = useState(() => {
    try {
      return localStorage.getItem(AUTH_KEY) === '1'
    } catch {
      return false
    }
  })
  const [view, setView] = useState('home')
  const [match, setMatch] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    const urlMatch = decodeMatch(window.location.search)
    if (urlMatch) {
      setMatch(urlMatch)
      setView('live')
    }
  }, [])

  const persist = useCallback((next) => {
    setMatch(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }, [])

  const isCreator = useMemo(
    () => !!match && !!match.id && !!match.currentId && match.id === match.currentId && authed,
    [match, authed]
  )

  const handleLogin = async (pin) => {
    let expected = await fetchPin()
    if (pin !== expected) {
      try {
        localStorage.removeItem(PIN_KEY)
      } catch {}
      expected = await fetchPin()
    }
    if (pin === expected) {
      try {
        localStorage.setItem(AUTH_KEY, '1')
      } catch {}
      setAuthed(true)
      return true
    }
    return false
  }

  const handleLogout = () => {
    try {
      localStorage.removeItem(AUTH_KEY)
    } catch {}
    setAuthed(false)
    setView('home')
  }

  const handleSave = (next) => {
    const id = next.id || newId()
    persist({ ...next, id, currentId: id })
    setView('live')
  }

  const handleScore = (team, delta) => {
    if (!isCreator) return
    persist({
      ...match,
      [team === 'home' ? 'homeScore' : 'awayScore']: Math.max(
        0,
        (team === 'home' ? match.homeScore : match.awayScore) + delta
      ),
    })
  }

  const handleEdit = () => setView('home')
  const handleReset = () => {
    if (!isCreator) return
    persist({ ...match, homeScore: 0, awayScore: 0 })
  }

  if (view === 'live' && match) {
    return (
      <Scoreboard
        match={match}
        onScore={handleScore}
        isCreator={isCreator}
        onEdit={handleEdit}
        onReset={handleReset}
        onLogout={handleLogout}
      />
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