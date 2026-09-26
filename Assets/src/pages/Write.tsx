import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useNavigate } from 'react-router-dom';

export default function Write() {
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [myStyle, setMyStyle] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const savedStyle = localStorage.getItem('my_game_style');
    if (savedStyle) {
      setMyStyle(savedStyle);
    }
  }, []);

  async function handleSubmit(): Promise<void> {
    if (title.trim() === "") {
      alert("제목을 입력해주세요.");
      return;
    }
    if (content.length < 1500) {
      alert(`내용이 부족합니다. (현재 ${content.length}자 / 최소 1500자)`);
      return;
    }
    if (!myStyle) {
      alert("성향 정보가 없습니다. 다시 로그인해주세요.");
      return;
    }

    const myCode = localStorage.getItem('user_code');

    const { error } = await supabase
      .from('reviews')
      .insert([{ 
        title: title, 
        content: content, 
        game_play_type: myStyle,
        user_code: myCode 
      }]);

    if (error) {
      console.error('리뷰 등록 에러:', error);
      alert(`등록 실패: ${error.message}`);
    } else {
      alert("성공적으로 1500자 이상의 정성스러운 리뷰가 등록되었습니다!");
      navigate('/'); 
    }
  }


  // --- 화면 렌더링 영역 ---

  if (!myStyle) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: '#888' }}>
        <h2 style={{ color: '#fff' }}>글쓰기 권한이 없습니다.</h2>
        <p>리뷰를 작성하려면 [내 계정] 메뉴에서 닉네임을 만들거나 접속 코드를 연동해주세요.</p>
      </div>
    );
  }

  // 게이지 바를 위한 계산 로직
  // 1500자를 넘어가도 게이지가 100%를 초과하지 않도록 Math.min을 사용합니다.
  const progressPercentage: number = Math.min((content.length / 1500) * 100, 100);
  const isComplete: boolean = content.length >= 1500;

  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '10px' }}>새 리뷰 작성</h1>
      <p style={{ color: '#aaa', marginBottom: '30px' }}>
        당신의 성향: <strong style={{ color: '#646cff' }}>[{myStyle}]</strong> (이 성향으로 자동 등록됩니다)
      </p>

      <input 
        type="text" 
        placeholder="리뷰 제목을 입력하세요" 
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: '100%', padding: '15px', fontSize: '1.5em', marginBottom: '20px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#1a1a1a', color: '#fff', boxSizing: 'border-box' }}
      />

      <textarea 
        placeholder="최소 1500자 이상의 깊이 있는 리뷰를 남겨주세요..." 
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{ width: '100%', height: '400px', padding: '15px', fontSize: '1.1em', lineHeight: '1.6', marginBottom: '15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#1a1a1a', color: '#fff', boxSizing: 'border-box', resize: 'vertical' }}
      />

      {/* 시각적 경험치(글자 수) 게이지 바 영역 */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ color: '#888', fontWeight: 'bold' }}>최소 필요 글자</span>
          <span style={{ color: isComplete ? '#4caf50' : '#d32f2f', fontWeight: 'bold' }}>
            {content.length} / 1500
          </span>
        </div>
        
        {/* 게이지 바 배경 (어두운 회색) */}
        <div style={{ width: '100%', height: '14px', backgroundColor: '#333', borderRadius: '7px', overflow: 'hidden' }}>
          {/* 실제로 차오르는 색상 바 */}
          <div style={{ 
            width: `${progressPercentage}%`, 
            height: '100%', 
            backgroundColor: isComplete ? '#4caf50' : '#646cff', // 완료되면 초록색으로 변경!
            transition: 'width 0.2s ease-out, background-color 0.3s ease' // 부드러운 애니메이션 효과
          }} />
        </div>
      </div>

      <button 
        onClick={handleSubmit} 
        style={{ 
          width: '100%', 
          padding: '16px', 
          fontSize: '1.2em', 
          fontWeight: 'bold', 
          backgroundColor: isComplete ? '#646cff' : '#444', 
          color: isComplete ? '#fff' : '#888',
          border: 'none', 
          borderRadius: '8px', 
          cursor: isComplete ? 'pointer' : 'not-allowed',
          transition: 'all 0.3s ease'
        }}
      >
        {/* 버튼 텍스트도 상태에 따라 동적으로 바뀝니다 */}
        {isComplete ? '리뷰 등록하기' : '1500자를 채워주세요'}
      </button>
    </div>
  );
}