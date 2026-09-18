import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { serveClient: false })

const PORT = process.env.PORT || 3001
const rooms = new Map()

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

const dist = path.join(__dirname, '..', 'dist')
if (process.env.NODE_ENV !== 'development') {
  app.use(express.static(dist))
  app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

httpServer.listen(PORT, () => {
  console.log(`Liga Live server escuchando en :${PORT}`)
})