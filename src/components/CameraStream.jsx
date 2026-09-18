import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const FALLBACK_ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

function defaultIce() {
  return FALLBACK_ICE
}

function queueCandidate(map, key, candidate) {
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(candidate)
}

function flushCandidates(map, key, pc) {
  const list = map.get(key) || []
  map.delete(key)
  list.forEach((c) => pc.addIceCandidate(c).catch(() => {}))
}

export default function CameraStream({ match, isCreator, onModeChange }) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [viewers, setViewers] = useState(0)
  const [live, setLive] = useState(false)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [audioOn, setAudioOn] = useState(false)
  const [iceReady, setIceReady] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  const socketRef = useRef(null)
  const pcs = useRef(new Map())
  const pending = useRef(new Map())
  const remotePending = useRef(new Map())
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const iceRef = useRef(defaultIce())

  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        const servers = FALLBACK_ICE.iceServers.slice()
        const t = cfg?.turn
        if (t?.host && t?.username) {
          const base = `turn:${t.host}:${t.port || '3478'}`
          servers.push({
            urls: [`${base}?transport=tcp`, base],
            username: t.username,
            credential: t.password,
          })
        }
        iceRef.current = { iceServers: servers }
      })
      .catch(() => {})
      .finally(() => setIceReady(true))
  }, [])

  const room = `match:${match.id}`
  const send = (event, payload) => socketRef.current?.emit(event, payload)

  const closePc = (id) => {
    const pc = pcs.current.get(id)
    if (!pc) return
    try {
      pc.onconnectionstatechange = null
      pc.onicecandidate = null
      pc.ontrack = null
      pc.close()
    } catch {}
    pcs.current.delete(id)
    pending.current.delete(id)
    remotePending.current.delete(id)
  }

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
      localVideoRef.current.play().catch(() => {})
    }
  }, [localStream, running])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.muted = !audioOn
      const p = remoteVideoRef.current.play()
      if (p && typeof p.catch === 'function') p.catch(() => setAudioOn(false))
    }
  }, [remoteStream, audioOn])

  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])

  const setupBroadcasterPc = (remoteId) => {
    const stream = localStreamRef.current
    if (!stream) return null
    const pc = new RTCPeerConnection(iceRef.current)
    pcs.current.set(remoteId, pc)
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        closePc(remoteId)
        setViewers((v) => Math.max(0, v - 1))
      }
    }
    return pc
  }

  const connectToViewer = (remoteId) => {
    const pc = setupBroadcasterPc(remoteId)
    if (!pc) return
    pc.onicecandidate = (e) => {
      if (!e.candidate) return
      if (pc.remoteDescription) send('ice', { to: remoteId, candidate: e.candidate })
      else queueCandidate(pending.current, remoteId, e.candidate)
    }
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        send('offer', { to: remoteId, sdp: pc.localDescription })
        flushCandidates(pending.current, remoteId, pc)
      })
      .catch(() => {})
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      })
      localStreamRef.current = stream
      setLocalStream(stream)
      setRunning(true)
      setLive(true)
      setError(null)
      onModeChange?.('camera')

      const socket = io()
      socketRef.current = socket
      socket.emit('join', { room, role: 'broadcaster' })

      socket.on('peers', ({ peers }) => {
        const viewersList = peers.filter((p) => p.role === 'viewer')
        setViewers(viewersList.length)
        viewersList.forEach((p) => connectToViewer(p.id))
      })

      socket.on('peer-joined', ({ id, role }) => {
        if (role !== 'viewer') return
        setViewers((v) => v + 1)
        connectToViewer(id)
      })

      socket.on('answer', ({ from, sdp }) => {
        const pc = pcs.current.get(from)
        if (!pc) return
        pc.setRemoteDescription(sdp)
          .then(() => flushCandidates(pending.current, from, pc))
          .catch(() => {})
      })

      socket.on('ice', ({ from, candidate }) => {
        const pc = pcs.current.get(from)
        if (!pc) return
        if (pc.remoteDescription) pc.addIceCandidate(candidate).catch(() => {})
        else queueCandidate(remotePending.current, from, candidate)
      })

      socket.on('peer-left', ({ id }) => {
        closePc(id)
        setViewers((v) => Math.max(0, v - 1))
      })
    } catch (e) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'No nos diste permiso de cámara/micrófono. Habilitalo en el navegador e intentá de nuevo.'
          : e?.name === 'NotFoundError'
            ? 'No encontramos cámara ni micrófono en este dispositivo.'
            : 'No pudimos iniciar la cámara: ' + (e?.message || 'error desconocido')
      )
    }
  }

  const stopCamera = () => {
    localStream?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    const ids = [...pcs.current.keys()]
    ids.forEach(closePc)
    socketRef.current?.disconnect()
    socketRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    setRunning(false)
    setLive(false)
    setViewers(0)
  }

  useEffect(() => () => stopCamera(), [])

  useEffect(() => {
    if (isCreator || !match.id || !iceReady) return

    let pc = null
    let socket = null
    let reconnectTimer = null
    let stopped = false

    const cleanup = () => {
      socket?.disconnect()
      socket = null
      if (pc) {
        try {
          pc.close()
        } catch {}
      }
      pc = null
      setReconnecting(false)
    }

    const scheduleReconnect = () => {
      if (reconnectTimer || stopped) return
      setReconnecting(true)
      setLive(false)
      setRemoteStream(null)
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        if (stopped) return
        cleanup()
        connect()
      }, 2500)
    }

    const connect = () => {
      if (stopped) return
      socket = io()
      socketRef.current = socket
      socket.emit('join', { room, role: 'viewer' })

      socket.on('offer', ({ from, sdp }) => {
        if (!pc) {
          pc = new RTCPeerConnection(iceRef.current)
          pc.ontrack = (e) => {
            if (e.streams[0]) {
              setRemoteStream(e.streams[0])
              setLive(true)
              setReconnecting(false)
            }
          }
          pc.onicecandidate = (e) => {
            if (e.candidate) send('ice', { to: from, candidate: e.candidate })
          }
          pc.onconnectionstatechange = () => {
            if (!pc) return
            const st = pc.connectionState
            if (st === 'connected') {
              setLive(true)
              setReconnecting(false)
              setError(null)
            } else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
              scheduleReconnect()
            }
          }
        }
        pc.setRemoteDescription(sdp)
          .then(() => {
            flushCandidates(remotePending.current, from, pc)
            return pc.createAnswer()
          })
          .then((answer) => pc.setLocalDescription(answer))
          .then(() => send('answer', { to: from, sdp: pc.localDescription }))
          .catch(() => {})
      })

      socket.on('ice', ({ from, candidate }) => {
        if (pc?.remoteDescription) pc.addIceCandidate(candidate).catch(() => {})
        else queueCandidate(remotePending.current, from, candidate)
      })

      socket.on('peer-left', () => {
        if (reconnectTimer) return
        setRemoteStream(null)
        setLive(false)
        scheduleReconnect()
      })
    }

    connect()

    return () => {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreator, match.id, iceReady])

  if (isCreator) {
    return (
      <div className="cam-panel">
        <div className="cam-stage">
          {running ? (
            <div className="cam-preview-wrap local">
              <video ref={localVideoRef} className="cam-video" muted playsInline />
              <span className="cam-chip live">EN DIRECTO</span>
              {viewers > 0 && <span className="cam-chip viewers">{viewers} viendo</span>}
            </div>
          ) : (
            <div className="cam-placeholder">
              <span className="cam-placeholder-icon">🎥</span>
              <p>Transmití con tu cámara y micrófono</p>
              <small>Se emite directo a todos los que abran el enlace de este partido.</small>
            </div>
          )}
        </div>

        {error && <p className="cam-error">{error}</p>}

        {!running ? (
          <button type="button" className="cam-start-btn" onClick={startCamera}>
            ⚡ Iniciar cámara y micrófono
          </button>
        ) : (
          <div className="cam-actions">
            <button type="button" className="btn-ghost cam-stop" onClick={stopCamera}>
              ■ Finalizar directo
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="cam-panel">
      <div className="cam-stage">
        <div className="cam-preview-wrap">
          <video ref={remoteVideoRef} className="cam-video" playsInline autoPlay muted={!audioOn} controls />
          <div className={`cam-cover ${live ? 'hidden' : ''}`}>
            <div className="cam-placeholder">
              <span className="cam-placeholder-icon">{reconnecting ? '🔁' : '⏳'}</span>
              <p>
                {reconnecting
                  ? 'La conexión se cayó. Reconectando…'
                  : remoteStream || live
                    ? 'Cargando transmisión…'
                    : 'Esperando que el organizador active la cámara…'}
              </p>
              <small>Se reconecta solo si se corta.</small>
            </div>
          </div>
          {live && !audioOn && (
            <button type="button" className="cam-sound" onClick={() => setAudioOn(true)}>
              🔊 Activar sonido
            </button>
          )}
        </div>
      </div>
      {error && <p className="cam-error">{error}</p>}
    </div>
  )
}