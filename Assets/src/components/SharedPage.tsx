import { useEffect, useState } from 'react'
import { getSharedPost } from '../sharing'
import type { SharedPost } from '../sharing'

export default function SharedPage({ id }: { id: string }) {
  const [post, setPost] = useState<SharedPost | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    getSharedPost(id, controller.signal).then((value) => {
      if (!controller.signal.aborted) setPost(value)
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '글을 불러오지 못했습니다.')
    })
    return () => controller.abort()
  }, [id, attempt])
  useEffect(() => {
    document.title = post ? `${post.title.trim() || '제목 없는 글'} — 여백` : '공유된 기록 — 여백'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow, noarchive'
    document.head.appendChild(meta)
    return () => { meta.remove() }
  }, [post])

  return (
    <main className="shared-page">
      <header className="shared-header"><a className="brand" href="/">여백</a><span>당신에게 전해진 기록</span></header>
      {post ? <article className="shared-article">
        <span className="eyebrow">A PAGE SHARED WITH YOU</span>
        <h1>{post.title.trim() || '제목 없는 글'}</h1>
        <p className="shared-date">{new Date(post.sharedAt).toLocaleDateString('ko-KR')}에 공유한 기록</p>
        <div className="shared-content">{post.content || '아직 내용이 없는 기록입니다.'}</div>
        <footer>한 사람의 이야기를 조용히 담아 둔 공간, 여백.</footer>
      </article> : error ? <section className="shared-message" role="alert">
        <h1>이 기록을 열 수 없어요.</h1><p>{error}</p>
        <button onClick={() => { setError(''); setAttempt((value) => value + 1) }}>다시 시도</button>
      </section> : <p className="shared-message" role="status">기록을 불러오고 있어요.</p>}
    </main>
  )
}
