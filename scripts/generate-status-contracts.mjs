import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backend = resolve(process.env.STORAGEHUB_BE_ROOT || resolve(root, '../self-storage-be'))
const domain = 'src/main/java/com/storagehub/domain/model'
const readModels = 'src/main/java/com/storagehub/api/StatusContract.java'
const definitions = [
  ...['PaymentStatus', 'ReservationStatus', 'RentalStatus', 'RenewalStatus', 'CheckInStatus'].map(name => [name, `${domain}/${name}.java`]),
  ...['InvoiceStatus', 'InvoiceRefundStatus', 'PaymentTransactionStatus', 'RenewalWorkflowStatus'].map(name => [name, readModels]),
]
const sections = definitions.map(([name, path]) => {
  const source = readFileSync(resolve(backend, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  const body = source.match(new RegExp(`enum\\s+${name}\\s*\\{([^}]+)\\}`))?.[1]
  if (!body || !/^[\s\w,]+$/.test(body)) throw new Error(`Unsupported enum: ${name}`)
  const values = body.split(',').map(value => value.trim()).filter(Boolean)
  const constant = `${name[0].toLowerCase()}${name.slice(1)}Values`
  return `// Backend: ${path}\nexport const ${constant} = ${JSON.stringify(values)} as const\nexport type ${name} = (typeof ${constant})[number]\nexport const is${name} = (value: unknown): value is ${name} => typeof value === 'string' && (${constant} as readonly string[]).includes(value)\n`
})
const output = '// Generated from backend enums. Run npm run statuses:generate; do not edit manually.\n\n' + sections.join('\n')
const target = resolve(root, 'src/types/statusContracts.ts')
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== output) throw new Error('FE status contract differs from backend. Run npm run statuses:generate.')
  console.log('FE status contracts match all 9 backend enums.')
} else {
  writeFileSync(target, output)
  console.log('Generated FE status contracts from 9 backend enums.')
}
