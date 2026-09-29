import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export default function Dialog({ title, onClose, children, busy = false }: {
  title: string
  onClose: () => void
  children: ReactNode
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog ref={ref} className="modal" aria-labelledby="dialog-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
      <div className="modal-heading">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="icon-button" aria-label="닫기" onClick={onClose} disabled={busy}>×</button>
      </div>
      {children}
    </dialog>
  )
}
