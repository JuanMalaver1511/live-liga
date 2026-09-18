import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const PC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

function queueCandidate(map, key, candidate) {
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(candidate)
}

function flushCandidates(map, key, pc) {
  const list = map.get(key) || []
  map.delete(key)
  list.forEach((c) => pc.addIceCandidate(c).catch(() => {}))
}

export default function CameraStream({ match, isCreator }) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [waiting, setWaiting] = useState(!isCreator)
  const [viewers, setViewers] = useState(0)
  const [live, setLive] = useState(false)

  const socketRef = useRef(null)
  const localStreamRef = useRef(null)
  const pcs = useRef(new Map())
  const pending = useRef(new Map())
  const remoteCandidatePending = useRef(new Map())
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)

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
    remoteCandidatePending.current.delete(id)
  }

  const setupBroadcasterPc = (remoteId) => {
    const pc = new RTCPeerConnection(PC_CONFIG)
    pcs.current.set(remoteId, pc)
    localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current))
    pc.onicecandidate = (e) => {
      if (e.candidate) send('ice', { to: remoteId, candidate: e.candidate })
    }
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        closePc(remoteId)
        setViewers((v) => Math.max(0, v - 1))
      }
    }
    return pc
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      })
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        await localVideoRef.current.play().catch(() => {})
      }

      const socket = io()
      socketRef.current = socket
      socket.emit('join', { room, role: 'broadcaster' })

      socket.on('peers', ({ peers }) => {
        setViewers(peers.filter((p) => p.role === 'viewer').length)
        peers.filter((p) => p.role === 'viewer').forEach((p) => connectToViewer(p.id))
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
        else queueCandidate(remoteCandidatePending.current, from, candidate)
      })

      socket.on('peer-left', ({ id }) => {
        closePc(id)
        setViewers((v) => Math.max(0, v - 1))
      })

      setRunning(true)
      setLive(true)
      setError(null)
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

  const connectToViewer = (remoteId) => {
    const pc = setupBroadcasterPc(remoteId)
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        send('offer', { to: remoteId, sdp: pc.localDescription })
        flushCandidates(pending.current, remoteId, pc)
      })
      .catch(() => {})
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        if (pc.remoteDescription) send('ice', { to: remoteId, candidate: e.candidate })
        else queueCandidate(pending.current, remoteId, e.candidate)
      }
    }
  }

  const stopCamera = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    const ids = [...pcs.current.keys()]
    ids.forEach(closePc)
    socketRef.current?.disconnect()
    socketRef.current = null
    localStreamRef.current = null
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    setRunning(false)
    setLive(false)
    setViewers(0)
  }

  // --- Viewer side ---
  useEffect(() => {
    if (isCreator || !match.id) return

    const socket = io()
    socketRef.current = socket
    socket.emit('join', { room, role: 'viewer' })

    let pc = null

    socket.on('offer', ({ from, sdp }) => {
      if (!pc) {
        pc = new RTCPeerConnection(PC_CONFIG)
        pc.ontrack = (e) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = e.streams[0]
            remoteVideoRef.current.play().catch(() => {})
            setWaiting(false)
            setLive(true)
          }
        }
        pc.onicecandidate = (e) => {
          if (e.candidate) send('ice', { to: from, candidate: e.candidate })
        }
        pc.onconnectionstatechange = () => {
          if (pc?.connectionState === 'failed') {
            setError('No pudimos conectar con el organizador. Probá recargar la página.')
          }
        }
      }
      pc.setRemoteDescription(sdp)
        .then(() => {
          flushCandidates(remoteCandidatePending.current, from, pc)
          return pc.createAnswer()
        })
        .then((answer) => pc.setLocalDescription(answer))
        .then(() => send('answer', { to: from, sdp: pc.localDescription }))
        .catch(() => {})
    })

    socket.on('ice', ({ from, candidate }) => {
      if (pc?.remoteDescription) pc.addIceCandidate(candidate).catch(() => {})
      else queueCandidate(remoteCandidatePending.current, from, candidate)
    })

    socket.on('peer-left', ({ id }) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
      setLive(false)
      setWaiting(true)
    })

    return () => {
      socket.disconnect()
      if (pc) {
        try {
          pc.close()
        } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreator, match.id])

  useEffect(() => () => stopCamera(), [])

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
            <button type="button" className="btn-ghost" onClick={stopCamera}>
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
          {live ? (
            <video ref={remoteVideoRef} className="cam-video" playsInline autoPlay controls />
          ) : (
            <div className="cam-placeholder">
              <span className="cam-placeholder-icon">⏳</span>
              <p>{waiting ? 'Esperando que el organizador active la cámara…' : 'Cargando transmisión…'}</p>
              <small>Si no aparece en unos segundos, entrá directo desde un enlace si lo compartieron.</small>
            </div>
          )}
        </div>
      </div>
      {error && <p className="cam-error">{error}</p>}
    </div>
  )
}