export interface PaymentReceiptExport {
  title: string
  reference: string
  status: string
  fields: [string, string][]
  footer: string
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export function paymentReceiptHtml(receipt: PaymentReceiptExport) {
  const rows = receipt.fields.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(receipt.title)}</title><style>body{margin:32px auto;padding:24px;max-width:720px;font:15px/1.6 system-ui,sans-serif;color:#292524}h1{font-size:24px}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:12px 0;border-bottom:1px solid #e7e5e4;overflow-wrap:anywhere}th{width:38%;padding-right:20px;font-weight:500;color:#57534e}footer{margin-top:24px;color:#57534e;font-size:13px}@media print{body{margin:0;max-width:none}}</style></head><body><p><strong>StorageHub</strong></p><h1>${escapeHtml(receipt.title)}</h1><p>${escapeHtml(receipt.status)}</p><table>${rows}</table><footer>${escapeHtml(receipt.footer)}</footer></body></html>`
}

export function downloadPaymentReceipt(receipt: PaymentReceiptExport) {
  const url = URL.createObjectURL(new Blob([paymentReceiptHtml(receipt)], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `bien-lai-${receipt.reference.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'thanh-toan'}.html`
  document.body.appendChild(link)
  try { link.click() } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
}
