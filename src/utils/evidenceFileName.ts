const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function slug(value: string) {
  return value
    .trim()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase('en-US')
}

function extensionOf(file: File) {
  const originalExtension = file.name.split('.').pop()?.trim().toLocaleLowerCase('en-US')
  if (originalExtension && /^[a-z0-9]{1,8}$/.test(originalExtension)) return originalExtension
  return MIME_EXTENSIONS[file.type.toLocaleLowerCase('en-US')] || 'bin'
}

function timestamp() {
  return new Date().toISOString().replace(/\D/g, '').slice(0, 14)
}

/**
 * Creates a descriptive, ASCII-only filename before an evidence file is sent
 * to the API. The backend keeps this name as FileAsset.originalName and also
 * returns it in Content-Disposition when the evidence is downloaded.
 */
export function renameEvidenceFile(file: File, purpose: string, context?: string) {
  if (!purpose.trim()) return file
  const parts = [slug(purpose), context ? slug(context) : '', timestamp()].filter(Boolean)
  const name = `${parts.join('-')}.${extensionOf(file)}`
  return new File([file], name, { type: file.type, lastModified: file.lastModified })
}

