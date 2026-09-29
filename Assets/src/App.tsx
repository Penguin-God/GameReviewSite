import { useCallback, useEffect, useRef, useState } from 'react'
import { createDraft, filterDrafts, folderName, loadDrafts, removeFolder, saveDrafts } from './drafts'
import type { Draft, Folder } from './drafts'
import { publishDraft, revokeShare, shareUrl } from './sharing'
import Dialog from './components/Dialog'
import FolderDialog from './components/FolderDialog'
import './App.css'

function dateLabel(value: string, detailed = false) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long', day: 'numeric',
    ...(detailed ? { hour: '2-digit', minute: '2-digit' } as const : {}),
  }).format(new Date(value))
}

interface JournalState {
  drafts: Draft[]
  folders: Folder[]
  raw: string | null
  activeId: string | null
  ready: boolean
  dirty: boolean
  error: string
}

type Confirmation = { kind: 'draft' | 'folder' | 'unshare'; id: string }

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

function initialState(): JournalState {
  try {
    const loaded = loadDrafts(window.localStorage)
    return { ...loaded, activeId: loaded.drafts[0]?.id ?? null, ready: true, dirty: false, error: '' }
  } catch (error) {
    return { drafts: [], folders: [], raw: null, activeId: null, ready: false, dirty: false, error: errorMessage(error) }
  }
}

