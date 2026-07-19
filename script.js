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

// Step 4 두 그림 비교 상태 관리
const compareState = {
    isComparing: false,
    first: null,  // { character, background, action, imageUrl, promptText }
    second: null  // { character, background, action, imageUrl, promptText }
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
const countBadge        = document.getElementById('countBadge');
const remainingCountEl  = document.getElementById('remainingCount');
const promptCountBadge  = document.getElementById('promptCountBadge');

// 이미지 생성 최대 횟수
const MAX_IMAGE_COUNT  = 5;
// 마법 주문 최대 횟수
const MAX_PROMPT_COUNT = 5;


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

// Step 4 이미지 완료 시 상태 처리 및 UI 반영 (첫 번째 그림 기준)
function handleImageCompletion(imageUrl) {
    if (compareState.isComparing) return; // 이미 비교 모드라면 무시

    compareState.first = {
        character: state.character,
        background: state.background,
        action: state.action,
        imageUrl: imageUrl,
        promptText: state.koreanPrompt
    };
    compareState.isComparing = true;

    // 첫 번째 그림 카드 채우기
    document.getElementById('compareImg1').src = compareState.first.imageUrl;
    document.getElementById('compareSelections1').innerHTML = `
        <span>👤 ${compareState.first.character}</span>
        <span>🏞️ ${compareState.first.background}</span>
        <span>🏃 ${getActionKoreanName(compareState.first.action)}</span>
    `;

    // 모든 옵션 버튼 리셋 및 원래 선택 항목 비활성화 처리
    compareOptionButtons.forEach(optBtn => {
        optBtn.classList.remove('original-selection', 'active-char', 'active-bg', 'active-action');
        optBtn.disabled = false;

        const cat = optBtn.dataset.category;
        let originalValue = '';
        if (cat === 'character') originalValue = compareState.first.character;
        else if (cat === 'background') originalValue = compareState.first.background;
        else if (cat === 'action') originalValue = compareState.first.action;

        if (optBtn.dataset.value === originalValue) {
            optBtn.classList.add('original-selection');
            optBtn.disabled = true;
        }
    });

    // Step 4 UI 요소 초기화
    compareActionZone.setAttribute('hidden', '');
    compareGenerateBtn.disabled = true;
    compareGenerateBtn.textContent = '🎨 두 번째 그림 그리기!';

    // 두 번째 그림 카드 초기화
    const wrapper2 = document.getElementById('compareImg2Wrapper');
    const img2 = document.getElementById('compareImg2');
    wrapper2.classList.add('placeholder');
    img2.setAttribute('hidden', '');
    img2.src = '';
    document.getElementById('compareSelections2').innerHTML = '';
    document.getElementById('differenceNoteZone').setAttribute('hidden', '');

    // Step 4 보이기
    document.getElementById('step4').removeAttribute('hidden');
}

/* ────────────────────────────────────────────────────────
   Step 4 전용 바꿀 항목/버튼 및 액션 핸들러
   ──────────────────────────────────────────────────────── */
const compareActionZone       = document.getElementById('compareActionZone');
const compareGenerateBtn     = document.getElementById('compareGenerateBtn');
const compareOptionButtons    = document.querySelectorAll('.compare-option-btn');

// 바꿀 항목의 옵션 버튼 클릭 이벤트 바인딩 (하나를 선택하면 다른 모든 선택을 해제하여 단 하나만 골라지도록 설정)
compareOptionButtons.forEach(optBtn => {
    optBtn.addEventListener('click', () => {
        if (optBtn.classList.contains('original-selection')) return;

        // 다른 모든 옵션 버튼의 active 클래스 해제 (전체 카테고리 중 단 1개만 바꿀 수 있도록 강제)
        compareOptionButtons.forEach(b => {
            b.classList.remove('active-char', 'active-bg', 'active-action');
        });

        // 현재 클릭한 버튼의 카테고리에 맞는 active 클래스 추가
        const category = optBtn.dataset.category;
        let activeClass = '';
        if (category === 'character') activeClass = 'active-char';
        else if (category === 'background') activeClass = 'active-bg';
        else if (category === 'action') activeClass = 'active-action';

        optBtn.classList.add(activeClass);

        compareState.category = category;
        compareState.newValue = optBtn.dataset.value;

        // 두 번째 그리기 버튼 노출 및 활성화
        compareActionZone.removeAttribute('hidden');
        compareGenerateBtn.disabled = false;

        let changeText = '';
        if (category === 'character') {
            changeText = `주인공: ${compareState.first.character} ➡️ ${compareState.newValue}`;
        } else if (category === 'background') {
            changeText = `배경: ${compareState.first.background} ➡️ ${compareState.newValue}`;
        } else if (category === 'action') {
            const cleanText = optBtn.textContent.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
            changeText = `행동: ${getActionKoreanName(compareState.first.action)} ➡️ ${cleanText}`;
        }

        compareGenerateBtn.textContent = `🎨 두 번째 그림 그리기! (${changeText})`;
    });
});

// 3. 두 번째 그림 그리기 버튼 클릭 이벤트 바인딩 (주문 + 이미지 연속 호출)
compareGenerateBtn.addEventListener('click', async () => {
    const sessionVal = localStorage.getItem('mallang_session') || '';
    const currentUser = sessionVal.replace('logged_in_', '');

    hideError();
    document.getElementById('differenceNoteZone').setAttribute('hidden', '');
    imageLoadingBox.removeAttribute('hidden');

    const loadingTextEl = imageLoadingBox.querySelector('.loading-text');
    const originalLoadingText = loadingTextEl.textContent;
    loadingTextEl.textContent = '두 번째 마법 그림을 그리고 있어요... 🎨';

    compareGenerateBtn.disabled = true;
    const originalBtnText = compareGenerateBtn.textContent;
    compareGenerateBtn.textContent = '⏳ 두 번째 마법 그림 그리는 중...';

    // 최종 파라미터 조합
    const secondChar = compareState.category === 'character' ? compareState.newValue : compareState.first.character;
    const secondBg   = compareState.category === 'background' ? compareState.newValue : compareState.first.background;
    const secondAction = compareState.category === 'action' ? compareState.newValue : compareState.first.action;

    try {
        // ① 먼저 DB에서 이미지 생성 횟수 차감 시도
        const countRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_image_count`, {
            method: 'POST',
            headers: {
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({ p_username: currentUser })
        });

        const canGenerate = await countRes.json();

        if (canGenerate !== true) {
            showError('이미지 생성 횟수를 모두 사용했어요! 선생님께 문의해 주세요 😢');
            lockGenerateBtn();
            compareGenerateBtn.textContent = '🚫 이미지 생성 횟수를 모두 사용했어요!';
            compareGenerateBtn.style.background = '#e2e8f0';
            compareGenerateBtn.style.color = '#94a3b8';
            compareGenerateBtn.style.boxShadow = 'none';
            updateCountBadge(MAX_IMAGE_COUNT);
            return;
        }

        // ② 두 번째 마법 주문 (프롬프트) 백엔드 자동 요청
        const promptRes = await callEdgeFunction('generate-prompt', {
            character:  secondChar,
            background: secondBg,
            action:     secondAction,
        });

        // ③ 두 번째 이미지 백엔드 요청
        const data = await callEdgeFunction('generate-image', {
            prompt: promptRes.englishPrompt,
        });

        const secondImgUrl = `data:${data.mimeType};base64,${data.imageBytes}`;
        compareState.second = {
            character: secondChar,
            background: secondBg,
            action: secondAction,
            imageUrl: secondImgUrl,
            promptText: promptRes.koreanPrompt
        };

        // UI 업데이트
        const wrapper2 = document.getElementById('compareImg2Wrapper');
        const img2 = document.getElementById('compareImg2');
        img2.src = compareState.second.imageUrl;
        img2.removeAttribute('hidden');
        wrapper2.classList.remove('placeholder');

        // 바뀐 내역 배지 강조 표시
        let selectionHTML = '';
        if (compareState.second.character !== compareState.first.character) {
            selectionHTML += `<span class="changed-item">👤 ${compareState.second.character} (주인공 변경)</span>`;
        } else {
            selectionHTML += `<span>👤 ${compareState.second.character}</span>`;
        }

        if (compareState.second.background !== compareState.first.background) {
            selectionHTML += `<span class="changed-item">🏞️ ${compareState.second.background} (배경 변경)</span>`;
        } else {
            selectionHTML += `<span>🏞️ ${compareState.second.background}</span>`;
        }

        if (compareState.second.action !== compareState.first.action) {
            selectionHTML += `<span class="changed-item">🏃 ${getActionKoreanName(compareState.second.action)} (행동 변경)</span>`;
        } else {
            selectionHTML += `<span>🏃 ${getActionKoreanName(compareState.second.action)}</span>`;
        }
        document.getElementById('compareSelections2').innerHTML = selectionHTML;

        // 차이점 기록장 오픈
        document.getElementById('differenceNoteZone').removeAttribute('hidden');
        document.getElementById('differenceInput').value = '';
        
        await loadImageCount(currentUser);
        setTimeout(() => {
            document.getElementById('differenceNoteZone').scrollIntoView({ behavior: 'smooth' });
        }, 300);

    } catch (err) {
        console.error(err);
        // 실패 시 mock 이미지로 처리
        compareState.second = {
            character: secondChar,
            background: secondBg,
            action: secondAction,
            imageUrl: FALLBACK_IMG,
            promptText: "샘플 주문 정보"
        };

        const wrapper2 = document.getElementById('compareImg2Wrapper');
        const img2 = document.getElementById('compareImg2');
        img2.src = FALLBACK_IMG;
        img2.removeAttribute('hidden');
        wrapper2.classList.remove('placeholder');

        let selectionHTML = '';
        if (compareState.second.character !== compareState.first.character) {
            selectionHTML += `<span class="changed-item">👤 ${compareState.second.character} (주인공 변경)</span>`;
        } else {
            selectionHTML += `<span>👤 ${compareState.second.character}</span>`;
        }

        if (compareState.second.background !== compareState.first.background) {
            selectionHTML += `<span class="changed-item">🏞️ ${compareState.second.background} (배경 변경)</span>`;
        } else {
            selectionHTML += `<span>🏞️ ${compareState.second.background}</span>`;
        }

        if (compareState.second.action !== compareState.first.action) {
            selectionHTML += `<span class="changed-item">🏃 ${getActionKoreanName(compareState.second.action)} (행동 변경)</span>`;
        } else {
            selectionHTML += `<span>🏃 ${getActionKoreanName(compareState.second.action)}</span>`;
        }
        document.getElementById('compareSelections2').innerHTML = selectionHTML;

        document.getElementById('differenceNoteZone').removeAttribute('hidden');
        document.getElementById('differenceInput').value = '';
        
        await loadImageCount(currentUser);
        setTimeout(() => {
            document.getElementById('differenceNoteZone').scrollIntoView({ behavior: 'smooth' });
        }, 300);
    } finally {
        imageLoadingBox.setAttribute('hidden', '');
        loadingTextEl.textContent = originalLoadingText;
        compareGenerateBtn.disabled = false;
        compareGenerateBtn.textContent = originalBtnText;
    }
});

// 행동 data-value 명칭 변환 헬퍼
function getActionKoreanName(val) {
    if (val === '춤을 추고') return '춤추기';
    if (val === '폴짝폴짝 뛰고') return '뛰기';
    if (val === '신나게 달리고') return '달리기';
    if (val === '얌전히 서서') return '서있기';
    if (val === '쿨쿨 잠을 자고') return '잠자기';
    if (val === '재미있게 책을 읽고') return '책읽기';
    if (val === '노래를 부르고') return '노래하기';
    return val;
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

    // 현재 로그인된 유저명 가져오기
    const sessionVal  = localStorage.getItem('mallang_session') || '';
    const currentUser = sessionVal.replace('logged_in_', '');

    // 로딩 시작
    hideError();
    loadingBox.removeAttribute('hidden');
    createPromptBtn.disabled    = true;
    createPromptBtn.textContent = '⏳ 마법 주문을 만들고 있어요...';

    try {
        // ① 마법 주문 횟수 차감 시도
        const countRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_prompt_count`, {
            method: 'POST',
            headers: {
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({ p_username: currentUser })
        });

        const canCreate = await countRes.json();

        if (canCreate !== true) {
            showError('마법 주문 만들기 횟수를 모두 사용했어요! 선생님께 문의해 주세요 😢');
            lockCreatePromptBtn();
            updatePromptCountBadge(MAX_PROMPT_COUNT);
            return;
        }

        // ② 횟수 차감 성공 → 마법 주문 실제 요청
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
        generateBtn.disabled    = false;
        generateBtn.textContent = '🎨 AI에게 그림 그려달라고 하기!';

        // 주문 만들기 버튼 완료 표시
        createPromptBtn.textContent = '✨ 마법 주문 완성! (다시 만들려면 클릭)';
        createPromptBtn.disabled = false;

        // 배지 업데이트
        await loadPromptCount(currentUser);

    } catch (err) {
        console.error(err);
        showError(`마법 주문을 만드는 데 실패했어요 😢\n${err.message}`);
        createPromptBtn.disabled = false;
        createPromptBtn.textContent = '📝 마법 주문 만들기 (다시 시도)';
        await loadPromptCount(currentUser);
    } finally {
        loadingBox.setAttribute('hidden', '');
    }
});


/* ────────────────────────────────────────────────────────
   이미지 생성 횟수 관리
   ──────────────────────────────────────────────────────── */

// 횟수 배지 UI 업데이트
function updateCountBadge(usedCount) {
    const remaining = MAX_IMAGE_COUNT - usedCount;
    countBadge.removeAttribute('hidden');

    if (remaining <= 0) {
        // 횟수 소진 시 문구로 표시
        countBadge.innerHTML = `<span class="count-icon">🎨</span> <span>가능한 횟수가 모두 소진되었습니다.</span>`;
    } else {
        // 남은 횟수 숫자 표시
        countBadge.innerHTML = `<span class="count-icon">🎨</span> <span>그림 그리기 남은 횟수: </span><span id="remainingCount" class="count-number">${remaining}</span><span>회</span>`;
    }
}

// 로그인한 사용자의 현재 사용 횟수를 DB에서 가져오기
async function loadImageCount(username) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_image_count`, {
            method: 'POST',
            headers: {
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({ p_username: username })
        });
        if (!res.ok) return;
        const usedCount = await res.json();
        updateCountBadge(usedCount);

        // 이미 5회 소진 시 버튼 잠금
        if (usedCount >= MAX_IMAGE_COUNT) {
            lockGenerateBtn();
        }
    } catch (e) {
        console.error('횟수 조회 실패:', e);
    }
}

// 그리기 버튼 잠금 처리
function lockGenerateBtn() {
    generateBtn.disabled    = true;
    generateBtn.textContent = '🚫 이미지 생성 횟수를 모두 사용했어요!';
    generateBtn.style.background = '#e2e8f0';
    generateBtn.style.color      = '#94a3b8';
    generateBtn.style.boxShadow  = 'none';
}

/* ────────────────────────────────────────────────────────
   마법 주문 횟수 관리
   ──────────────────────────────────────────────────────── */

// 마법 주문 배지 UI 업데이트
function updatePromptCountBadge(usedCount) {
    const remaining = MAX_PROMPT_COUNT - usedCount;
    promptCountBadge.removeAttribute('hidden');

    if (remaining <= 0) {
        promptCountBadge.innerHTML = `<span class="count-icon">📝</span> <span>가능한 횟수가 모두 소진되었습니다.</span>`;
    } else {
        promptCountBadge.innerHTML = `<span class="count-icon">📝</span> <span>마법 주문 남은 횟수: </span><span class="count-number">${remaining}</span><span>회</span>`;
    }
}

// 마법 주문 횟수 DB에서 조회
async function loadPromptCount(username) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_prompt_count`, {
            method: 'POST',
            headers: {
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({ p_username: username })
        });
        if (!res.ok) return;
        const usedCount = await res.json();
        updatePromptCountBadge(usedCount);

        if (usedCount >= MAX_PROMPT_COUNT) {
            lockCreatePromptBtn();
        }
    } catch (e) {
        console.error('마법 주문 횟수 조회 실패:', e);
    }
}

