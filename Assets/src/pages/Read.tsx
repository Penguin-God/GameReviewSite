import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type GamePlayType = '서사주의' | '중립' | '도전적';

interface Review {
  id: number;
  title: string;
  content: string;
  game_play_type: GamePlayType;
  created_at: string;
}

export default function App() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [activeTab, setActiveTab] = useState<GamePlayType>('서사주의')
  
  // 3. 페이지 전환을 제어할 핵심 상태
  // 'list' 이면 목록 화면을, 'detail' 이면 상세 본문 화면을 보여줍니다.
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list')
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)

  // 앱이 켜지면 Supabase에서 데이터를 가져옵니다.
  useEffect(() => {fetchReviews()}, [])

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('데이터를 가져오는 중 에러 발생:', error)
      alert(`불러오기 실패: ${error.message}\n(Supabase의 SELECT 정책(Policy)이 뚫려있는지 확인해보세요!)`)
    } else if (data) {
      setReviews(data)
    }
  }

  // 현재 활성화된 탭 성향과 일치하는 리뷰들만 필터링합니다.
  const filteredReviews = reviews.filter((review) => review.game_play_type === activeTab)

  // 특정 리뷰를 클릭했을 때 상세 페이지로 진입하는 함수
  const handleOpenDetail = (review: Review) => {
    setSelectedReview(review)
    setViewMode('detail') // 화면 모드를 상세 보기로 전환
  }

  // 상세 페이지에서 다시 목록으로 돌아오는 함수
  const handleGoBackList = () => {
    setSelectedReview(null)
    setViewMode('list') // 화면 모드를 목록 보기로 전환
  }


  // --- 1. 상세 본문 보기 화면 (viewMode === 'detail') ---
  if (viewMode === 'detail' && selectedReview) {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <button onClick={handleGoBackList} style={{ marginBottom: '20px', padding: '8px 16px' }}>
          ← 목록으로 돌아가기
        </button>
        
        <article style={{ border: '1px solid #444', padding: '30px', borderRadius: '8px', backgroundColor: '#1e1e1e' }}>
          <div style={{ color: '#888', fontSize: '0.9em', marginBottom: '10px' }}>
            [{selectedReview.game_play_type}] • {new Date(selectedReview.created_at).toLocaleDateString()}
          </div>
          <h1 style={{ fontSize: '2.2em', marginTop: '0', borderBottom: '2px solid #444', paddingBottom: '15px' }}>
            {selectedReview.title}
          </h1>
          
          {/* 긴 본문이 줄바꿈이 잘 되도록 whiteSpace 스타일을 줍니다 */}
          <p style={{ lineHeight: '1.8', fontSize: '1.1em', whiteSpace: 'pre-wrap', color: '#e0e0e0' }}>
            {selectedReview.content}
          </p>
        </article>
      </div>
    )
  }
  // --- 2. 기본 리뷰 목록 화면 (viewMode === 'list') ---
  else return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5em', marginBottom: '10px' }}>게임 리뷰 커뮤니티</h1>
        <p style={{ color: '#888' }}>성향별 게이머들의 깊이 있는 공간</p>
      </header>

      {/* 성향 선택 탭 UI (전체보기 없음) */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
        {(['서사주의', '도전적', '중립'] as GamePlayType[]).map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            style={{ 
              flex: 1,
              padding: '12px',
              fontSize: '1em',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              backgroundColor: activeTab === tab ? '#646cff' : '#1a1a1a',
              color: activeTab === tab ? '#fff' : '#aaa',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 리뷰 제목 목록 영역 */}
      <div>
        {filteredReviews.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {filteredReviews.map((review) => (
              <div 
                key={review.id} 
                onClick={() => handleOpenDetail(review)}
                style={{ 
                  padding: '20px', 
                  border: '1px solid #333', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  backgroundColor: '#1a1a1a',
                  transition: 'border-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#646cff'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#333'}
              >
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2em', color: '#fff' }}>
                  {review.title}
                </h3>
                <span style={{ fontSize: '0.85em', color: '#666' }}>
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            아직 [{activeTab}] 성향에 등록된 리뷰가 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}