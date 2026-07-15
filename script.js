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
        // 새 창/탭에 이미지 열기
        window.open(resultImage.src, '_blank');

    } catch (err) {
        console.error(err);
        // 실패 시 샘플 이미지 사용
        resultImage.src = FALLBACK_IMG;
        outputZone.removeAttribute('hidden');
        outputZone.scrollIntoView({ behavior: 'smooth' });
        window.open(FALLBACK_IMG, '_blank');
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