export default function App() {
  const [state, setState] = useState(initialState)
  const stateRef = useRef(state)
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('all')
  const [folderEditor, setFolderEditor] = useState<Folder | null | undefined>()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const titleInput = useRef<HTMLInputElement>(null)
  const active = state.drafts.find((draft) => draft.id === state.activeId)
  const sharing = state.drafts.find((draft) => draft.id === sharingId)
  const visibleDrafts = filterDrafts(state.drafts, filter)
  const selectedFolder = state.folders.find((folder) => folder.id === filter)
  const filterLabel = filter === 'all' ? '모든 글' : filter === 'unfiled' ? '미분류' : selectedFolder?.name || '모든 글'

  const commit = useCallback((next: JournalState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const persist = useCallback((
    drafts: Draft[], activeId: string | null,
    folders = stateRef.current.folders, atomic = false,
  ) => {
    const previous = stateRef.current
    try {
      const raw = saveDrafts(window.localStorage, drafts, previous.raw, folders)
      commit({ drafts, folders, activeId, raw, ready: true, dirty: false, error: '' })
      return true
    } catch (error) {
      commit(atomic
        ? { ...previous, error: errorMessage(error) }
        : { ...previous, drafts, folders, activeId, dirty: true, error: errorMessage(error) })
      return false
    }
  }, [commit])

  const save = useCallback(() => {
    const current = stateRef.current
    if (!busy && current.ready && persist(current.drafts, current.activeId)) setNotice('임시 저장했습니다.')
  }, [persist, busy])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [save])

  useEffect(() => {
    if (!state.dirty && !busy) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [state.dirty, busy])

  function newDraft() {
    const draft = createDraft(selectedFolder?.id ?? null)
    setNotice('')
    persist([draft, ...stateRef.current.drafts], draft.id)
    requestAnimationFrame(() => titleInput.current?.focus())
  }

  function edit(field: 'title' | 'content', value: string) {
    if (!active) return
    setNotice('')
    const updated = { ...active, [field]: value, updatedAt: new Date().toISOString() }
    persist([updated, ...stateRef.current.drafts.filter((draft) => draft.id !== active.id)], active.id)
  }

  function selectFilter(next: string) {
    setFilter(next)
    const current = stateRef.current
    const drafts = filterDrafts(current.drafts, next)
    commit({ ...current, activeId: drafts.find((draft) => draft.id === current.activeId)?.id ?? drafts[0]?.id ?? null })
    setNotice('')
  }

  function moveDraft(folderId: string) {
    if (!active) return
    const nextFolder = folderId || null
    const saved = persist(state.drafts.map((draft) => draft.id === active.id ? { ...draft, folderId: nextFolder } : draft), active.id)
    if (filter !== 'all') setFilter(nextFolder ?? 'unfiled')
    setNotice(saved ? '폴더를 변경했습니다.' : '')
  }

  function saveFolder(value: string): string | null {
    try {
      const name = folderName(value, state.folders, folderEditor?.id)
      const folder = { id: folderEditor?.id ?? crypto.randomUUID(), name }
      const folders = folderEditor
        ? state.folders.map((item) => item.id === folder.id ? folder : item)
        : [...state.folders, folder]
      if (!persist(state.drafts, state.activeId, folders, true)) return stateRef.current.error
      if (!folderEditor) selectFilter(folder.id)
      return null
    } catch (error) { return errorMessage(error) }
  }

  function ask(confirmation: Confirmation) {
    setActionError('')
    setConfirmation(confirmation)
  }

  async function confirmAction() {
    if (!confirmation || busy) return
    setActionError('')
    setBusy(true)
    try {
      const current = stateRef.current
      // Verify that another tab has not changed ownership data before revoking anything.
      if (!persist(current.drafts, current.activeId)) throw new Error(stateRef.current.error)
      if (confirmation.kind === 'folder') {
        const next = removeFolder(current.drafts, current.folders, confirmation.id)
        if (!persist(next.drafts, current.activeId, next.folders, true)) throw new Error(stateRef.current.error)
        if (filter === confirmation.id) selectFilter('unfiled')
        setNotice('폴더를 삭제했습니다. 글은 미분류에 보관했어요.')
      } else {
        const target = current.drafts.find((draft) => draft.id === confirmation.id)
        if (!target) throw new Error('글을 찾을 수 없습니다.')
        if (target.share) {
          await revokeShare(target.share)
          const latest = stateRef.current
          const drafts = latest.drafts.map((draft) => draft.id === target.id ? { ...draft, share: undefined } : draft)
          if (!persist(drafts, latest.activeId)) throw new Error('공유는 중단됐지만 브라우저 저장에 실패했어요. 저장을 다시 시도해 주세요.')
        }
        if (confirmation.kind === 'draft') {
          const latest = stateRef.current
          const drafts = latest.drafts.filter((draft) => draft.id !== target.id)
          const activeId = latest.activeId === target.id ? filterDrafts(drafts, filter)[0]?.id ?? null : latest.activeId
          if (!persist(drafts, activeId, latest.folders, true)) throw new Error(stateRef.current.error)
          setNotice('글을 삭제했습니다.')
        } else setNotice('공유를 중단했습니다.')
        setSharingId(null)
      }
      setConfirmation(null)
    } catch (error) { setActionError(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function publish() {
    if (!sharing || busy) return
    setActionError('')
    setBusy(true)
    try {
      const current = stateRef.current
      const draft = {
        ...sharing,
        share: sharing.share ?? { id: crypto.randomUUID(), editToken: crypto.randomUUID() + crypto.randomUUID(), publishedAt: null },
      }
      // Save the management secret before publishing so a lost response is recoverable.
      if (!persist(current.drafts.map((item) => item.id === draft.id ? draft : item), current.activeId)) {
        throw new Error('브라우저에 공유 관리 정보를 저장하지 못했어요. 저장 오류를 해결한 뒤 다시 시도해 주세요.')
      }
      await publishDraft(draft)
      const latest = stateRef.current
      const published = latest.drafts.map((item) => item.id === draft.id
        ? { ...item, share: { ...draft.share, publishedAt: draft.updatedAt } } : item)
      if (!persist(published, latest.activeId)) throw new Error('공유는 완료됐지만 브라우저 저장에 실패했어요. 페이지를 닫기 전에 저장을 다시 시도해 주세요.')
      setNotice('공유 내용을 저장했습니다.')
    } catch (error) { setActionError(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function copyLink() {
    if (!sharing?.share) return
    try {
      await navigator.clipboard.writeText(shareUrl(sharing.share.id))
      setActionError('')
      setNotice('링크를 복사했습니다.')
    } catch {
      setActionError('자동 복사가 지원되지 않습니다. 아래 링크를 선택해 직접 복사해 주세요.')
    }
  }

  const confirmTitle = confirmation?.kind === 'folder' ? '폴더를 삭제할까요?'
    : confirmation?.kind === 'unshare' ? '공유를 중단할까요?' : '이 글을 삭제할까요?'
  const confirmName = confirmation?.kind === 'folder'
    ? state.folders.find((folder) => folder.id === confirmation.id)?.name
    : state.drafts.find((draft) => draft.id === confirmation?.id)?.title || '제목 없는 글'

  return (
    <div className="journal">
      <aside className="sidebar" aria-label="내 기록">
        <a className="brand" href="/" aria-label="여백 홈"><span className="brand-symbol" aria-hidden="true">여</span>여백<span className="brand-caption">나의 기록 공간</span></a>
        <div className="sidebar-intro"><span className="eyebrow">MY JOURNAL</span><h1>쓰고 싶은 순간에,<br />나만의 속도로.</h1><p>아직 다 쓰지 않아도 괜찮아요.</p></div>
        <button className="new-button" onClick={newDraft} disabled={!state.ready || busy}><span aria-hidden="true">＋</span> 새 글 쓰기</button>

        <nav className="folder-list" aria-label="폴더">
          <div className="folder-heading"><h2>내 폴더</h2><button disabled={!state.ready || busy} onClick={() => setFolderEditor(null)} aria-label="새 폴더 만들기">＋</button></div>
          <button disabled={busy} className={filter === 'all' ? 'folder-filter current' : 'folder-filter'} aria-pressed={filter === 'all'} onClick={() => selectFilter('all')}>모든 글 <span>{state.drafts.length}</span></button>
          <button disabled={busy} className={filter === 'unfiled' ? 'folder-filter current' : 'folder-filter'} aria-pressed={filter === 'unfiled'} onClick={() => selectFilter('unfiled')}>미분류 <span>{filterDrafts(state.drafts, 'unfiled').length}</span></button>
          <div className="custom-folders">
            {state.folders.map((folder) => <div className="folder-row" key={folder.id}>
              <button disabled={busy} className={filter === folder.id ? 'folder-filter current' : 'folder-filter'} aria-pressed={filter === folder.id} onClick={() => selectFilter(folder.id)}>
                <span className="folder-name">{folder.name}</span><span>{filterDrafts(state.drafts, folder.id).length}</span>
              </button>
              <button disabled={busy} className="folder-edit" aria-label={folder.name + ' 폴더 이름 바꾸기'} title="이름 바꾸기" onClick={() => setFolderEditor(folder)}>✎</button>
              <button disabled={busy} className="folder-edit" aria-label={folder.name + ' 폴더 삭제'} title="폴더 삭제" onClick={() => ask({ kind: 'folder', id: folder.id })}>×</button>
            </div>)}
          </div>
        </nav>
        <div className="list-heading"><h2>{filterLabel} <span>{visibleDrafts.length}</span></h2><span>최근 수정순</span></div>
        <nav className="draft-list" aria-label="작성 중인 글 목록">
          {visibleDrafts.map((draft) => (
            <button key={draft.id} disabled={busy} className={'draft-item ' + (draft.id === state.activeId ? 'selected' : '')}
              aria-current={draft.id === state.activeId ? 'true' : undefined}
              onClick={() => { commit({ ...stateRef.current, activeId: draft.id }); setNotice('') }}>
              <span className="draft-title">{draft.title.trim() || '제목 없는 글'}</span>
              <span className="draft-preview">{draft.content.trim() || '아직 비어 있는 페이지'}</span>
              <span className="draft-meta">{dateLabel(draft.updatedAt)}<span>{draft.share?.publishedAt ? '공유됨' : '나만의 글'}</span></span>
            </button>
          ))}
          {state.ready && visibleDrafts.length === 0 && <p className="empty-list">{state.drafts.length === 0 ? '첫 번째 기록을 기다리고 있어요.' : '이 폴더에는 아직 글이 없어요.'}<br />새 글을 쓰거나 다른 글을 옮겨 보세요.</p>}
        </nav>
        <div className="storage-note"><span className="small-dot" aria-hidden="true" /><div>개인 기록은 이 브라우저에 저장돼요.<p>공유한 글만 서버에 보관해요.<br />브라우저 데이터를 지우면 개인 기록이 사라져요.</p></div></div>
      </aside>

      <main className="workspace" aria-busy={busy}>
        <header className="workspace-header"><span>나의 기록 <span className="breadcrumb" aria-hidden="true">/</span> <strong>{filterLabel}</strong></span><span className="private-label"><span aria-hidden="true">◌</span> 나만의 공간</span></header>
        {state.error && <div className="error-banner" role="alert"><div><strong>{state.ready ? '변경사항을 저장하지 못했어요.' : '저장된 글을 불러오지 못했어요.'}</strong><p>{state.error}</p>{state.dirty && <p>현재 내용을 복사해 둔 뒤 저장을 다시 시도해 주세요.</p>}</div><button disabled={busy} onClick={() => state.ready ? save() : commit(initialState())}>{state.ready ? '저장 다시 시도' : '불러오기 재시도'}</button></div>}
        {active ? (
          <section className="editor" aria-label="글 편집기">
            <div className="editor-toolbar">
              <span className="draft-badge">{active.share?.publishedAt ? '공유된 글' : '나만의 글'}</span>
              <div className="save-controls">
                <span role="status" className={state.dirty ? 'save-status unsaved' : 'save-status'}>{state.dirty ? '저장 필요' : notice || '자동 저장됨'}</span>
                <button className="save-button" onClick={save} disabled={busy} title="Ctrl 또는 ⌘ + S">임시 저장</button>
              </div>
            </div>
            <div className="document-actions">
              <label htmlFor="draft-folder">폴더</label>
              <select id="draft-folder" value={active.folderId ?? ''} disabled={busy} onChange={(event) => moveDraft(event.target.value)}>
                <option value="">미분류</option>
                {state.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
              <button disabled={busy} onClick={() => { setSharingId(active.id); setNotice(''); setActionError('') }}>{active.share ? '공유 관리' : '공유하기'}</button>
              <button className="danger-text" disabled={busy} onClick={() => ask({ kind: 'draft', id: active.id })}>글 삭제</button>
            </div>
            <div className="writing-area">
              <label className="sr-only" htmlFor="draft-title">글 제목</label>
              <input ref={titleInput} id="draft-title" className="title-input" placeholder="제목을 적어 주세요" value={active.title} disabled={busy} onChange={(event) => edit('title', event.target.value)} autoComplete="off" />
              <div className="writing-meta"><span>{dateLabel(active.createdAt)}에 시작한 기록</span><span>일반 텍스트</span></div>
              <label className="sr-only" htmlFor="draft-content">글 내용</label>
              <textarea id="draft-content" className="content-input" placeholder={'오늘의 생각, 오래 남기고 싶은 장면.\n어떤 이야기든 편하게 적어 보세요.'} value={active.content} disabled={busy} onChange={(event) => edit('content', event.target.value)} spellCheck={false} />
              <footer className="editor-footer"><span>{active.content.length.toLocaleString('ko-KR')}자 <span className="footer-divider">·</span> 분량에 제한이 없어요</span><span>{state.dirty ? '변경사항 저장 필요' : dateLabel(active.updatedAt, true) + ' 저장'}</span></footer>
            </div>
          </section>
        ) : state.ready ? (
          <section className="empty-workspace">
            <div className="paper-illustration" aria-hidden="true"><span /><span /><span /><i>여백</i></div>
            <span className="eyebrow">A LITTLE SPACE FOR YOURSELF</span>
            <h2>{filter === 'all' ? <>당신의 이야기에<br />작은 여백을 내어 주세요.</> : <>이 폴더의 첫 페이지를<br />채워 보세요.</>}</h2>
            <p>좋아했던 게임, 문득 떠오른 생각, 평범했던 하루.<br />완성하지 않아도, 누구에게 보여주지 않아도 좋은 기록.</p>
            <button className="start-button" disabled={busy} onClick={newDraft}>{state.drafts.length ? '새 글 쓰기' : '첫 글 쓰기'} <span aria-hidden="true">↗</span></button>
            <span className="empty-hint" role="status">{notice || '쓰는 순간마다 자동으로 임시 저장돼요.'}</span>
          </section>
        ) : <div className="load-placeholder">기존 기록을 보호하기 위해 불러오기를 기다리고 있어요.</div>}
      </main>

      {folderEditor !== undefined && <FolderDialog folder={folderEditor ?? undefined} onClose={() => setFolderEditor(undefined)} onSave={saveFolder} />}
      {confirmation && <Dialog title={confirmTitle} busy={busy} onClose={() => { setConfirmation(null); setActionError('') }}>
        <p className="confirm-name">{confirmName}</p>
        <p>{confirmation.kind === 'folder' ? '폴더 안의 글은 삭제되지 않고 미분류로 이동해요.'
          : confirmation.kind === 'unshare' ? '기존 링크로는 더 이상 글을 열 수 없어요. 개인 기록은 그대로 남아요.'
          : '삭제한 글은 되돌릴 수 없어요. 공유 중인 글이라면 공유 링크도 함께 비활성화돼요.'}</p>
        {actionError && <p className="inline-error" role="alert">{actionError}</p>}
        <div className="modal-actions">
          <button disabled={busy} onClick={() => { setConfirmation(null); setActionError('') }}>취소</button>
          <button className="danger-button" disabled={busy} onClick={() => void confirmAction()}>{busy ? '처리 중…' : confirmation.kind === 'unshare' ? '공유 중단' : '삭제'}</button>
        </div>
      </Dialog>}
      {sharing && !confirmation && <Dialog title="기록 공유하기" busy={busy} onClose={() => setSharingId(null)}>
        <p>링크를 아는 사람에게 이 글의 제목과 본문을 보여줘요. 다른 글과 폴더는 공개되지 않아요.</p>
        <p className="share-note">공유 후 수정한 내용은 ‘공유 내용 업데이트’를 눌러야 반영돼요.</p>
        {sharing.share?.publishedAt ? <>
          <label htmlFor="share-link">읽기 전용 공유 링크</label>
          <input id="share-link" readOnly value={shareUrl(sharing.share.id)} onFocus={(event) => event.target.select()} />
          <div className="link-actions">
            <button disabled={busy} onClick={() => void copyLink()}>링크 복사</button>
            <a href={shareUrl(sharing.share.id)} target="_blank" rel="noreferrer">공유 페이지 열기 ↗</a>
          </div>
          <p className="share-note">{sharing.share.publishedAt === sharing.updatedAt ? '현재 내용이 공유 페이지에 반영되어 있어요.' : '아직 공유 페이지에 반영하지 않은 수정 내용이 있어요.'}</p>
        </> : sharing.share && <p className="share-note">이전 요청의 완료를 확인하지 못했어요. 다시 공유하거나 공유를 중단할 수 있어요.</p>}
        {['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) && <p className="local-share-note">현재는 내 컴퓨터에서만 열리는 주소예요. 다른 사람에게 보내려면 사이트와 공유 서버를 함께 배포해야 해요.</p>}
        <p className="share-note">공유를 관리하려면 이 브라우저의 데이터를 유지해 주세요.</p>
        {actionError && <p className="inline-error" role="alert">{actionError}</p>}
        {notice && <p role="status" className="share-feedback">{notice}</p>}
        <div className="modal-actions">
          {sharing.share && <button className="danger-text" disabled={busy} onClick={() => ask({ kind: 'unshare', id: sharing.id })}>공유 중단</button>}
          <button className="primary-button" disabled={busy} onClick={() => void publish()}>{busy ? '공유 저장 중…' : sharing.share?.publishedAt ? '공유 내용 업데이트' : '공유 링크 만들기'}</button>
        </div>
      </Dialog>}
    </div>
  )
}
