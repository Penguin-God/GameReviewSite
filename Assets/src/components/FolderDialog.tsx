import { useState } from 'react'
import type { Folder } from '../drafts'
import Dialog from './Dialog'

export default function FolderDialog({ folder, onClose, onSave }: {
  folder?: Folder
  onClose: () => void
  onSave: (name: string) => string | null
}) {
  const [name, setName] = useState(folder?.name ?? '')
  const [error, setError] = useState('')
  return (
    <Dialog title={folder ? '폴더 이름 바꾸기' : '새 폴더'} onClose={onClose}>
      <form onSubmit={(event) => {
        event.preventDefault()
        const message = onSave(name)
        if (message) setError(message)
        else onClose()
      }}>
        <label htmlFor="folder-name">폴더 이름</label>
        <input id="folder-name" autoFocus value={name} maxLength={40} placeholder="예: 게임 기록, 일상의 생각"
          onChange={(event) => { setName(event.target.value); setError('') }} />
        {error && <p role="alert" className="inline-error">{error}</p>}
        <div className="modal-actions"><button type="button" onClick={onClose}>취소</button><button className="primary-button" type="submit">{folder ? '변경' : '만들기'}</button></div>
      </form>
    </Dialog>
  )
}
