import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useNavigate } from 'react-router-dom';

export default function Write() {
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  
  // 내 성향을 저장할 상태 (로그인 여부 확인용)
  const [myStyle, setMyStyle] = useState<string | null>(null);

  // 리액트 라우터의 '페이지 강제 이동' 도구입니다.
  const navigate = useNavigate();

  useEffect(() => {
    // 페이지가 열릴 때 내 기기에 저장된 성향(로그인 기록)이 있는지 확인합니다.
    const savedStyle = localStorage.getItem('my_game_style');
    if (savedStyle) {
      setMyStyle(savedStyle);
    }
  }, []);

  // 리뷰를 데이터베이스에 등록하는 함수
  async function handleSubmit(): Promise<void> {
    // 1. 프론트엔드(웹) 유효성 검사
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

    // ⭐ 내 기기에 저장된 유저 코드를 꺼내옵니다.
    const myCode = localStorage.getItem('my_user_code');

    // 2. Supabase에 데이터 저장 (game_play_type과 함께 user_code도 보냅니다!)
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
      navigate('/'); // 등록이 완료되면 읽기 페이지(홈)로 자동으로 튕겨 보냅니다.
    }
  }

  // --- 렌더링 영역 ---

  // 1. 로그인이 안 된 유저 차단 화면
  if (!myStyle) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: '#888' }}>
        <h2 style={{ color: '#fff' }}>글쓰기 권한이 없습니다.</h2>
        <p>리뷰를 작성하려면 [내 계정] 메뉴에서 닉네임을 만들거나 접속 코드를 연동해주세요.</p>
      </div>
    );
  }

  // 2. 정상적인 리뷰 작성 화면
  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '10px' }}>새 리뷰 작성</h1>
      <p style={{ color: '#aaa', marginBottom: '30px' }}>
        당신의 성향: <strong style={{ color: '#646cff' }}>[{myStyle}]</strong> (이 성향으로 자동 등록됩니다)
      </p>

      {/* 제목 입력칸 */}
      <input 
        type="text" 
        placeholder="리뷰 제목을 입력하세요" 
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: '100%', padding: '15px', fontSize: '1.5em', marginBottom: '20px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#1a1a1a', color: '#fff', boxSizing: 'border-box' }}
      />

      {/* 본문 입력칸 (1500자 이상 작성을 위해 크게 만들었습니다) */}
      <textarea 
        placeholder="최소 1500자 이상의 깊이 있는 리뷰를 남겨주세요..." 
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{ width: '100%', height: '400px', padding: '15px', fontSize: '1.1em', lineHeight: '1.6', marginBottom: '10px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#1a1a1a', color: '#fff', boxSizing: 'border-box', resize: 'vertical' }}
      />

      {/* 실시간 글자 수 카운터 (웹 검사의 핵심 UX) */}
      <div style={{ textAlign: 'right', marginBottom: '20px', color: content.length >= 1500 ? '#4caf50' : '#d32f2f', fontWeight: 'bold' }}>
        현재 글자 수: {content.length} / 1500
      </div>

      <button 
        onClick={handleSubmit} 
        // 1500자가 안 되면 버튼 색상을 회색으로 죽여서 시각적으로도 막힌 것을 보여줍니다.
        style={{ 
          width: '100%', 
          padding: '16px', 
          fontSize: '1.2em', 
          fontWeight: 'bold', 
          backgroundColor: content.length >= 1500 ? '#646cff' : '#444', 
          color: content.length >= 1500 ? '#fff' : '#888',
          border: 'none', 
          borderRadius: '8px', 
          cursor: content.length >= 1500 ? 'pointer' : 'not-allowed'
        }}
      >
        리뷰 등록하기
      </button>
    </div>
  );
}