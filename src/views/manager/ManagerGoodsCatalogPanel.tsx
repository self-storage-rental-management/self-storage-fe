import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Badge, Button, Card, Modal } from '../../components/ui'
import type { GoodsCatalog, GoodsCatalogCategory, GoodsCatalogMaterial, GoodsCatalogStatus } from '../../services/customerReservationApi'
import { addGoodsCategory, addGoodsMaterial, getManagerGoodsCatalog, reorderGoodsCategories, reorderGoodsMaterials, updateGoodsCategory, updateGoodsMaterial } from '../../services/managerGoodsCatalogApi'
import { managerDisplayError } from './managerPresentation'
import { ApiClientError } from '../../services/apiClient'
import { subscribeGoodsCatalog } from '../../services/goodsCatalogEvents'

const inputClass = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'
const statusText: Record<GoodsCatalogStatus, string> = { ACTIVE: 'Đang dùng', INACTIVE: 'Tạm ẩn', ARCHIVED: 'Ngừng sử dụng' }
const orderError = (reason: unknown) => {
  if (reason instanceof ApiClientError) {
    if (reason.status === 404 || reason.status === 405) return 'Máy chủ đang chạy phiên bản chưa hỗ trợ lưu thứ tự. Cần khởi động lại máy chủ bằng bản cập nhật.'
    if (reason.status === 409) return 'Danh mục vừa thay đổi. Hãy tải lại danh mục rồi sắp xếp lại.'
    if (reason.status === 400 || reason.status === 422) return 'Máy chủ không chấp nhận danh sách thứ tự. Hãy tải lại danh mục rồi thử lại.'
  }
  return managerDisplayError(reason)
}

type Editor =
  | { kind: 'category'; category?: GoodsCatalogCategory; label: string; status: GoodsCatalogStatus }
  | { kind: 'material'; category: GoodsCatalogCategory; material?: GoodsCatalogMaterial; label: string; fragile: boolean; status: GoodsCatalogStatus }

