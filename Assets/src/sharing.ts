import type { Draft } from './drafts'

export interface SharedPost {
  title: string
  content: string
  createdAt: string
  updatedAt: string
  sharedAt: string
}

async function request(path: string, options?: RequestInit) {
  let response: Response
  try {
    const timeout = AbortSignal.timeout(12_000)
    response = await fetch(path, { ...options, signal: options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout })
  } catch {
    throw new Error('공유 서버에 연결하지 못했습니다. 서버가 켜져 있는지 확인하고 다시 시도해 주세요.')
  }
  let data
  try { data = await response.json() }
  catch { throw new Error('공유 서버가 올바르게 응답하지 않았습니다. 서버 실행 상태를 확인해 주세요.') }
  if (!response.ok) throw new Error(data.error || '공유 요청을 처리하지 못했습니다.')
  return data
}

export function shareUrl(id: string) {
  return new URL(`/share/${id}`, window.location.origin).href
}

export async function publishDraft(draft: Draft) {
  if (!draft.share) throw new Error('공유 정보를 먼저 저장해 주세요.')
  await request(`/api/shares/${draft.share.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${draft.share.editToken}` },
    body: JSON.stringify({ title: draft.title, content: draft.content, createdAt: draft.createdAt, updatedAt: draft.updatedAt }),
  })
}

export async function revokeShare(share: NonNullable<Draft['share']>) {
  await request(`/api/shares/${share.id}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${share.editToken}` },
  })
}

export async function getSharedPost(id: string, signal?: AbortSignal): Promise<SharedPost> {
  return request(`/api/shares/${encodeURIComponent(id)}`, { signal })
}
