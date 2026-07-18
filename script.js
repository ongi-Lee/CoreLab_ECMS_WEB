/* ===================================================
   말랑말랑 AI 그림 책방 - script.js
   =================================================== */

/* ──────────────────────────────────────────────────
   ★ 여기에 Supabase 정보를 입력하세요!
   Supabase 대시보드 → Settings → API 에서 확인 가능
   (이 값들은 공개해도 안전합니다)
   ────────────────────────────────────────────────── */
const SUPABASE_URL      = "https://mjsuomcklkiessxfxzfi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_snAda8Q9A1ox_Z5pVqiycA_zaV9ewIM";

// Fallback 이미지 경로 (GitHub에 업로드된 샘플 이미지)
const FALLBACK_IMG = "sample_img.png";


/* ────────────────────────────────────────────────────────
   상태 관리
   ──────────────────────────────────────────────────────── */
const state = {
    character:     null,
    background:    null,
    action:        null,
    koreanPrompt:  "",   // 학생에게 보여주는 한국어 요약
    englishPrompt: "",   // 이미지 생성에 사용하는 영어 프롬프트 (화면에 미표시)
};


/* ────────────────────────────────────────────────────────
   DOM 요소 취득
   ──────────────────────────────────────────────────────── */
const characterButtons  = document.querySelectorAll('#characterGrid   .selection-btn');
const backgroundButtons = document.querySelectorAll('#backgroundGrid  .selection-btn');
const actionButtons     = document.querySelectorAll('#actionGrid      .selection-btn');
const promptDisplay     = document.getElementById('promptDisplay');
const createPromptBtn   = document.getElementById('createPromptBtn');
const generateBtn       = document.getElementById('generateBtn');
const loadingBox        = document.getElementById('loadingBox');
const imageLoadingBox   = document.getElementById('imageLoadingBox');
const outputZone        = document.getElementById('outputZone');
const resultImage       = document.getElementById('resultImage');
const errorMessage      = document.getElementById('errorMessage');


/* ────────────────────────────────────────────────────────
   선택 상태 확인 → 버튼 활성화 제어
   ──────────────────────────────────────────────────────── */
function checkSelections() {
    // 선택이 바뀌면 기존 프롬프트와 이미지 초기화
    state.koreanPrompt  = "";
    state.englishPrompt = "";
    promptDisplay.innerHTML   = `<span class="prompt-placeholder">주인공, 배경, 행동 버튼을 모두 고른 다음<br>아래 [마법 주문 만들기] 버튼을 놀러주세요!</span>`;
    document.querySelector('.prompt-preview-zone').classList.remove('has-prompt');
    generateBtn.disabled = true;
    generateBtn.textContent = '🎨 AI에게 그림 그려달라고 하기';
    outputZone.setAttribute('hidden', '');
    hideError();

    const allChosen = state.character && state.background && state.action;
    createPromptBtn.disabled = !allChosen;

    if (!allChosen) {
        const missing = [];
        if (!state.character)  missing.push('주인공');
        if (!state.background) missing.push('배경');
        if (!state.action)     missing.push('행동');
        createPromptBtn.textContent = `📝 마법 주문 만들기 (${missing.join(', ')} 선택 필요)`;
    } else {
        createPromptBtn.textContent = '📝 마법 주문 만들기 ✨';
    }
}


/* ────────────────────────────────────────────────────────
   버튼 클릭 이벤트 등록 (주인공 / 배경 / 행동)
   ──────────────────────────────────────────────────────── */
function bindToggle(buttons, stateKey, activeClass) {
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const isSame = state[stateKey] === btn.dataset.value;
            buttons.forEach(b => b.classList.remove(activeClass));
            state[stateKey] = isSame ? null : btn.dataset.value;
            if (!isSame) btn.classList.add(activeClass);
            checkSelections();
        });
    });
}

bindToggle(characterButtons,  'character',  'active-char');
bindToggle(backgroundButtons, 'background', 'active-bg');
bindToggle(actionButtons,     'action',     'active-action');


/* ────────────────────────────────────────────────────────
   Supabase Edge Function 공통 호출 유틸
   ──────────────────────────────────────────────────────── */
async function callEdgeFunction(functionName, body) {
    const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
    const res  = await fetch(url, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `서버 오류 (${res.status})`);
    }
    return res.json();
}


/* ────────────────────────────────────────────────────────
   마법 주문 만들기 버튼
   ──────────────────────────────────────────────────────── */
createPromptBtn.addEventListener('click', async () => {
    if (!state.character || !state.background || !state.action) return;

    // 로딩 시작
    hideError();
    loadingBox.removeAttribute('hidden');
    createPromptBtn.disabled  = true;
    createPromptBtn.textContent = '⏳ 마법 주문을 만들고 있어요...';

    try {
        const data = await callEdgeFunction('generate-prompt', {
            character:  state.character,
            background: state.background,
            action:     state.action,
        });

        state.koreanPrompt  = data.koreanPrompt;
        state.englishPrompt = data.englishPrompt;

        // 프롬프트 표시 (읽기 전용)
        promptDisplay.textContent = state.koreanPrompt;
        document.querySelector('.prompt-preview-zone').classList.add('has-prompt');

        // 이미지 그리기 버튼 활성화
        generateBtn.disabled = false;
        generateBtn.textContent = '🎨 AI에게 그림 그려달라고 하기!';

        // 주문 만들기 버튼 완료 표시
        createPromptBtn.textContent = '✨ 마법 주문 완성! (다시 만들려면 클릭)';
        createPromptBtn.disabled = false;

    } catch (err) {
        console.error(err);
        showError(`마법 주문을 만드는 데 실패했어요 😢\n${err.message}`);
        createPromptBtn.disabled = false;
        createPromptBtn.textContent = '📝 마법 주문 만들기 (다시 시도)';
    } finally {
        loadingBox.setAttribute('hidden', '');
    }
});


