import { useEffect, useRef, useState } from 'react'
import FilePreviewDialog from '../../components/FilePreviewDialog'
import { Button, Card } from '../../components/ui'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { getAuthenticatedActor } from '../../services/authApi'
import { downloadCheckInEvidence } from '../../services/checkInApi'
import { listRentalHandoverFiles, type RentalHandoverFile } from '../../services/rentalHandoverFilesApi'
import { rentalDate, rentalError } from './presentation'

function DocumentRow({ file }: { file: RentalHandoverFile }) {
  const lock = useRef(false)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState<unknown>()
  const [preview,setPreview] = useState<{ url: string; type: string } | null>(null)
  const previewUrl = useRef<string | null>(null)
  const mounted = useRef(true)
  const previewable = ['application/pdf','image/png','image/jpeg','image/webp','image/gif'].includes(file.contentType)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; if(previewUrl.current) URL.revokeObjectURL(previewUrl.current) }
  }, [])
  const closePreview = () => {
    if(previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = null
    setPreview(null)
  }
  const openPreview = async () => {
    if(lock.current)return
    lock.current = true;setBusy(true);setError(undefined)
    try {
      const downloaded = await downloadCheckInEvidence(file.id)
      if(!mounted.current)return
      const type = downloaded.blob.type.toLowerCase().split(';')[0]
      if(!['application/pdf','image/png','image/jpeg','image/webp','image/gif'].includes(type)) {
        setError(new Error('Định dạng này chưa hỗ trợ xem trước. Vui lòng tải xuống để mở.'))
        return
      }
      if(previewUrl.current) URL.revokeObjectURL(previewUrl.current)
      const url = URL.createObjectURL(downloaded.blob)
      previewUrl.current = url
      setPreview({ url,type })
    } catch(error){if(mounted.current)setError(error)}
    finally{lock.current=false;if(mounted.current)setBusy(false)}
  }
  return <li className="flex flex-wrap items-center justify-between gap-3 py-3">
    <div className="min-w-0 flex-1"><p className="break-words font-medium text-stone-900">{file.name}</p>
      <p className="mt-1 text-xs text-stone-500">{file.kind === 'SIGNED_CONTRACT' ? 'Hợp đồng đã ký' : 'Tài liệu bàn giao'} · {rentalDate(file.uploadedAt)} · {Math.max(1,Math.ceil(file.sizeBytes/1024))} KB</p>
      {Boolean(error) && <p role="alert" className="mt-1 text-sm text-red-700">{rentalError(error)}</p>}
    </div>
    <div className="flex shrink-0 gap-2">
    <Button size="sm" variant="outline" disabled={busy || !previewable} title={!previewable ? 'Định dạng này chưa hỗ trợ xem trước' : undefined} onClick={() => preview ? closePreview() : void openPreview()}>{preview ? 'Đóng xem trước' : 'Xem trước'}</Button>
    <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
      if(lock.current)return
      lock.current=true;setBusy(true);setError(undefined)
      try {
        const downloaded=await downloadCheckInEvidence(file.id)
        if(!mounted.current)return
        const url=URL.createObjectURL(downloaded.blob)
        const anchor=document.createElement('a');anchor.href=url;anchor.download=downloaded.fileName || file.name
        document.body.appendChild(anchor);anchor.click();anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url),1000)
      } catch(error){if(mounted.current)setError(error)}
      finally{lock.current=false;if(mounted.current)setBusy(false)}
    }}>{busy ? 'Đang tải...' : 'Tải xuống'}</Button>
    </div>
    {preview && <FilePreviewDialog file={{ ...preview, name: file.name }} onClose={closePreview} />}
  </li>
}
export default function RentalHandoverFiles({ role,id,contractsOnly=false }: { role: 'customer' | 'manager'; id: string; contractsOnly?: boolean }) {
  const actor=getAuthenticatedActor()
  const identity=`${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${role}:${id}:handover-files`
  const read=useRentalApiResource(identity,() => listRentalHandoverFiles(role,id))
  const files=read.data?.filter(file=>!contractsOnly || file.kind==='SIGNED_CONTRACT')
  return <Card className="p-4">
    <h3 className="font-bold">{contractsOnly ? 'Hợp đồng đã ký' : 'Hợp đồng và tài liệu bàn giao'}</h3>
    {read.loading && <p role="status" className="mt-3 text-sm text-stone-500">Đang tải tài liệu...</p>}
    {Boolean(read.error) && <p role="status" className="mt-3 text-sm text-stone-500">{rentalError(read.error)}</p>}
    {!read.loading && !read.error && !files?.length && <p className="mt-3 text-sm text-stone-500">{contractsOnly ? 'Không có dữ liệu' : 'Chưa có hợp đồng hoặc tài liệu từ bàn giao, ký gia hạn đã hoàn tất.'}</p>}
    {files && <ul className="mt-2 divide-y divide-stone-100">{files.map(file => <DocumentRow key={file.id} file={file} />)}</ul>}
  </Card>
}
