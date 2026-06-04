import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

import Read from './pages/Read'
import Write from './pages/Write'
import Account from './pages/Account'

export default function App() {
  return (
    // BrowserRouter가 전체 앱을 감싸야 주소 이동이 가능해집니다.
    <BrowserRouter>
      
      {/* 1. 상단 네비게이션 바 (모든 페이지에서 공통으로 보입니다) */}
      <nav style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', gap: '20px', justifyContent: 'center' }}>
        <Link to="/" style={{ fontSize: '1.2em', textDecoration: 'none' }}>홈 (리뷰 읽기)</Link>
        <Link to="/write" style={{ fontSize: '1.2em', textDecoration: 'none' }}>리뷰 작성</Link>
        <Link to="/account" style={{ fontSize: '1.2em', textDecoration: 'none' }}>내 계정</Link>
      </nav>

      {/* 2. 주소에 따라 화면이 바뀌는 본문 영역 */}
      <main style={{ padding: '20px' }}>
        <Routes>
          {/* 인터넷 주소창에 '/' (기본 주소)가 입력되면 <Read />을 보여줘라 */}
          <Route path="/" element={<Read />} />
          
          {/* '/write'가 입력되면 <Write />를 보여줘라 */}
          <Route path="/write" element={<Write />} />
          
          {/* '/account'가 입력되면 <Account />를 보여줘라 */}
          <Route path="/account" element={<Account />} />
        </Routes>
      </main>

    </BrowserRouter>
  )
}