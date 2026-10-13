import { useRef, useState } from 'react'
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
  return <li className="flex flex-wrap items-center justify-between gap-3 py-3">
    <div className="min-w-0 flex-1"><p className="break-words font-medium text-stone-900">{file.name}</p>
      <p className="mt-1 text-xs text-stone-500">{file.kind === 'SIGNED_CONTRACT' ? 'Hợp đồng đã ký' : 'Tài liệu bàn giao'} · {rentalDate(file.uploadedAt)} · {Math.max(1,Math.ceil(file.sizeBytes/1024))} KB</p>
      {Boolean(error) && <p role="alert" className="mt-1 text-sm text-red-700">{rentalError(error)}</p>}
    </div>
    <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
      if(lock.current)return
      lock.current=true;setBusy(true);setError(undefined)
      try {
        const downloaded=await downloadCheckInEvidence(file.id)
        const url=URL.createObjectURL(downloaded.blob)
        const anchor=document.createElement('a');anchor.href=url;anchor.download=downloaded.fileName || file.name
        document.body.appendChild(anchor);anchor.click();anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url),1000)
      } catch(error){setError(error)}
      finally{lock.current=false;setBusy(false)}
    }}>{busy ? 'Đang tải...' : 'Tải xuống'}</Button>
  </li>
}
export default function RentalHandoverFiles({ role,id }: { role: 'customer' | 'manager'; id: string }) {
  const actor=getAuthenticatedActor()
  const identity=`${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${role}:${id}:handover-files`
  const read=useRentalApiResource(identity,() => listRentalHandoverFiles(role,id))
  return <Card className="p-4">
    <h3 className="font-bold">Hợp đồng và tài liệu bàn giao</h3>
    {read.loading && <p role="status" className="mt-3 text-sm text-stone-500">Đang tải tài liệu...</p>}
    {Boolean(read.error) && <p role="status" className="mt-3 text-sm text-stone-500">{rentalError(read.error)}</p>}
    {!read.loading && !read.error && !read.data?.length && <p className="mt-3 text-sm text-stone-500">Chưa có tài liệu bàn giao được ghi nhận.</p>}
    {read.data && <ul className="mt-2 divide-y divide-stone-100">{read.data.map(file => <DocumentRow key={file.id} file={file} />)}</ul>}
  </Card>
}