// 마법 주문 버튼 잠금
function lockCreatePromptBtn() {
    createPromptBtn.disabled    = true;
    createPromptBtn.textContent = '🚫 마법 주문 횟수를 모두 사용했어요!';
    createPromptBtn.style.background = '#e2e8f0';
    createPromptBtn.style.color      = '#94a3b8';
    createPromptBtn.style.boxShadow  = 'none';
}

/* ────────────────────────────────────────────────────────
   이미지 생성 횟수 관리
   ──────────────────────────────────────────────────────── */
generateBtn.addEventListener('click', async () => {
    if (!state.englishPrompt) {
        showError('먼저 [마법 주문 만들기] 버튼을 눌러 주세요!');
        return;
    }

    // 현재 로그인된 유저명 가져오기
    const sessionVal = localStorage.getItem('mallang_session') || '';
    const currentUser = sessionVal.replace('logged_in_', '');

    // 로딩 시작
    hideError();
    outputZone.setAttribute('hidden', '');
    imageLoadingBox.removeAttribute('hidden');
    generateBtn.disabled    = true;
    generateBtn.textContent = '⏳ 그림을 그리고 있어요...';

    try {
        // ① 먼저 DB에서 횟수 차감 시도 (5회 초과 시 false 반환)
        const countRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_image_count`, {
            method: 'POST',
            headers: {
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({ p_username: currentUser })
        });

        const canGenerate = await countRes.json();

        if (canGenerate !== true) {
            showError('이미지 생성 횟수를 모두 사용했어요! 선생님께 문의해 주세요 😢');
            lockGenerateBtn();
            updateCountBadge(MAX_IMAGE_COUNT);
            return;
        }

        // ② 횟수 차감 성공 → 실제 이미지 생성 요청
        const data = await callEdgeFunction('generate-image', {
            prompt: state.englishPrompt,
        });

        // ③ 이미지 표시 & 배지 업데이트
        resultImage.src = `data:${data.mimeType};base64,${data.imageBytes}`;
        
        // 성공 시 배지 텍스트 설정
        const badge = outputZone.querySelector('.success-badge');
        if (badge) {
            badge.textContent = '✨ 완성!';
        }

        outputZone.removeAttribute('hidden');
        outputZone.scrollIntoView({ behavior: 'smooth' });

        // DB에서 최신 횟수 다시 읽어 배지 갱신
        await loadImageCount(currentUser);

        // Step 4 처리 추가
        handleImageCompletion(resultImage.src);

    } catch (err) {
        console.error(err);
        // 실패 시 샘플 이미지 사용 (에러창을 띄우는 대신 완성 메시지 표시)
        resultImage.src = FALLBACK_IMG;
        
        // 실패 시 배지 텍스트를 "✨ 완성!!!"으로 변경하여 자연스럽게 대체
        const badge = outputZone.querySelector('.success-badge');
        if (badge) {
            badge.textContent = '✨ 완성!!!';
        }

        outputZone.removeAttribute('hidden');
        outputZone.scrollIntoView({ behavior: 'smooth' });
        await loadImageCount(currentUser);

        // 실패 시에도 Step 4 샘플 이미지로 처리 추가
        handleImageCompletion(resultImage.src);
    } finally {
        imageLoadingBox.setAttribute('hidden', '');
        // 버튼 복원은 lockGenerateBtn이 아닌 경우에만
        if (generateBtn.textContent === '⏳ 그림을 그리고 있어요...') {
            generateBtn.disabled    = false;
            generateBtn.textContent = '🎨 AI에게 그림 그려달라고 하기!';
        }
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

    loginBtn.disabled = true;
    loginBtn.textContent = '🚪 책방에 들어가는 중...';
    hideLoginError();

    try {
        // Supabase Database RPC 함수 호출로 안전하게 검증
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_login`, {
            method: 'POST',
            headers: {
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({
                p_username: username,
                p_password: password
            })
        });

        if (!res.ok) {
            throw new Error('서버 통신에 실패했습니다. 다시 시도해 주세요.');
        }

        const isSuccess = await res.json();

        if (isSuccess === true) {
            // 로그인 상태 기록 (로컬 스토리지에 단순 플래그 저장)
            localStorage.setItem('mallang_session', 'logged_in_' + username);
            
            // 폼 초기화
            loginIdInput.value = '';
            loginPwInput.value = '';

            // 로그인 성공 UI 전환 및 횟수 로드
            checkAuth();
            await loadImageCount(username);
            await loadPromptCount(username);
        } else {
            throw new Error('아이디나 비밀번호가 틀렸어요 😢');
        }

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
    
    // Step 4 숨김 및 초기화
    document.getElementById('step4').setAttribute('hidden', '');
    compareState.isComparing = false;
    compareState.first = null;
    compareState.second = null;
    compareState.category = null;
    compareState.newValue = null;

    // Step 4 내부 UI 초기화
    document.querySelectorAll('.compare-option-btn').forEach(btn => {
        btn.classList.remove('active-char', 'active-bg', 'active-action', 'original-selection');
        btn.disabled = false;
    });
    compareActionZone.setAttribute('hidden', '');

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
