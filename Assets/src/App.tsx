import { useCallback, useEffect, useRef, useState } from 'react'
import { createDraft, loadDrafts, saveDrafts } from './drafts'
import type { Draft } from './drafts'
import './App.css'

function dateLabel(value: string, detailed = false) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long', day: 'numeric',
    ...(detailed ? { hour: '2-digit', minute: '2-digit' } as const : {}),
  }).format(new Date(value))
}

interface JournalState {
  drafts: Draft[]
  raw: string | null
  activeId: string | null
  ready: boolean
  dirty: boolean
  error: string
}

function initialState(): JournalState {
  try {
    const loaded = loadDrafts(window.localStorage)
    return { ...loaded, activeId: loaded.drafts[0]?.id ?? null, ready: true, dirty: false, error: '' }
  } catch (error) {
    return { drafts: [] as Draft[], raw: null, activeId: null, ready: false, dirty: false, error: errorMessage(error) }
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '저장 공간에 접근할 수 없습니다. 브라우저 설정을 확인하고 다시 시도해 주세요.'
}

export default function App() {
  const [state, setState] = useState(initialState)
  const [notice, setNotice] = useState('')
  const titleInput = useRef<HTMLInputElement>(null)
  const active = state.drafts.find((draft) => draft.id === state.activeId)

  const persist = useCallback((drafts: Draft[], activeId: string | null) => {
    try {
      const raw = saveDrafts(window.localStorage, drafts, state.raw)
      setState({ drafts, activeId, raw, ready: true, dirty: false, error: '' })
      return true
    } catch (error) {
      setState((previous) => ({ ...previous, drafts, activeId, dirty: true, error: errorMessage(error) }))
      return false
    }
  }, [state.raw])

  const save = useCallback(() => {
    if (state.ready && persist(state.drafts, state.activeId)) setNotice('임시 저장했습니다.')
  }, [persist, state.ready, state.drafts, state.activeId])

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
    if (!state.dirty) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [state.dirty])

  function newDraft() {
    const draft = createDraft()
    setNotice('')
    persist([draft, ...state.drafts], draft.id)
    requestAnimationFrame(() => titleInput.current?.focus())
  }

  function edit(field: 'title' | 'content', value: string) {
    if (!active) return
    setNotice('')
    const updated = { ...active, [field]: value, updatedAt: new Date().toISOString() }
    persist([updated, ...state.drafts.filter((draft) => draft.id !== active.id)], active.id)
  }

  return (
    <div className="journal">
      <aside className="sidebar" aria-label="내 기록">
        <a className="brand" href="/" aria-label="여백 홈"><span className="brand-symbol" aria-hidden="true">여</span>여백<span className="brand-caption">나의 기록 공간</span></a>
        <div className="sidebar-intro"><span className="eyebrow">MY JOURNAL</span><h1>쓰고 싶은 순간에,<br />나만의 속도로.</h1><p>아직 다 쓰지 않아도 괜찮아요.</p></div>
        <button className="new-button" onClick={newDraft} disabled={!state.ready}><span aria-hidden="true">＋</span> 새 글 쓰기</button>
        <div className="list-heading"><h2>작성 중인 글 <span>{state.drafts.length}</span></h2><span>최근 수정순</span></div>
        <nav className="draft-list" aria-label="작성 중인 글 목록">
          {state.drafts.map((draft) => (
            <button key={draft.id} className={`draft-item ${draft.id === state.activeId ? 'selected' : ''}`} aria-current={draft.id === state.activeId ? 'true' : undefined} onClick={() => { setState((previous) => ({ ...previous, activeId: draft.id })); setNotice('') }}>
              <span className="draft-title">{draft.title.trim() || '제목 없는 글'}</span>
              <span className="draft-preview">{draft.content.trim() || '아직 비어 있는 페이지'}</span>
              <span className="draft-meta">{dateLabel(draft.updatedAt)}<span>임시 글</span></span>
            </button>
          ))}
          {state.ready && state.drafts.length === 0 && <p className="empty-list">첫 번째 기록을 기다리고 있어요.<br />새 글을 쓰면 이곳에 차곡차곡 모여요.</p>}
        </nav>
        <div className="storage-note"><span className="small-dot" aria-hidden="true" /><div>이 브라우저에만 저장돼요.<p>브라우저 데이터를 지우면 글도 삭제돼요.<br />다른 기기와는 동기화되지 않아요.</p></div></div>
      </aside>

      <main className="workspace">
        <header className="workspace-header"><span>나의 기록 <span className="breadcrumb" aria-hidden="true">/</span> <strong>{active ? '작성 중인 글' : '새로운 페이지'}</strong></span><span className="private-label"><span aria-hidden="true">◌</span> 나만의 공간</span></header>
        {state.error && <div className="error-banner" role="alert"><div><strong>{state.ready ? '글이 저장되지 않았어요.' : '저장된 글을 불러오지 못했어요.'}</strong><p>{state.error}</p>{state.dirty && <p>작성한 내용은 현재 화면에 남아 있어요. 페이지를 닫기 전에 내용을 복사해 두세요.</p>}</div><button onClick={() => state.ready ? save() : setState(initialState())}>{state.ready ? '저장 다시 시도' : '불러오기 재시도'}</button></div>}
        {active ? (
          <section className="editor" aria-label="글 편집기">
            <div className="editor-toolbar"><span className="draft-badge">임시 글</span><div className="save-controls"><span role="status" className={state.dirty ? 'save-status unsaved' : 'save-status'}>{state.dirty ? '저장 필요' : notice || '자동 저장됨'}</span><button className="save-button" onClick={save} title="Ctrl 또는 ⌘ + S">임시 저장 <span aria-hidden="true">↗</span></button></div></div>
            <div className="writing-area">
              <label className="sr-only" htmlFor="draft-title">글 제목</label>
              <input ref={titleInput} id="draft-title" className="title-input" placeholder="제목을 적어 주세요" value={active.title} onChange={(event) => edit('title', event.target.value)} autoComplete="off" />
              <div className="writing-meta"><span>{dateLabel(active.createdAt)}에 시작한 기록</span><span>일반 텍스트</span></div>
              <label className="sr-only" htmlFor="draft-content">글 내용</label>
              <textarea id="draft-content" className="content-input" placeholder={'오늘의 생각, 오래 남기고 싶은 장면.\n어떤 이야기든 편하게 적어 보세요.'} value={active.content} onChange={(event) => edit('content', event.target.value)} spellCheck={false} />
              <footer className="editor-footer"><span>{active.content.length.toLocaleString('ko-KR')}자 <span className="footer-divider">·</span> 분량에 제한이 없어요</span><span>{state.dirty ? '변경사항 저장 필요' : `${dateLabel(active.updatedAt, true)} 저장`}</span></footer>
            </div>
          </section>
        ) : state.ready ? (
          <section className="empty-workspace"><div className="paper-illustration" aria-hidden="true"><span /><span /><span /><i>여백</i></div><span className="eyebrow">A LITTLE SPACE FOR YOURSELF</span><h2>당신의 이야기에<br />작은 여백을 내어 주세요.</h2><p>좋아했던 게임, 문득 떠오른 생각, 평범했던 하루.<br />완성하지 않아도, 누구에게 보여주지 않아도 좋은 기록.</p><button className="start-button" onClick={newDraft}>첫 글 쓰기 <span aria-hidden="true">↗</span></button><span className="empty-hint">쓰는 순간마다 자동으로 임시 저장돼요.</span></section>
        ) : <div className="load-placeholder">기존 기록을 보호하기 위해 불러오기를 기다리고 있어요.</div>}
      </main>
    </div>
  )
}
