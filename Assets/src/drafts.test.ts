import { describe, expect, it, vi } from 'vitest'
import { createDraft, filterDrafts, folderName, loadDrafts, removeFolder, saveDrafts, STORAGE_KEY } from './drafts'

function memoryStorage(initial: string | null = null) {
  const values = new Map<string, string>()
  if (initial !== null) values.set(STORAGE_KEY, initial)
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
  }
}

describe('개인 기록 임시 저장', () => {
  it('처음 방문하면 글을 임의로 만들지 않는다', () => {
    expect(loadDrafts(memoryStorage())).toEqual({ drafts: [], folders: [], raw: null })
  })

  it('빈 글도 여러 개 만들고 각각 다시 불러올 수 있다', () => {
    const storage = memoryStorage()
    const drafts = [createDraft(), createDraft()]
    expect(drafts[0].id).not.toBe(drafts[1].id)
    saveDrafts(storage, drafts, null)
    expect(loadDrafts(storage).drafts).toHaveLength(2)
    expect(loadDrafts(storage).drafts).toEqual(expect.arrayContaining(drafts))
  })

  it('짧은 글, 줄바꿈, 공백, HTML 기호를 일반 텍스트 그대로 보존한다', () => {
    const storage = memoryStorage()
    const draft = { ...createDraft(), title: '짧은 기록', content: ' 첫 줄\n\n  <b>그대로</b> & 한글 🎮\n' }
    saveDrafts(storage, [draft], null)
    expect(loadDrafts(storage).drafts[0]).toEqual(draft)
  })

  it('하나를 수정해도 다른 글은 유지하고 최근 수정순으로 불러온다', () => {
    const storage = memoryStorage()
    const first = { ...createDraft(), title: '첫 글', updatedAt: '2026-09-01T00:00:00Z' }
    const second = { ...createDraft(), title: '둘째 글', updatedAt: '2026-09-02T00:00:00Z' }
    const raw = saveDrafts(storage, [first, second], null)
    expect(loadDrafts(storage).drafts.map((draft) => draft.title)).toEqual(['둘째 글', '첫 글'])
    const changed = { ...first, content: '이어서 쓴 글', updatedAt: '2026-09-03T00:00:00Z' }
    saveDrafts(storage, [changed, second], raw)
    expect(loadDrafts(storage).drafts).toEqual([changed, second])
  })

  it.each(['{broken', 'null', '{"version":2,"drafts":[]}', '{"version":1,"drafts":[{}]}'])('잘못된 데이터는 덮어쓰지 않는다: %s', (raw) => {
    const storage = memoryStorage(raw)
    expect(() => loadDrafts(storage)).toThrow('기존 데이터는 그대로')
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('중복 ID와 잘못된 날짜를 거부한다', () => {
    const draft = createDraft()
    for (const drafts of [[draft, draft], [{ ...draft, updatedAt: 'invalid' }]]) {
      expect(() => loadDrafts(memoryStorage(JSON.stringify({ version: 1, drafts })))).toThrow()
    }
  })

  it('저장 공간이 가득 차면 실패를 알리고 이전 기록을 보존한다', () => {
    const storage = memoryStorage()
    const first = createDraft()
    const raw = saveDrafts(storage, [first], null)
    storage.setItem.mockImplementationOnce(() => { throw new DOMException('Full', 'QuotaExceededError') })
    expect(() => saveDrafts(storage, [{ ...first, content: '미저장 내용' }], raw)).toThrow('저장 공간이 부족')
    expect(loadDrafts(storage).drafts).toEqual([first])
    expect(() => saveDrafts(storage, [{ ...first, content: '재시도한 내용' }], raw)).not.toThrow()
  })

  it('접근이 차단된 저장소에서 성공으로 보고하지 않는다', () => {
    const storage = memoryStorage()
    storage.getItem.mockImplementation(() => { throw new DOMException('Denied', 'SecurityError') })
    expect(() => loadDrafts(storage)).toThrow()
    expect(() => saveDrafts(storage, [], null)).toThrow('접근할 수 없습니다')
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('다른 탭이 저장한 데이터를 오래된 탭이 덮어쓰지 않는다', () => {
    const storage = memoryStorage()
    const first = createDraft()
    const oldRaw = saveDrafts(storage, [first], null)
    const second = createDraft()
    saveDrafts(storage, [first, second], oldRaw)
    expect(() => saveDrafts(storage, [{ ...first, content: '오래된 탭' }], oldRaw)).toThrow('다른 탭')
    expect(loadDrafts(storage).drafts).toHaveLength(2)
  })

  it('1단계 기록의 제목·본문·ID를 유지하며 미분류로 이전한다', () => {
    const oldDraft = { id: 'old-id', title: '기존 기록', content: '보존할 내용', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }
    const storage = memoryStorage(JSON.stringify({ version: 1, drafts: [oldDraft] }))
    const loaded = loadDrafts(storage)
    expect(loaded.drafts[0]).toMatchObject({ ...oldDraft, folderId: null })
    expect(storage.setItem).not.toHaveBeenCalled()
    saveDrafts(storage, loaded.drafts, loaded.raw, loaded.folders)
    expect(loadDrafts(storage).drafts[0]).toMatchObject(oldDraft)
  })

  it('공유 여부와 관계없이 폴더별로 분류하고 폴더를 삭제해도 글은 보존한다', () => {
    const storage = memoryStorage()
    const folders = [{ id: 'games', name: '게임 기록' }]
    const privateDraft = createDraft('games')
    const sharedDraft = { ...createDraft('games'), share: { id: crypto.randomUUID(), editToken: crypto.randomUUID(), publishedAt: null } }
    const unfiled = createDraft()
    const drafts = [privateDraft, sharedDraft, unfiled]
    saveDrafts(storage, drafts, null, folders)
    expect(loadDrafts(storage).folders).toEqual(folders)
    expect(filterDrafts(drafts, 'games')).toEqual([privateDraft, sharedDraft])
    expect(filterDrafts(drafts, 'unfiled')).toEqual([unfiled])
    const removed = removeFolder(drafts, folders, 'games')
    expect(removed.folders).toEqual([])
    expect(filterDrafts(removed.drafts, 'unfiled')).toHaveLength(3)
    expect(removed.drafts[1].share).toEqual(sharedDraft.share)
  })

  it('빈 폴더 이름, 중복 이름, 너무 긴 이름을 거부한다', () => {
    const folders = [{ id: 'a', name: '일기' }]
    expect(() => folderName(' ', folders)).toThrow('입력')
    expect(() => folderName(' 일기 ', folders)).toThrow('이미')
    expect(() => folderName('a'.repeat(41), folders)).toThrow('40자')
    expect(folderName(' 일기 ', folders, 'a')).toBe('일기')
  })

  it('삭제한 글은 다시 불러와도 없고 다른 글과 폴더는 유지된다', () => {
    const storage = memoryStorage()
    const folders = [{ id: 'a', name: '일기' }]
    const drafts = [createDraft('a'), createDraft()]
    const raw = saveDrafts(storage, drafts, null, folders)
    saveDrafts(storage, [drafts[1]], raw, folders)
    expect(loadDrafts(storage).drafts).toEqual([drafts[1]])
    expect(loadDrafts(storage).folders).toEqual(folders)
  })
})