export default function ManagerGoodsCatalogPanel() {
  const [catalog, setCatalog] = useState<GoodsCatalog>()
  const [editor, setEditor] = useState<Editor>()
  const [error, setError] = useState<string>()
  const [feedback, setFeedback] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [archiving, setArchiving] = useState<{ category: GoodsCatalogCategory; material?: GoodsCatalogMaterial }>()
  const [draggingCategoryId, setDraggingCategoryId] = useState<string>()
  const [draggingMaterial, setDraggingMaterial] = useState<{ categoryId: string; materialId: string }>()
  const [floating, setFloating] = useState<{ label: string; number: number; x: number; y: number; width: number; height: number }>()
  const [dropTarget, setDropTarget] = useState<string>()
  const dragCleanup = useRef<() => void>(() => {})
  useEffect(() => () => dragCleanup.current(), [])

  const load = async () => {
    try { setCatalog(await getManagerGoodsCatalog()); setError(undefined) }
    catch (reason) { setError(managerDisplayError(reason)) }
  }
  useEffect(() => {
    void load()
    return subscribeGoodsCatalog(() => void load())
  }, [])

  const startPointerSort = (event: ReactPointerEvent<HTMLButtonElement>, category: GoodsCatalogCategory, material?: GoodsCatalogMaterial) => {
    if (busy || event.button !== 0) return
    event.preventDefault()
    dragCleanup.current()
    const sourceRow = event.currentTarget.closest<HTMLElement>(material ? '[data-material-id]' : '[data-category-id]')
    if (!sourceRow) return
    const bounds = sourceRow.getBoundingClientRect()
    const offsetX = event.clientX - bounds.left
    const offsetY = event.clientY - bounds.top
    const number = material ? category.materials.findIndex(item => item.id === material.id) + 1 : (catalog?.categories.findIndex(item => item.id === category.id) ?? 0) + 1
    setFloating({ label: material?.label || category.label, number, x: bounds.left, y: bounds.top, width: bounds.width, height: Math.min(bounds.height, 88) })
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return
      setFloating(current => current && ({ ...current, x: pointer.clientX - offsetX, y: pointer.clientY - Math.min(offsetY, 40) }))
      const target = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest<HTMLElement>(material ? '[data-material-id]' : 'section[data-category-id]')
      const id = material ? target?.dataset.materialId : target?.dataset.categoryId
      const valid = material ? target?.dataset.categoryId === category.id : !catalog?.categories.find(item => item.id === id)?.custom
      setDropTarget(valid ? id : undefined)
      const scroll = sourceRow.closest<HTMLElement>('[data-layout-scroll-container]')
      if (scroll) {
        const rect = scroll.getBoundingClientRect()
        if (pointer.clientY < rect.top + 70) scroll.scrollBy(0, -18)
        if (pointer.clientY > rect.bottom - 70) scroll.scrollBy(0, 18)
      }
    }
    if (material) setDraggingMaterial({ categoryId: category.id, materialId: material.id })
    else setDraggingCategoryId(category.id)
    const finish = (pointer: PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
      const target = document.elementFromPoint(pointer.clientX, pointer.clientY)
      if (material) {
        const row = target?.closest<HTMLElement>('[data-material-id]')
        if (row?.dataset.categoryId === category.id && row.dataset.materialId) void moveMaterial(category, material.id, row.dataset.materialId)
      } else {
        const row = target?.closest<HTMLElement>('section[data-category-id]')
        if (row?.dataset.categoryId) void moveCategory(category.id, row.dataset.categoryId)
      }
      setDraggingCategoryId(undefined); setDraggingMaterial(undefined)
      setFloating(undefined); setDropTarget(undefined)
    }
    const cancel = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
      setDraggingCategoryId(undefined); setDraggingMaterial(undefined)
      setFloating(undefined); setDropTarget(undefined)
    }
    dragCleanup.current = cancel
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
  }

  const moveCategory = async (sourceId: string, targetId: string) => {
    if (!catalog || sourceId === targetId || busy) return
    const previous = catalog
    const movable = catalog.categories.filter(item => !item.custom)
    const source = movable.findIndex(item => item.id === sourceId)
    const target = movable.findIndex(item => item.id === targetId)
    if (source < 0 || target < 0) return
    const next = [...movable]
    const [moved] = next.splice(source, 1)
    next.splice(target, 0, moved)
    const custom = catalog.categories.filter(item => item.custom)
    const optimistic = { categories: [...next, ...custom] }
    setCatalog(optimistic)
    setBusy(true); setError(undefined)
    try { setCatalog(await reorderGoodsCategories([...next, ...custom].map(item => item.id))) }
    catch (reason) { setCatalog(previous); setError(`Chưa lưu được thứ tự loại hàng. ${orderError(reason)}`) }
    finally { setBusy(false); setDraggingCategoryId(undefined) }
  }

  const moveMaterial = async (category: GoodsCatalogCategory, sourceId: string, targetId: string) => {
    if (!catalog || sourceId === targetId || busy) return
    const previous = catalog
    const source = category.materials.findIndex(item => item.id === sourceId)
    const target = category.materials.findIndex(item => item.id === targetId)
    if (source < 0 || target < 0) return
    const next = [...category.materials]
    const [moved] = next.splice(source, 1)
    next.splice(target, 0, moved)
    setCatalog(current => current && ({ categories: current.categories.map(item => item.id === category.id ? { ...item, materials: next } : item) }))
    setBusy(true); setError(undefined)
    try {
      const saved = await reorderGoodsMaterials(category.id, next.map(item => item.id))
      setCatalog(current => current && ({ categories: current.categories.map(item => item.id === category.id ? saved : item) }))
    } catch (reason) { setCatalog(previous); setError(`Chưa lưu được thứ tự vật liệu. ${orderError(reason)}`) }
    finally { setBusy(false); setDraggingMaterial(undefined) }
  }

  const save = async () => {
    if (!editor || !editor.label.trim()) return
    setBusy(true); setError(undefined)
    try {
      if (editor.kind === 'category') {
        if (editor.category) await updateGoodsCategory(editor.category.id, { label: editor.label.trim(), status: editor.status })
        else await addGoodsCategory({ label: editor.label.trim(), status: editor.status })
      } else if (editor.material) {
        await updateGoodsMaterial(editor.material.id, { label: editor.label.trim(), fragile: editor.fragile, status: editor.status })
      } else {
        await addGoodsMaterial(editor.category.id, { label: editor.label.trim(), fragile: editor.fragile, status: editor.status })
      }
      setEditor(undefined); await load()
      setFeedback('Đã lưu danh mục. Khách hàng được cập nhật khi nhận thay đổi. Mục mới cần được chọn trong phạm vi hàng được nhận của loại kho.')
    } catch (reason) { setError(managerDisplayError(reason)) }
    finally { setBusy(false) }
  }

  const archive = async () => {
    if (!archiving) return
    setBusy(true); setError(undefined)
    try {
      if (archiving.material) await updateGoodsMaterial(archiving.material.id, { label: archiving.material.label, fragile: archiving.material.fragile, status: 'ARCHIVED' })
      else await updateGoodsCategory(archiving.category.id, { label: archiving.category.label, status: 'ARCHIVED' })
      setArchiving(undefined); await load()
      setFeedback('Đã ngừng sử dụng mục này cho khai báo mới. Thông tin đã chốt trong đơn cũ được giữ nguyên.')
    } catch (reason) { setError(managerDisplayError(reason)) }
    finally { setBusy(false) }
  }

  return <Card className="space-y-4 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 className="font-bold text-stone-900">Danh mục hàng hóa và vật liệu chính</h2>
      <p className="mt-1 text-sm text-stone-500">Giữ số thứ tự bên trái để nhấc dòng lên và kéo đến vị trí mới. Loại hàng cần duyệt luôn ở cuối.</p></div>
      <Button className="shrink-0" onClick={() => setEditor({ kind: 'category', label: '', status: 'ACTIVE' })}>Thêm loại hàng</Button>
    </div>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"><p>{error}</p><Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>Tải lại danh mục</Button></div>}
    {busy && <p role="status" className="text-xs text-stone-500">Đang lưu thay đổi…</p>}
    {feedback && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{feedback}</p>}
    {floating && createPortal(<div aria-hidden="true" className="pointer-events-none fixed z-[9999] flex items-center gap-4 rounded-xl border border-amber-400 bg-white px-4 py-4 shadow-[0_18px_50px_-10px_rgba(0,0,0,0.35)] ring-4 ring-amber-100" style={{ left: floating.x, top: floating.y, width: floating.width, minHeight: floating.height, transform: 'rotate(-0.7deg) scale(1.015)' }}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-sm font-bold text-amber-900">{floating.number}</span><div><p className="font-semibold text-stone-900">{floating.label}</p><p className="mt-1 text-xs text-stone-500">Thả vào vị trí được đánh dấu</p></div></div>, document.body)}
    {!catalog ? <p className="text-sm text-stone-500">Đang tải danh mục...</p> : <div className="space-y-2">
      {catalog.categories.map((category, categoryIndex) => {
        const isOpen = expanded.has(category.id) || editor?.category?.id === category.id
        const openEditor = (next: Editor) => { setExpanded(current => new Set(current).add(category.id)); setEditor(next) }
        return <section key={category.id} data-category-id={category.id}
          onDragOver={event => { if (!category.custom && draggingCategoryId) event.preventDefault() }}
          onDrop={event => { event.preventDefault(); if (draggingCategoryId && !category.custom) void moveCategory(draggingCategoryId, category.id) }}
          className={`relative rounded-xl border bg-white transition-[box-shadow,background-color] duration-150 ${draggingCategoryId === category.id ? 'border-dashed border-amber-400 bg-amber-50 opacity-30' : dropTarget === category.id && draggingCategoryId ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200 before:absolute before:-top-1.5 before:left-0 before:right-0 before:h-1 before:rounded-full before:bg-amber-500' : 'border-stone-200 hover:border-stone-300'}`}>
          <div className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 items-center gap-2">
              <button type="button" disabled={busy || category.custom} draggable={false} onPointerDown={event => startPointerSort(event, category)} aria-label={`Kéo để sắp xếp ${category.label}`} title={category.custom ? 'Luôn ở cuối danh sách' : 'Giữ và kéo để đổi vị trí'}
                onDragStart={event => { setDraggingCategoryId(category.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', category.id) }}
                onDragEnd={() => setDraggingCategoryId(undefined)}
                className="grid h-10 w-10 touch-none select-none shrink-0 cursor-grab place-items-center rounded-lg bg-stone-100 text-sm font-semibold tabular-nums text-stone-500 hover:bg-amber-100 hover:text-amber-900 active:cursor-grabbing disabled:cursor-default">
                {categoryIndex + 1}
              </button>
            <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(current => { const next = new Set(current); isOpen ? next.delete(category.id) : next.add(category.id); return next })} className="flex min-w-0 items-center gap-3 text-left">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md bg-stone-100 text-stone-600 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
              <span className="min-w-0"><b className="block truncate">{category.label}</b><span className="mt-0.5 block text-xs text-stone-500">Loại hàng hóa</span></span>
            </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-12 xl:justify-end xl:pl-0">
              <Badge variant={category.status === 'ACTIVE' ? 'success' : 'muted'}>{statusText[category.status]}</Badge>
              <span className="mr-2 text-xs text-stone-500">{category.materials.length} vật liệu</span>
              <Button size="sm" variant="outline" onClick={() => openEditor({ kind: 'category', category, label: category.label, status: category.status })}>Chỉnh sửa</Button>
              <Button size="sm" disabled={category.custom} className={category.custom ? 'invisible pointer-events-none' : ''} aria-hidden={category.custom || undefined} tabIndex={category.custom ? -1 : undefined} onClick={() => openEditor({ kind: 'material', category, label: '', fragile: false, status: 'ACTIVE' })}>Thêm vật liệu</Button>
            </div>
          </div>
          {isOpen && <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-3 sm:pl-12">
            {category.custom ? <p className="border-l-2 border-stone-300 py-2 pl-5 text-sm text-stone-500">Khách sẽ tự nhập tên hàng và vật liệu, hồ sơ cần được duyệt.</p> : category.materials.length === 0 ? <p className="border-l-2 border-stone-300 py-2 pl-5 text-sm text-stone-500">Chưa có vật liệu chính.</p> : <div className="border-l-2 border-stone-300 pl-5">
              {category.materials.map((material, materialIndex) => <div key={material.id} data-material-id={material.id} data-category-id={category.id}
                onDragOver={event => { if (draggingMaterial?.categoryId === category.id) event.preventDefault() }}
                onDrop={event => { event.preventDefault(); if (draggingMaterial?.categoryId === category.id) void moveMaterial(category, draggingMaterial.materialId, material.id) }}
                className={`relative flex flex-col gap-2 border-b border-stone-200 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between before:absolute before:-left-5 before:top-6 before:h-px before:w-4 before:bg-stone-300 ${draggingMaterial?.materialId === material.id ? 'rounded-lg border-dashed border-amber-400 bg-amber-50 opacity-30' : dropTarget === material.id && draggingMaterial ? 'rounded-lg bg-amber-50 ring-2 ring-amber-300' : ''}`}>
                <div className="flex items-center gap-2"><button type="button" draggable={false} onPointerDown={event => startPointerSort(event, category, material)} aria-label={`Kéo để sắp xếp ${material.label}`} title="Giữ và kéo để đổi vị trí" onDragStart={event => { setDraggingMaterial({ categoryId: category.id, materialId: material.id }); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', material.id) }} onDragEnd={() => setDraggingMaterial(undefined)} className="grid h-10 w-9 touch-none select-none shrink-0 cursor-grab place-items-center rounded text-stone-400 hover:bg-stone-200 hover:text-stone-700 active:cursor-grabbing"><span className="text-xs font-semibold tabular-nums">{materialIndex + 1}</span></button><div><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{material.label}</b>{material.fragile && <Badge variant="warning">Dễ vỡ</Badge>}<Badge variant={material.status === 'ACTIVE' ? 'success' : 'muted'}>{statusText[material.status]}</Badge></div><span className="mt-1 block text-xs text-stone-500">Vật liệu chính</span></div></div>
                <Button size="sm" variant="outline" onClick={() => openEditor({ kind: 'material', category, material, label: material.label, fragile: material.fragile, status: material.status })}>Chỉnh sửa</Button>
              </div>)}
            </div>}
          </div>}
        </section>
      })}
    </div>}
    <Modal open={Boolean(editor)} onClose={() => { if (!busy) setEditor(undefined) }} title={editor?.kind === 'category' ? (editor.category ? 'Chỉnh sửa loại hàng' : 'Thêm loại hàng') : editor?.material ? 'Chỉnh sửa vật liệu chính' : 'Thêm vật liệu chính'}>
    {editor && <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Tên hiển thị<input className={`${inputClass} mt-1`} value={editor.label} onChange={event => setEditor({ ...editor, label: event.target.value })} /></label>
        <label className="text-sm">Trạng thái<select className={`${inputClass} mt-1`} value={editor.status} onChange={event => setEditor({ ...editor, status: event.target.value as GoodsCatalogStatus })}><option value="ACTIVE">Đang dùng</option><option value="INACTIVE">Tạm ẩn</option>{editor.status === 'ARCHIVED' && <option value="ARCHIVED">Ngừng sử dụng</option>}</select><span className="mt-1 block text-xs leading-5 text-stone-500">{editor.status === 'ACTIVE' ? 'Hiển thị cho khách hàng khi khai báo.' : editor.status === 'INACTIVE' ? 'Tạm thời ẩn khỏi khách hàng và có thể bật lại bất cứ lúc nào.' : 'Không dùng cho khai báo mới, dữ liệu lịch sử vẫn được giữ.'}</span></label>
        {editor.kind === 'material' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editor.fragile} onChange={event => setEditor({ ...editor, fragile: event.target.checked })} /> Vật liệu dễ vỡ</label>}
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>{(((editor.kind === 'category' && editor.category) || (editor.kind === 'material' && editor.material)) && editor.status !== 'ARCHIVED') && <Button variant="outline" disabled={busy} className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => { if (editor.kind === 'category' && editor.category) setArchiving({ category: editor.category }); else if (editor.kind === 'material' && editor.material) setArchiving({ category: editor.category, material: editor.material }); setEditor(undefined) }}>Ngừng sử dụng mục này</Button>}</div>
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setEditor(undefined)}>Hủy</Button><Button disabled={busy || !editor.label.trim()} onClick={save}>{busy ? 'Đang lưu...' : 'Lưu thay đổi'}</Button></div>
      </div>
    </div>}
    </Modal>
    <Modal open={Boolean(archiving)} onClose={() => { if (!busy) setArchiving(undefined) }} title="Xác nhận ngừng sử dụng">
      {archiving && <div className="space-y-4"><p>Ngừng sử dụng <b>{archiving.material?.label || archiving.category.label}</b>? Mục này sẽ không còn xuất hiện khi khách hàng khai báo hàng hóa, nhưng dữ liệu cũ vẫn được giữ nguyên.</p><div className="flex justify-end gap-2 border-t border-stone-200 pt-4"><Button variant="outline" disabled={busy} onClick={() => setArchiving(undefined)}>Hủy</Button><Button disabled={busy} onClick={archive}>{busy ? 'Đang lưu...' : 'Xác nhận ngừng sử dụng'}</Button></div></div>}
    </Modal>
  </Card>
}
