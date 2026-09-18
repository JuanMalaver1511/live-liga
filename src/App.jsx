import { useCallback, useEffect, useMemo, useState } from 'react'
import CreateMatch from './components/CreateMatch.jsx'
import Scoreboard from './components/Scoreboard.jsx'

const STORAGE_KEY = 'liga-live:match'
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

export default function App() {
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
    () => !!match && !!match.id && !!match.currentId && match.id === match.currentId,
    [match]
  )

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

  if (view === 'live' && match) {
    return (
      <Scoreboard
        match={match}
        onScore={handleScore}
        isCreator={isCreator}
        onEdit={handleEdit}
        onReset={handleEdit}
      />
    )
  }

  return <CreateMatch match={match} onStart={handleSave} />
}