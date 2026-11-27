import { useEffect, useState } from 'react'
import { Button, Modal } from '../../components/ui'

/** Renders thumbnail previews, zoom modal, and per-file removal for selected goods images. */
export default function GoodsImagePreviewGrid({
  files,
  onRemove,
}: {
  files: File[]
  onRemove: (index: number) => void
}) {
  const [previews, setPreviews] = useState<Array<{ file: File; url: string }>>([])
  const [active, setActive] = useState<{ name: string; url: string } | null>(null)

  useEffect(() => {
    const entries = files.map((file) => ({ file, url: URL.createObjectURL(file) }))
    setPreviews(entries)
    return () => {
      entries.forEach((entry) => URL.revokeObjectURL(entry.url))
    }
  }, [files])

  if (files.length === 0) return null

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-stone-500">
        Đã chọn {files.length}/10 ảnh (bấm vào ảnh để xem phóng to):
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {previews.map((entry, idx) => (
          <div
            key={`${entry.file.name}-${entry.file.size}-${idx}`}
            className="group relative overflow-hidden rounded-lg border border-stone-200 bg-white"
          >
            <button
              type="button"
              onClick={() => setActive({ name: entry.file.name, url: entry.url })}
              className="block w-full text-left focus:outline-none"
              title={`Xem ảnh ${entry.file.name}`}
            >
              <img
                src={entry.url}
                alt={entry.file.name}
                className="h-20 w-full object-cover transition group-hover:opacity-90"
              />
              <div className="px-2 py-1">
                <p className="truncate text-xs font-medium text-stone-800">{entry.file.name}</p>
                <p className="text-[11px] text-stone-500">{(entry.file.size / 1024).toFixed(1)} KB</p>
              </div>
            </button>
            <button
              type="button"
              aria-label={`Xóa ảnh ${entry.file.name}`}
              title="Xóa ảnh này"
              onClick={() => onRemove(idx)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-stone-900/75 text-xs font-bold text-white hover:bg-red-600"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <Modal
        size="xl"
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.name || 'Xem trước hình ảnh hàng hóa'}
      >
        {active && (
          <div className="space-y-4">
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg bg-stone-950/5 p-2">
              <img
                src={active.url}
                alt={active.name}
                className="max-h-[65vh] w-auto max-w-full rounded object-contain shadow"
              />
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => setActive(null)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
