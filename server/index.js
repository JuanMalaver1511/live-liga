import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import crypto from 'crypto'
import pg from 'pg'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { serveClient: false })

const PORT = process.env.PORT || 3001
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'organizador@live.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Organizador123'

app.use(express.json())

/* ---------------- Credenciales ---------------- */

const sessions = new Map()

function authRequired(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'no-autorizado' })
  next()
}

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {}
  if (String(email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase() || String(password || '') !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'credenciales invalidas' })
  }
  const token = crypto.randomUUID().replace(/-/g, '')
  sessions.set(token, email)
  res.json({ token, email: ADMIN_EMAIL })
})

app.post('/api/logout', authRequired, (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  sessions.delete(token)
  res.json({ ok: true })
})

app.get('/api/config', (_req, res) => {
  res.json({
    adminEmail: ADMIN_EMAIL,
    turn: {
      host: process.env.TURN_HOST || '',
      port: process.env.TURN_PORT || '3478',
      username: process.env.TURN_USERNAME || '',
      password: process.env.TURN_PASSWORD || '',
    },
  })
})

/* ---------------- Base de datos ---------------- */

const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null

const memory = new Map()

const COLUMNS = [
  'id',
  'tournament',
  'match_title',
  'date_time',
  'home_name',
  'home_emoji',
  'home_color',
  'away_name',
  'away_emoji',
  'away_color',
  'home_score',
  'away_score',
  'stream_url',
  'embed_code',
  'stream_mode',
  'status',
  'updated_at',
]

