import { createServer } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_BODY = 1024 * 1024
const hash = (token) => createHash('sha256').update(token).digest('hex')
const isDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(data))
}

async function readJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'JSON 형식으로 보내 주세요.')
  if (Number(request.headers['content-length']) > MAX_BODY) throw new HttpError(413, '공유할 글은 1MB 이하로 작성해 주세요.')
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY) throw new HttpError(413, '공유할 글은 1MB 이하로 작성해 주세요.')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new HttpError(400, '요청 내용을 읽을 수 없습니다.') }
}

export function createShareServer({ databasePath, staticDir, publicOrigin } = {}) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true })
  const db = new DatabaseSync(databasePath, { timeout: 5000 })
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS shared_posts (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      shared_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0
    ) STRICT;
  `)
  const find = db.prepare('SELECT * FROM shared_posts WHERE id = ?')
  const upsert = db.prepare(`INSERT INTO shared_posts (id, token_hash, title, content, created_at, updated_at, shared_at)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, content = excluded.content, updated_at = excluded.updated_at, shared_at = excluded.shared_at`)
  // Keep a tombstone so a delayed publish request cannot bring a revoked link back.
  const revoke = db.prepare(`INSERT INTO shared_posts (id, token_hash, title, content, created_at, updated_at, shared_at, revoked)
    VALUES (?, ?, '', '', '', '', '', 1) ON CONFLICT(id) DO UPDATE SET title = '', content = '', revoked = 1`)
  const writes = new Map()
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
    try {
      const url = new URL(request.url, 'http://localhost')
      if (url.pathname === '/api/health' && request.method === 'GET') return json(response, 200, { ok: true })
      if (url.pathname.startsWith('/api/')) {
        const match = /^\/api\/shares\/([^/]+)$/.exec(url.pathname)
        if (!match || !UUID.test(match[1])) throw new HttpError(404, '공유된 글을 찾을 수 없습니다.')
        const id = match[1]
        if (request.method === 'GET') {
          const post = find.get(id)
          if (!post || post.revoked) throw new HttpError(404, '삭제되었거나 공유가 중단된 글입니다.')
          return json(response, 200, {
            title: post.title, content: post.content, createdAt: post.created_at,
            updatedAt: post.updated_at, sharedAt: post.shared_at,
          })
        }
        if (!['PUT', 'DELETE'].includes(request.method)) throw new HttpError(405, '지원하지 않는 요청입니다.')
        const origin = request.headers.origin
        if (origin && (publicOrigin ? origin !== publicOrigin : new URL(origin).host !== request.headers.host)) {
          throw new HttpError(403, '다른 사이트에서 보낸 요청은 허용하지 않습니다.')
        }
        const token = request.headers.authorization?.replace(/^Bearer /, '')
        if (!token || !/^[a-zA-Z0-9-]{32,128}$/.test(token)) throw new HttpError(401, '공유 관리 권한이 필요합니다.')
        const now = Date.now()
        const address = request.socket.remoteAddress
        const rate = writes.get(address)
        if (rate && rate.until > now && rate.count >= 120) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.')
        if (!rate || rate.until <= now) {
          for (const [key, value] of writes) if (value.until <= now) writes.delete(key)
          writes.set(address, { count: 1, until: now + 60_000 })
        } else rate.count += 1

        const tokenHash = hash(token)
        const authorize = () => {
          const post = find.get(id)
          if (post && !timingSafeEqual(Buffer.from(post.token_hash), Buffer.from(tokenHash))) {
            throw new HttpError(403, '이 글을 변경할 권한이 없습니다.')
          }
          return post
        }
        authorize()
        if (request.method === 'DELETE') {
          revoke.run(id, tokenHash)
          return json(response, 200, { ok: true })
        }
        const data = await readJson(request)
        if (!data || typeof data.title !== 'string' || typeof data.content !== 'string' ||
          !isDate(data.createdAt) || !isDate(data.updatedAt)) throw new HttpError(400, '제목, 본문, 작성 시각을 확인해 주세요.')
        if (authorize()?.revoked) throw new HttpError(409, '이미 중단된 공유 링크입니다. 공유를 중단한 뒤 새 링크를 만들어 주세요.')
        const sharedAt = new Date().toISOString()
        upsert.run(id, tokenHash, data.title, data.content, data.createdAt, data.updatedAt, sharedAt)
        return json(response, 200, { sharedAt })
      }

      if (!staticDir || !['GET', 'HEAD'].includes(request.method)) throw new HttpError(404, '페이지를 찾을 수 없습니다.')
      const root = resolve(staticDir)
      const pathname = decodeURIComponent(url.pathname)
      const isPage = pathname === '/' || /^\/share\/[a-zA-Z0-9-]+\/?$/.test(pathname)
      const file = isPage ? resolve(root, 'index.html') : resolve(root, `.${pathname}`)
      if (!file.startsWith(root + sep)) throw new HttpError(404, '페이지를 찾을 수 없습니다.')
      let bytes
      try { bytes = await readFile(file) } catch { throw new HttpError(404, '페이지를 찾을 수 없습니다. 먼저 npm run build를 실행해 주세요.') }
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }
      response.writeHead(200, {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Cache-Control': isPage ? 'no-store' : 'public, max-age=3600',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      })
      response.end(request.method === 'HEAD' ? undefined : bytes)
    } catch (error) {
      if (!(error instanceof HttpError)) console.error('Share server request failed:', error.message)
      if (!response.headersSent) json(response, error instanceof HttpError ? error.status : 500,
        { error: error instanceof HttpError ? error.message : '서버에서 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' })
      else response.end()
    }
  })
  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  server.on('close', () => db.close())
  return server
}
