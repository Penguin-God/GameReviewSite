import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createShareServer } from './app.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const server = createShareServer({
  databasePath: process.env.DATABASE_PATH || resolve(root, 'data/shared-posts.sqlite'),
  staticDir: resolve(root, 'dist'),
  publicOrigin: process.env.PUBLIC_ORIGIN,
})
const port = Number(process.env.PORT || 8787)
const host = process.env.HOST || '127.0.0.1'
server.on('error', (error) => { console.error(error.message); process.exit(1) })
server.listen(port, host, () => console.log(`여백 서버: http://${host}:${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { server.close(); server.closeAllConnections() })
}
