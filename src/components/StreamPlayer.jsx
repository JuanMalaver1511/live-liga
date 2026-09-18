import { useMemo } from 'react'

export function extractIframeSrc(embedCode) {
  if (!embedCode) return null
  const m = embedCode.match(/<iframe[^>]+src=["']([^"']+)["']/i)
  return m ? m[1] : null
}

export function parseStreamUrl(url) {
  if (!url) return { type: 'none' }
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()

    if (host.includes('facebook.com') || host === 'fb.watch') {
      const href = encodeURIComponent(u.href.replace(/\/$/, ''))
      return { type: 'facebook', src: `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&autoplay=1&t=0` }
    }

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      const v = u.searchParams.get('v') || (host.includes('youtu.be') ? u.pathname.slice(1) : '')
      if (v) return { type: 'youtube', src: `https://www.youtube.com/embed/${v}?autoplay=1&mute=1` }
      return { type: 'link' }
    }

    if (host.includes('youtube-nocookie.com')) {
      return { type: 'youtube', src: u.href + (u.href.includes('?') ? '&' : '?') + 'autoplay=1&mute=1' }
    }

    if (host.includes('twitch.tv')) {
      const chan = u.pathname.split('/').filter(Boolean)[0]
      if (chan)
        return {
          type: 'twitch',
          src: `https://player.twitch.tv/?channel=${chan}&parent=${window.location.hostname}&autoplay=true`,
        }
      return { type: 'link' }
    }

    if (host.includes('tiktok.com')) {
      const segs = u.pathname.split('/').filter(Boolean)
      const id = segs.find((s) => /^\d+$/.test(s) && s.length >= 8) || u.searchParams.get('videoId')
      if (id) return { type: 'tiktok', src: `https://www.tiktok.com/player/v1/${id}?autoplay=1` }
      const live = u.pathname.match(/^\/@?([^/]+)\/live/)
      if (live) {
        const embedDomain = window.location.hostname
        return {
          type: 'tiktok-live',
          openUrl: u.href,
          src: `https://www.tiktok.com/embed/live/${encodeURIComponent(live[1])}?autoplay=1&muted=1&controls=1&embed_domain=${embedDomain}`,
        }
      }
      return { type: 'link' }
    }

    return { type: 'unknown', src: u.href }
  } catch {
    return { type: 'link' }
  }
}

function EmbedFrame({ src, title }) {
  const host = useMemo(() => {
    try {
      return new URL(src).hostname
    } catch {
      return ''
    }
  }, [src])

  return (
    <div className="stream-frame-wrap">
      <iframe
        className="stream-frame"
        src={src}
        title={title || 'Transmisión en vivo'}
        allowFullScreen
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture; web-share"
      />
      <a className="stream-fallback" href={src} target="_blank" rel="noreferrer">
        Si el video no carga, abrirlo en {host} →<br />
        <small>Copiá a tus espectadores el enlace original desde “Editar”.</small>
      </a>
    </div>
  )
}

export default function StreamPlayer({ url, embedCode, title }) {
  const stream = useMemo(() => {
    const fromCode = extractIframeSrc(embedCode)
    if (fromCode) return { type: 'embed', src: fromCode }
    return parseStreamUrl(url)
  }, [url, embedCode])

  if (stream.type === 'none') {
    return (
      <div className="stream-empty">
        <span className="stream-empty-icon">▶</span>
        <p>Esta transmisión todavía no tiene un enlace de video.</p>
        <small>El organizador puede agregarlo desde el botón “Editar”.</small>
      </div>
    )
  }

  if (stream.type === 'link') {
    return (
      <a className="stream-link" href={url} target="_blank" rel="noreferrer">
        <span className="stream-link-badge">EN VIVO</span>
        <span className="stream-link-title">{title || 'Abrir transmisión'}</span>
        <span className="stream-link-open">Abrir →</span>
      </a>
    )
  }

  if (stream.type === 'tiktok-live') {
    return (
      <div className="stream-frame-wrap">
        <iframe
          className="stream-frame"
          src={stream.src}
          title="Transmisión en vivo de TikTok"
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; web-share"
        />
        <div className="stream-fallback">
          <strong>Vista previa oficial de TikTok (iframe).</strong> Para que reproduzca en tu dominio,
          TikTok pide registrarlo: entrar a <a href="https://developers.tiktok.com/docs/apply" target="_blank" rel="noreferrer">developers.tiktok.com/docs/apply</a> y solicitar acceso a "Embed LIVE". Mientras tanto podés verlo en
          <a href={stream.openUrl} target="_blank" rel="noreferrer"> TikTok →</a>
        </div>
      </div>
    )
  }

  return <EmbedFrame src={stream.src} title={title} />
}