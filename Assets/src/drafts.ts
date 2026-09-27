export interface Draft {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export const STORAGE_KEY = 'yeobaek.drafts.v1'
type DraftStorage = Pick<Storage, 'getItem' | 'setItem'>

function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return typeof draft.id === 'string' && draft.id.length > 0 &&
    typeof draft.title === 'string' && typeof draft.content === 'string' &&
    typeof draft.createdAt === 'string' && Number.isFinite(Date.parse(draft.createdAt)) &&
    typeof draft.updatedAt === 'string' && Number.isFinite(Date.parse(draft.updatedAt))
}

export function loadDrafts(storage: DraftStorage): { drafts: Draft[]; raw: string | null } {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return { drafts: [], raw }
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object') throw new Error()
    const collection = data as { version?: unknown; drafts?: unknown }
    if (collection.version !== 1 || !Array.isArray(collection.drafts) || !collection.drafts.every(isDraft)) throw new Error()
    const drafts = collection.drafts
    if (new Set(drafts.map((draft) => draft.id)).size !== drafts.length) throw new Error()
    return { drafts: [...drafts].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), raw }
  } catch {
    throw new Error('저장된 기록의 형식을 읽을 수 없습니다. 기존 데이터는 그대로 보존했어요. 브라우저 데이터를 지우지 말고 확인해 주세요.')
  }
}

export function saveDrafts(storage: DraftStorage, drafts: Draft[], expectedRaw: string | null): string {
  let current: string | null
  try {
    current = storage.getItem(STORAGE_KEY)
  } catch {
    throw new Error('브라우저 저장 공간에 접근할 수 없습니다. 저장 권한을 확인한 뒤 다시 시도해 주세요.')
  }
  if (current !== expectedRaw) {
    throw new Error('다른 탭에서 기록이 변경되었습니다. 현재 내용을 복사해 둔 뒤 새로고침해 주세요. 다른 탭의 기록을 덮어쓰지 않았어요.')
  }
  const raw = JSON.stringify({ version: 1, drafts })
  try {
    storage.setItem(STORAGE_KEY, raw)
  } catch {
    throw new Error('브라우저 저장 공간이 부족하거나 저장이 차단되었습니다. 공간과 저장 권한을 확인한 뒤 다시 시도해 주세요.')
  }
  return raw
}

export function createDraft(): Draft {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), title: '', content: '', createdAt: now, updatedAt: now }
}
