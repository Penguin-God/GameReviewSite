import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// C#의 구조체나 클래스처럼 데이터의 규격을 정의합니다.
interface Review {
  id: number;
  content: string;
}

export default function App() {
  // 상태(State) 선언: 가져온 데이터를 저장할 공간입니다.
  const [reviews, setReviews] = useState<Review[]>([])

  // useEffect는 컴포넌트가 처음 렌더링될 때(Start 함수처럼) 한 번 실행됩니다.
  useEffect(() => {
    const fetchReviews = async () => {
      // 'reviews' 테이블에서 모든 데이터('*')를 조회합니다.
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
      
      if (error) {
        console.error('데이터 통신 에러:', error)
      } else if (data) {
        setReviews(data)
      }
    }

    fetchReviews()
  }, [])

  return (
    <div style={{ padding: '20px' }}>
      <h1>게임 리뷰 커뮤니티 테스트</h1>
      <ul>
        {/* 배열에 담긴 데이터를 반복문 없이 map을 통해 화면에 그려줍니다. */}
        {reviews.map((review) => (
          <li key={review.id}>{review.content}</li>
        ))}
      </ul>
    </div>
  )
}