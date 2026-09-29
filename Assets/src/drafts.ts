export interface Draft {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  folderId: string | null
  share?: { id: string; editToken: string; publishedAt: string | null }
}

export interface Folder {
  id: string
  name: string
}

export type FolderFilter = 'all' | 'unfiled' | string

export function filterDrafts(drafts: Draft[], filter: FolderFilter) {
  return drafts.filter((draft) => filter === 'all' ||
    (filter === 'unfiled' ? draft.folderId === null : draft.folderId === filter))
}

export function removeFolder(drafts: Draft[], folders: Folder[], folderId: string) {
  return {
    drafts: drafts.map((draft) => draft.folderId === folderId ? { ...draft, folderId: null } : draft),
    folders: folders.filter((folder) => folder.id !== folderId),
  }
}

export function folderName(value: string, folders: Folder[], exceptId?: string) {
  const name = value.trim()
  if (!name) throw new Error('폴더 이름을 입력해 주세요.')
  if (name.length > 40) throw new Error('폴더 이름은 40자까지 입력할 수 있어요.')
  if (folders.some((folder) => folder.id !== exceptId && folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error('같은 이름의 폴더가 이미 있어요.')
  }
  return name
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

export function loadDrafts(storage: DraftStorage): { drafts: Draft[]; folders: Folder[]; raw: string | null } {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return { drafts: [], folders: [], raw }
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object') throw new Error()
    const collection = data as { version?: unknown; drafts?: unknown; folders?: unknown }
    if (![1, 2].includes(collection.version as number) || !Array.isArray(collection.drafts) || !collection.drafts.every(isDraft)) throw new Error()
    const folders: Folder[] = []
    if (collection.version === 2) {
      if (!Array.isArray(collection.folders)) throw new Error()
      for (const value of collection.folders) {
        if (!value || typeof value.id !== 'string' || !value.id || ['all', 'unfiled'].includes(value.id) || typeof value.name !== 'string') throw new Error()
        if (folders.some((folder) => folder.id === value.id)) throw new Error()
        folders.push({ id: value.id, name: folderName(value.name, folders) })
      }
    }
    const drafts = collection.drafts.map((draft) => {
      if (collection.version === 1) return { ...draft, folderId: null, share: undefined }
      if (draft.folderId !== null && !folders.some((folder) => folder.id === draft.folderId)) throw new Error()
      if (draft.share !== undefined) {
        const share = draft.share
        if (!share || typeof share.id !== 'string' || !/^[a-f0-9-]{36}$/.test(share.id) ||
          typeof share.editToken !== 'string' || share.editToken.length < 32 ||
          (share.publishedAt !== null && (typeof share.publishedAt !== 'string' || !Number.isFinite(Date.parse(share.publishedAt))))) throw new Error()
      }
      return draft
    })
    if (new Set(drafts.map((draft) => draft.id)).size !== drafts.length) throw new Error()
    return { drafts: [...drafts].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), folders, raw }
  } catch {
    throw new Error('저장된 기록의 형식을 읽을 수 없습니다. 기존 데이터는 그대로 보존했어요. 브라우저 데이터를 지우지 말고 확인해 주세요.')
  }
}

export function saveDrafts(storage: DraftStorage, drafts: Draft[], expectedRaw: string | null, folders: Folder[] = []): string {
  let current: string | null
  try {
    current = storage.getItem(STORAGE_KEY)
  } catch {
    throw new Error('브라우저 저장 공간에 접근할 수 없습니다. 저장 권한을 확인한 뒤 다시 시도해 주세요.')
  }
  if (current !== expectedRaw) {
    throw new Error('다른 탭에서 기록이 변경되었습니다. 현재 내용을 복사해 둔 뒤 새로고침해 주세요. 다른 탭의 기록을 덮어쓰지 않았어요.')
  }
  const raw = JSON.stringify({ version: 2, drafts, folders })
  try {
    storage.setItem(STORAGE_KEY, raw)
  } catch {
    throw new Error('브라우저 저장 공간이 부족하거나 저장이 차단되었습니다. 공간과 저장 권한을 확인한 뒤 다시 시도해 주세요.')
  }
  return raw
}

export function createDraft(folderId: string | null = null): Draft {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), title: '', content: '', createdAt: now, updatedAt: now, folderId }
}
