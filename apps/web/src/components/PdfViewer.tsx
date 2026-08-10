import { useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Point to the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface Props {
  url: string
}

export default function PdfViewer({ url }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    async function render() {
      if (!canvasRef.current) return
      try {
        const pdf = await pdfjsLib.getDocument(url).promise
        if (cancelled) return
        const page = await pdf.getPage(1)
        if (cancelled) return
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = canvasRef.current!
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({
          canvasContext: canvas.getContext('2d')!,
          viewport,
        }).promise
      } catch {
        // If it's not a PDF (e.g. an image), fall back gracefully
      }
    }
    render()
    return () => { cancelled = true }
  }, [url])

  // Check if it looks like an image URL
  const isImage = /\.(jpe?g|png|webp)(\?|$)/i.test(url)

  if (isImage) {
    return (
      <img src={url} alt="Vaccine certificate" className="w-full rounded-lg" />
    )
  }

  return (
    <div className="overflow-auto rounded-lg bg-gray-900">
      <canvas ref={canvasRef} className="max-w-full" />
    </div>
  )
}
