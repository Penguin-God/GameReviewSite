import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type GamePlayType = '서사주의' | '중립' | '도전적';

// 유저 정보의 타입을 정의합니다.
interface UserProfile {
  id: number;
  nickname: string;
  game_play_type: GamePlayType;
  user_code: string;
}

export default function Account() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  
  // 새 계정 생성을 위한 상태들
  const [inputNickname, setInputNickname] = useState<string>("")
  const [selectedType, setSelectedType] = useState<GamePlayType>('서사주의')

  // 기존 코드 로그인을 위한 상태
  const [inputCode, setInputCode] = useState<string>("")

  useEffect(() => {
    // 앱이 켜지면 브라우저에 저장된 내 코드가 있는지 확인합니다.
    const savedCode = localStorage.getItem('my_user_code')
    if (savedCode) {
      fetchUserByCode(savedCode)
    }
  }, []) // 인자로 넘기는 람다(화살표) 함수는 그대로 유지합니다.

  // 1. 코드로 유저 정보를 불러오는 함수 (function 선언 적용)
  async function fetchUserByCode(code: string): Promise<void> {
    const { data, error } = await supabase
      .from('users') // 주의: users라는 테이블이 Supabase에 있어야 합니다!
      .select('*')
      .eq('user_code', code)
      .single()

    if (data && !error) {
      setCurrentUser(data)
      // 로그인 성공 시 브라우저에 코드와 성향을 저장합니다.
      localStorage.setItem('my_user_code', data.user_code)
      localStorage.setItem('my_game_style', data.game_play_type)
    } else {
      alert("코드가 유효하지 않거나 정보를 불러올 수 없습니다.")
      localStorage.removeItem('my_user_code') // 잘못된 코드는 지워줍니다.
    }
  }

  // 2. 새로운 계정을 생성하는 함수
  async function handleCreateAccount(): Promise<void> {
    if (inputNickname.trim() === "") {
      alert("닉네임을 입력해주세요!")
      return
    }

    // A~Z, 0~9로 이루어진 8자리의 고유 코드를 무작위로 생성합니다.
    const newCode = Math.random().toString(36).substring(2, 10).toUpperCase()

    const { data, error } = await supabase
      .from('users')
      .insert([{ 
        nickname: inputNickname, 
        game_play_type: selectedType, 
        user_code: newCode 
      }])
      .select()
      .single()

    if (error) {
      console.error('계정 생성 에러:', error)
      alert(`생성 실패: ${error.message}`)
    } else if (data) {
      setCurrentUser(data)
      localStorage.setItem('my_user_code', data.user_code)
      localStorage.setItem('my_game_style', data.game_play_type)
      alert("환영합니다! 계정이 성공적으로 생성되었습니다.")
    }
  }

  // 3. 기기 연동을 해제(로그아웃)하는 함수
  function handleLogout(): void {
    localStorage.removeItem('my_user_code')
    localStorage.removeItem('my_game_style')
    setCurrentUser(null)
    setInputNickname("")
    setInputCode("")
    alert("이 기기에서 연동이 해제되었습니다.")
  }

  // 4. 기존 코드로 로그인하는 함수
  function handleLoginWithCode(): void {
    if (inputCode.trim() === "") {
      alert("연동 코드를 입력해주세요.")
      return
    }
    fetchUserByCode(inputCode)
  }


  // --- 화면 렌더링 영역 ---

  // 이미 접속된 계정이 있다면 (currentUser가 null이 아니라면) '내 정보 화면'을 보여줍니다.
  if (currentUser) {
    return (
      <div style={{ padding: '40px', maxWidth: '500px', margin: '0 auto', backgroundColor: '#1a1a1a', borderRadius: '12px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2em', marginBottom: '10px' }}>환영합니다, {currentUser.nickname}님!</h2>
        <p style={{ color: '#888', fontSize: '1.2em' }}>나의 게임 성향: <strong>[{currentUser.game_play_type}]</strong></p>
        
        <div style={{ margin: '40px 0', padding: '20px', backgroundColor: '#2a2a2a', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 10px 0', color: '#aaa' }}>나의 고유 연동 코드</p>
          <h3 style={{ margin: 0, fontSize: '2.5em', letterSpacing: '3px', color: '#646cff' }}>{currentUser.user_code}</h3>
          <p style={{ fontSize: '0.9em', color: '#666', marginTop: '15px' }}>
            이 코드를 기억해두시면 다른 기기(스마트폰 등)에서도 접속할 수 있습니다.
          </p>
        </div>

        <button onClick={handleLogout} style={{ padding: '12px 24px', backgroundColor: '#d32f2f', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          이 기기에서 연동 해제 (로그아웃)
        </button>
      </div>
    )
  }

  // 접속된 계정이 없다면 '가입 및 로그인 화면'을 보여줍니다.
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
      
      {/* 왼쪽: 새 계정 만들기 영역 */}
      <div style={{ flex: 1, minWidth: '300px', backgroundColor: '#1a1a1a', padding: '30px', borderRadius: '12px' }}>
        <h2>새 닉네임 생성하기</h2>
        <p style={{ color: '#888', marginBottom: '20px' }}>비밀번호 없이 닉네임만으로 가볍게 시작하세요.</p>
        
        <input 
          type="text" 
          placeholder="사용할 닉네임 입력" 
          value={inputNickname}
          onChange={(e) => setInputNickname(e.target.value)}
          style={{ width: '100%', padding: '12px', boxSizing: 'border-box', marginBottom: '20px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', fontSize: '1.1em' }}
        />

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          {(['서사주의', '도전적', '중립'] as GamePlayType[]).map((type) => (
            <button 
              key={type}
              onClick={() => setSelectedType(type)}
              style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: selectedType === type ? '#646cff' : '#333', color: '#fff' }}
            >
              {type}
            </button>
          ))}
        </div>

        <button onClick={handleCreateAccount} style={{ width: '100%', padding: '14px', fontSize: '1.1em', fontWeight: 'bold', backgroundColor: '#646cff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          시작하기
        </button>
      </div>

      {/* 오른쪽: 기존 코드로 로그인 영역 */}
      <div style={{ flex: 1, minWidth: '300px', backgroundColor: '#1a1a1a', padding: '30px', borderRadius: '12px' }}>
        <h2>기존 코드로 접속하기</h2>
        <p style={{ color: '#888', marginBottom: '20px' }}>다른 기기에서 발급받은 8자리 코드를 입력하세요.</p>
        
        <input 
          type="text" 
          placeholder="예: A7X9K2M1" 
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          style={{ width: '100%', padding: '12px', boxSizing: 'border-box', marginBottom: '20px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', fontSize: '1.1em', textTransform: 'uppercase' }}
        />

        <button onClick={handleLoginWithCode} style={{ width: '100%', padding: '14px', fontSize: '1.1em', fontWeight: 'bold', backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          연동하기
        </button>
      </div>

    </div>
  )
}