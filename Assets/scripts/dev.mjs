import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const apiPort = process.env.API_PORT || '8787'
const api = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, PORT: apiPort, HOST: '127.0.0.1' },
})
let vite
let stopping = false
async function stop(code = 0) {
  if (stopping) return
  stopping = true
  api.kill()
  if (vite) await vite.close()
  process.exitCode = code
}
api.on('error', (error) => { console.error(error.message); void stop(1) })
api.on('exit', (code) => { if (!stopping) void stop(code || 1) })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void stop() })

try {
  const args = process.argv.slice(2)
  const value = (flag, fallback) => {
    const index = args.indexOf(flag)
    return index === -1 ? fallback : args[index + 1] || fallback
  }
  vite = await createServer({
    root,
    server: { host: value('--host', '127.0.0.1'), port: Number(value('--port', '5173')), strictPort: true },
  })
  if (stopping) await vite.close()
  else { await vite.listen(); vite.printUrls() }
} catch (error) {
  console.error(error.message)
  await stop(1)
}