async function initDb() {
  if (!pool) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      tournament TEXT NOT NULL DEFAULT '',
      match_title TEXT NOT NULL DEFAULT '',
      date_time TEXT NOT NULL DEFAULT '',
      home_name TEXT NOT NULL DEFAULT '',
      home_emoji TEXT NOT NULL DEFAULT '',
      home_color TEXT NOT NULL DEFAULT '#22c55e',
      away_name TEXT NOT NULL DEFAULT '',
      away_emoji TEXT NOT NULL DEFAULT '',
      away_color TEXT NOT NULL DEFAULT '#3b82f6',
      home_score INT NOT NULL DEFAULT 0,
      away_score INT NOT NULL DEFAULT 0,
      stream_url TEXT NOT NULL DEFAULT '',
      embed_code TEXT NOT NULL DEFAULT '',
      stream_mode TEXT NOT NULL DEFAULT 'link',
      status TEXT NOT NULL DEFAULT 'live',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS stream_mode TEXT NOT NULL DEFAULT 'link'`).catch(() => {})
  console.log('PostgreSQL listo')
}

async function getMatch(id) {
  if (pool) {
    const { rows } = await pool.query('SELECT * FROM matches WHERE id = $1', [id])
    return rows[0] ? fromRow(rows[0]) : null
  }
  return memory.get(id) || null
}

async function upsertMatch(m) {
  if (pool) {
    await pool.query(
      `INSERT INTO matches (${COLUMNS.join(', ')}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'live',now())
       ON CONFLICT (id) DO UPDATE SET
         tournament=EXCLUDED.tournament,
         match_title=EXCLUDED.match_title,
         date_time=EXCLUDED.date_time,
         home_name=EXCLUDED.home_name,
         home_emoji=EXCLUDED.home_emoji,
         home_color=EXCLUDED.home_color,
         away_name=EXCLUDED.away_name,
         away_emoji=EXCLUDED.away_emoji,
         away_color=EXCLUDED.away_color,
         home_score=EXCLUDED.home_score,
         away_score=EXCLUDED.away_score,
         stream_url=EXCLUDED.stream_url,
         embed_code=EXCLUDED.embed_code,
         stream_mode=EXCLUDED.stream_mode,
         updated_at=now()`,
      toParams(m)
    )
    return
  }
  memory.set(String(m.id), { ...m, status: m.status || 'live' })
}

async function setStatus(id, status) {
  if (pool) {
    await pool.query(`UPDATE matches SET status=$1, updated_at=now() WHERE id=$2`, [status, id])
    return
  }
  const m = memory.get(String(id))
  if (m) m.status = status
}

function fromRow(r) {
  return {
    id: r.id,
    tournament: r.tournament,
    matchTitle: r.match_title,
    dateTime: r.date_time,
    home: { name: r.home_name, emoji: r.home_emoji, color: r.home_color },
    away: { name: r.away_name, emoji: r.away_emoji, color: r.away_color },
    homeScore: Number(r.home_score) || 0,
    awayScore: Number(r.away_score) || 0,
    streamUrl: r.stream_url,
    embedCode: r.embed_code,
    streamMode: r.stream_mode || 'link',
    status: r.status || 'live',
    updatedAt: r.updated_at,
  }
}

function toParams(m) {
  const h = m.home || {}
  const a = m.away || {}
  return [
    String(m.id),
    String(m.tournament || ''),
    String(m.matchTitle || ''),
    String(m.dateTime || ''),
    String(h.name || ''),
    String(h.emoji || ''),
    String(h.color || '#22c55e'),
    String(a.name || ''),
    String(a.emoji || ''),
    String(a.color || '#3b82f6'),
    Number(m.homeScore || 0),
    Number(m.awayScore || 0),
    String(m.streamUrl || ''),
    String(m.embedCode || ''),
    String(m.streamMode || 'link'),
  ]
}

/* ---------------- API de partidos ---------------- */

app.post('/api/matches', authRequired, async (req, res) => {
  const m = req.body
  if (!m || !m.id) return res.status(400).json({ error: 'falta id' })
  try {
    await upsertMatch(m)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/matches/:id', async (req, res) => {
  try {
    const m = await getMatch(req.params.id)
    if (!m) return res.status(404).json({ error: 'no existe' })
    res.json(m)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/matches/:id/finish', authRequired, async (req, res) => {
  await setStatus(req.params.id, 'finalizado')
  res.json({ ok: true })
})

app.post('/api/matches/:id/reopen', authRequired, async (req, res) => {
  await setStatus(req.params.id, 'live')
  res.json({ ok: true })
})

/* ---------------- Señalización WebRTC ---------------- */

const rooms = new Map()
const roomMode = new Map()

function peersOf(room) {
  if (!rooms.has(room)) rooms.set(room, new Map())
  return rooms.get(room)
}

io.on('connection', (socket) => {
  socket.on('join', ({ room, role }, ack) => {
    socket.join(room)
    socket.data.room = room
    socket.data.role = role
    const peers = peersOf(room)
    peers.set(socket.id, role)

    if (roomMode.has(room)) {
      socket.emit('stream-mode', { mode: roomMode.get(room) })
    }

    socket.emit('peers', {
      peers: [...peers.entries()]
        .filter(([id]) => id !== socket.id)
        .map(([id, r]) => ({ id, role: r })),
    })
    socket.to(room).emit('peer-joined', { id: socket.id, role })
    ack?.({ ok: true })
  })

  socket.on('offer', ({ to, sdp }) => socket.to(to).emit('offer', { from: socket.id, sdp }))
  socket.on('answer', ({ to, sdp }) => socket.to(to).emit('answer', { from: socket.id, sdp }))
  socket.on('ice', ({ to, candidate }) => socket.to(to).emit('ice', { from: socket.id, candidate }))

  socket.on('stream-mode', ({ room, mode }) => {
    if (mode !== 'link' && mode !== 'camera') return
    roomMode.set(room, mode)
    socket.to(room).emit('stream-mode', { mode })
  })

  socket.on('score', ({ room, patch }) => {
    patch = patch || {}
    if (typeof patch.homeScore !== 'number' && typeof patch.awayScore !== 'number' && !patch.status) return
    socket.to(room).emit('score', { patch })
  })

  socket.on('disconnect', () => {
    for (const [room, peers] of rooms) {
      if (peers.has(socket.id)) {
        peers.delete(socket.id)
        socket.to(room).emit('peer-left', { id: socket.id })
        if (peers.size === 0) rooms.delete(room)
      }
    }
  })
})

/* ---------------- Estáticos ---------------- */

const dist = path.join(__dirname, '..', 'dist')

if (process.env.NODE_ENV !== 'development') {
  app.use(express.static(dist))
  app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

initDb()
  .catch((e) => console.error('No se pudo conectar a Postgres:', e.message))
  .finally(() => {
    httpServer.listen(PORT, () => {
      console.log(`Liga Live server escuchando en :${PORT}${pool ? '' : ' (sin DATABASE_URL, memoria)'}`)
    })
  })