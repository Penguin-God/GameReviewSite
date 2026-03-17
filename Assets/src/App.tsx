import { useEffect, useState } from 'react'
import { supabase } from './supabase'

interface Review {
  id: number;
  content: string;
}

export default function App() {
  const [reviews, setReviews] = useState<Review[]>([])
  
  /* 새로 추가된 부분: 유저가 입력창에 적는 텍스트를 임시로 담아둘 공간입니다. */
  const [newContent, setNewContent] = useState<string>("")

  useEffect(() => {
    fetchReviews()
  }, [])

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      /* 새로 추가된 부분: 게시물을 가져올 때 최신 글이 위로 오도록 정렬합니다. */
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('데이터 통신 에러:', error)
    } else if (data) {
      setReviews(data)
    }
  }

  /* 새로 추가된 부분: Create() 류의 역할을 하는 리뷰 생성 함수입니다. */
  const createReview = async () => {
    if (newContent.trim() === "") return;

    const { error } = await supabase
      .from('reviews')
      .insert([{ content: newContent }])

    if (!error) {
      setNewContent("") 
      fetchReviews() 
    } else {
      console.error('리뷰 작성 에러:', error)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>게임 리뷰 커뮤니티</h1>
      
      {/* 새로 추가된 부분: 글을 작성하는 UI 영역입니다. */}
      <div style={{ marginBottom: '20px' }}>
        <textarea 
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="리뷰를 작성해보세요..."
          style={{ width: '100%', height: '100px', marginBottom: '10px' }}
        />
        <button onClick={createReview} style={{ width: '100%', padding: '10px' }}>
          리뷰 등록하기
        </button>
      </div>

      <hr />

      <ul>
        {reviews.map((review) => (
          <li key={review.id} style={{ marginBottom: '10px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
            {review.content}
          </li>
        ))}
      </ul>
    </div>
  )
}