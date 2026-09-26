import { useEffect, useRef } from 'react'
import { ecgById } from '../ecg/atlas'
import { Ecg12 } from '../ecg/Ecg12'
import { toRgba } from './field'
import { imageEntry, imageTitle } from './library'

/** A small button that opens an image: "▣ Chest X-ray, AP supine". */
export function FilmButton({ src, onOpen }: { src: string; onOpen: (src: string) => void }) {
  return (
    <button type="button" className="film-btn" data-testid={`film-${src}`} onClick={() => onOpen(src)}>
      ▣ {imageTitle(src)}
    </button>
  )
}

/** Full-screen viewer for a film, a photo or a 12-lead. */
export function Film({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="io-modal" onClick={onClose} data-testid="film">
      <div className="win film-win" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <b className="win-title">{imageTitle(src).toUpperCase()}</b>
          <button type="button" className="win-close" onClick={onClose}>
            B✕
          </button>
        </div>
        <FilmBody src={src} />
      </div>
    </div>
  )
}

export function FilmBody({ src }: { src: string }) {
  if (src.startsWith('ecg:')) {
    const spec = ecgById(src.slice(4))
    if (!spec) return <p className="menu-note">No ECG named {src}.</p>
    return <Ecg12 spec={spec} />
  }
  return <Picture src={src} />
}

function Picture({ src }: { src: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const entry = imageEntry(src)
  useEffect(() => {
    const cv = canvas.current
    const c = cv?.getContext('2d')
    if (!cv || !c || !entry) return
    const pic = entry.make()
    const w = pic.kind === 'grey' ? pic.field.w : pic.pixels.w
    const h = pic.kind === 'grey' ? pic.field.h : pic.pixels.h
    const data = pic.kind === 'grey' ? toRgba(pic.field, src.startsWith('us:') ? 9 : 7, src.startsWith('us:') ? [1, 1, 1] : undefined) : pic.pixels.d
    cv.width = w
    cv.height = h
    c.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0)
  }, [entry, src])
  if (!entry) return <p className="menu-note">No image named {src}.</p>
  return (
    <div className="film-frame" data-kind={src.split(':')[0]}>
      <canvas ref={canvas} className="film-canvas pixelated" />
      {src.startsWith('xr:') || src.startsWith('ct:') ? <span className="film-marker">R</span> : null}
    </div>
  )
}