/* ────────────────────────────────────────────────────────
   그림 그리기 버튼
   ──────────────────────────────────────────────────────── */
generateBtn.addEventListener('click', async () => {
    if (!state.englishPrompt) {
        showError('먼저 [마법 주문 만들기] 버튼을 눌러 주세요!');
        return;
    }

    // 로딩 시작
    hideError();
    outputZone.setAttribute('hidden', '');
    imageLoadingBox.removeAttribute('hidden');
    generateBtn.disabled          = true;
    generateBtn.textContent       = '⏳ 그림을 그리고 있어요...';

    try {
        const data = await callEdgeFunction('generate-image', {
            prompt: state.englishPrompt,
        });

        // 이미지 표시 (성공)
        resultImage.src = `data:${data.mimeType};base64,${data.imageBytes}`;
        outputZone.removeAttribute('hidden');
        outputZone.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        console.error(err);
        // 실패 시 샘플 이미지 사용
        resultImage.src = FALLBACK_IMG;
        outputZone.removeAttribute('hidden');
        outputZone.scrollIntoView({ behavior: 'smooth' });
        showError(`그림을 만드는 데 실패했어요 😢\n${err.message}`);
    } finally {
        imageLoadingBox.setAttribute('hidden', '');
        generateBtn.disabled          = false;
        generateBtn.textContent       = '🎨 AI에게 그림 그려달라고 하기!';
    }
});


/* ────────────────────────────────────────────────────────
   에러 표시 유틸
   ──────────────────────────────────────────────────────── */
function showError(msg) {
    errorMessage.removeAttribute('hidden');
    errorMessage.textContent   = msg;
    errorMessage.scrollIntoView({ behavior: 'smooth' });
}
function hideError() {
    errorMessage.setAttribute('hidden', '');
    errorMessage.textContent   = '';
}


/* ────────────────────────────────────────────────────────
   초기화
   ──────────────────────────────────────────────────────── */
checkSelections();


/* ────────────────────────────────────────────────────────
   로그인 시스템 및 세션 관리
   ──────────────────────────────────────────────────────── */
const loginOverlay  = document.getElementById('loginOverlay');
const mainContainer = document.getElementById('mainContainer');
const loginIdInput  = document.getElementById('loginId');
const loginPwInput  = document.getElementById('loginPw');
const loginBtn      = document.getElementById('loginBtn');
const loginError    = document.getElementById('loginError');
const logoutBtn     = document.getElementById('logoutBtn');

// 세션 상태 확인 함수
function checkAuth() {
    const sessionToken = localStorage.getItem('mallang_session');
    if (sessionToken) {
        loginOverlay.setAttribute('hidden', '');
        mainContainer.removeAttribute('hidden');
    } else {
        loginOverlay.removeAttribute('hidden');
        mainContainer.setAttribute('hidden', '');
    }
}

// 로그인 실행
async function handleLogin() {
    const username = loginIdInput.value.trim();
    const password = loginPwInput.value.trim();

    if (!username || !password) {
        showLoginError('아이디와 비밀번호를 모두 입력해 주세요!');
        return;
    }

    // 아이디를 이메일 형식으로 변환 (대소문자 오타 방지를 위해 소문자 처리)
    const email = `${username.toLowerCase()}@corelab.com`;

    loginBtn.disabled = true;
    loginBtn.textContent = '🚪 책방에 들어가는 중...';
    hideLoginError();

    try {
        // Supabase Auth REST API 호출
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'apikey':       SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            // 사용자용 에러 피드백
            throw new Error(errData.error_description || '아이디나 비밀번호를 다시 확인해 주세요 😢');
        }

        const data = await res.json();
        
        // 브라우저 로컬 스토리지에 토큰 저장하여 로그인 상태 유지
        localStorage.setItem('mallang_session', data.access_token);
        
        // 폼 초기화
        loginIdInput.value = '';
        loginPwInput.value = '';

        // 로그인 성공 UI 전환
        checkAuth();

    } catch (err) {
        console.error(err);
        showLoginError(err.message || '로그인에 실패했습니다. 다시 시도해 주세요.');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = '🚪 책방 들어가기!';
    }
}

// 이벤트 리스너 등록
loginBtn.addEventListener('click', handleLogin);

// 엔터 키 누르면 로그인 실행
loginPwInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleLogin();
    }
});
loginIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginPwInput.focus();
    }
});

// 로그아웃 처리
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('mallang_session');
    
    // 선택값 초기화
    state.character  = null;
    state.background = null;
    state.action     = null;
    
    // 활성화 상태인 그리드 버튼 클래스 해제
    document.querySelectorAll('.selection-btn').forEach(btn => {
        btn.classList.remove('active-char', 'active-bg', 'active-action');
    });
    
    checkSelections();
    checkAuth();
});

// 에러 메시지 헬퍼
function showLoginError(msg) {
    loginError.removeAttribute('hidden');
    loginError.textContent = msg;
}
function hideLoginError() {
    loginError.setAttribute('hidden', '');
    loginError.textContent = '';
}

// 초기 로드 시 실행
checkAuth();
