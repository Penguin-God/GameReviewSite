import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rmdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createShareServer } from './app.mjs'

const payload = { title: '공유한 기록', content: '<script>그대로 읽는 텍스트</script>\n\n  공백 유지', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z' }

async function start(databasePath = ':memory:') {
  const server = createShareServer({ databasePath })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  return {
    base,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
      server.closeAllConnections()
    }),
    send: (id, method = 'GET', token, body) => fetch(`${base}/api/shares/${id}`, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  }
}

test('다른 독자는 공유한 글만 읽고 관리 토큰은 받지 않는다', async (t) => {
  const api = await start(); t.after(api.close)
  const id = randomUUID(), token = randomUUID()
  assert.equal((await api.send(id, 'PUT', token, payload)).status, 200)
  const response = await api.send(id)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const data = await response.json()
  assert.equal(data.title, payload.title)
  assert.equal(data.content, payload.content)
  assert.deepEqual(Object.keys(data).sort(), ['content', 'createdAt', 'sharedAt', 'title', 'updatedAt'])
  assert.equal((await fetch(`${api.base}/api/shares`)).status, 404)
})

test('링크만 아는 사람은 수정하거나 삭제할 수 없다', async (t) => {
  const api = await start(); t.after(api.close)
  const id = randomUUID(), token = randomUUID()
  await api.send(id, 'PUT', token, payload)
  assert.equal((await api.send(id, 'PUT', undefined, payload)).status, 401)
  assert.equal((await api.send(id, 'PUT', randomUUID(), payload)).status, 403)
  assert.equal((await api.send(id, 'DELETE', randomUUID())).status, 403)
  assert.equal((await api.send(id)).status, 200)
})

test('소유자는 같은 링크를 업데이트하고 반복 요청해도 중복되지 않는다', async (t) => {
  const api = await start(); t.after(api.close)
  const id = randomUUID(), token = randomUUID()
  await api.send(id, 'PUT', token, payload)
  const changed = { ...payload, title: '수정한 제목', content: '수정한 내용' }
  assert.equal((await api.send(id, 'PUT', token, changed)).status, 200)
  assert.equal((await api.send(id, 'PUT', token, changed)).status, 200)
  assert.equal((await (await api.send(id)).json()).content, changed.content)
})

test('공유 중단과 글 삭제 후 링크는 무효이며 늦은 업데이트도 되살리지 못한다', async (t) => {
  const api = await start(); t.after(api.close)
  const id = randomUUID(), token = randomUUID()
  await api.send(id, 'PUT', token, payload)
  assert.equal((await api.send(id, 'DELETE', token)).status, 200)
  assert.equal((await api.send(id)).status, 404)
  assert.equal((await api.send(id, 'DELETE', token)).status, 200)
  assert.equal((await api.send(id, 'PUT', token, payload)).status, 409)
  assert.equal((await api.send(randomUUID(), 'PUT', token, payload)).status, 200)
})

test('응답이 유실된 공유 요청도 먼저 취소하면 나중에 게시되지 않는다', async (t) => {
  const api = await start(); t.after(api.close)
  const id = randomUUID(), token = randomUUID()
  assert.equal((await api.send(id, 'DELETE', token)).status, 200)
  assert.equal((await api.send(id, 'PUT', token, payload)).status, 409)
})

test('잘못된 요청, 다른 사이트의 요청, 1MB 초과 본문을 거부한다', async (t) => {
  const api = await start(); t.after(api.close)
  const id = randomUUID(), token = randomUUID()
  assert.equal((await api.send('not-an-id')).status, 404)
  assert.equal((await api.send(id, 'PUT', token, { title: '본문 없음' })).status, 400)
  assert.equal((await api.send(id, 'PUT', token, { ...payload, content: 'a'.repeat(1024 * 1024) })).status, 413)
  const response = await fetch(`${api.base}/api/shares/${id}`, {
    method: 'PUT', headers: { Origin: 'https://other.example', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  assert.equal(response.status, 403)
  assert.equal((await api.send(id)).status, 404)
})

test('서버를 다시 시작해도 공유 기록은 DB에 남는다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'yeobaek-test-'))
  const databasePath = join(directory, 'shares.sqlite')
  const id = randomUUID(), token = randomUUID()
  let api = await start(databasePath)
  try {
    await api.send(id, 'PUT', token, payload)
    await api.close()
    api = await start(databasePath)
    assert.equal((await (await api.send(id)).json()).content, payload.content)
  } finally {
    await api.close()
    for (const file of [databasePath, databasePath + '-wal', databasePath + '-shm']) {
      await unlink(file).catch((error) => { if (error.code !== 'ENOENT') throw error })
    }
    await rmdir(directory)
  }
})
