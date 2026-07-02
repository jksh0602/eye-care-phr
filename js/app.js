/**
 * Eye Care PHR - 순수 프론트엔드 웹앱
 * localStorage 기반 데이터 저장, SPA 페이지 라우팅
 * ============================================= */

// ==================== 데이터 레이어 ====================
const DB = {
    get(key, def) {
        try { return JSON.parse(localStorage.getItem('eye_' + key)) || def; }
        catch { return def; }
    },
    set(key, val) {
        localStorage.setItem('eye_' + key, JSON.stringify(val));
    },
    // 유저 관련
    getUsers() { return this.get('users', {}); },
    saveUser(id, data) {
        const users = this.getUsers();
        users[id] = { ...(users[id] || {}), ...data };
        this.set('users', users);
    },
    getCurrentUser() {
        const uid = this.get('currentUser', null);
        if (!uid) return null;
        const users = this.getUsers();
        return users[uid] ? { ...users[uid], id: uid } : null;
    },
    // 특정 유저 데이터
    getUserData(uid, key, def) {
        const users = this.getUsers();
        return users[uid]?.[key] || def;
    },
    setUserData(uid, key, val) {
        this.saveUser(uid, { [key]: val });
    },
    // 배열 데이터 (진단, 측정, 상담글 등)
    getCollection(name) { return this.get(name, []); },
    addToCollection(name, item) {
        const col = this.getCollection(name);
        item.id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        item.createdAt = new Date().toISOString();
        col.push(item);
        this.set(name, col);
        return item;
    },
    updateInCollection(name, id, updates) {
        const col = this.getCollection(name);
        const idx = col.findIndex(i => i.id === id);
        if (idx > -1) { col[idx] = { ...col[idx], ...updates }; this.set(name, col); }
    },
    deleteFromCollection(name, id) {
        const col = this.getCollection(name).filter(i => i.id !== id);
        this.set(name, col);
    },
    // 현재 로그인한 유저의 데이터만 필터
    getMyCollection(name) {
        const user = this.getCurrentUser();
        if (!user) return [];
        return this.getCollection(name).filter(i => i.userId === user.id);
    },
    addToMyCollection(name, item) {
        const user = this.getCurrentUser();
        if (!user) return null;
        return this.addToCollection(name, { ...item, userId: user.id });
    }
};

// ==================== 설문 문항 ====================
const INITIAL_QUESTIONS = [
    { id: 'q1', text: '하루 평균 스마트폰/컴퓨터 사용 시간은 얼마인가요?',
      options: [['less_2', '2시간 미만', 0], ['2_4', '2~4시간', 1], ['4_8', '4~8시간', 2], ['over_8', '8시간 이상', 3]] },
    { id: 'q2', text: '최근 눈이 자주 건조하다고 느끼나요?',
      options: [['never', '전혀 아니다', 0], ['sometimes', '가끔 그렇다', 1], ['often', '자주 그렇다', 2], ['always', '항상 그렇다', 3]] },
    { id: 'q3', text: '눈이 충혈되거나 피로감을 느끼는 편인가요?',
      options: [['never', '전혀 아니다', 0], ['sometimes', '가끔 그렇다', 1], ['often', '자주 그렇다', 2], ['always', '항상 그렇다', 3]] },
    { id: 'q4', text: '눈이 침침하거나 흐릿하게 보인 적이 있나요?',
      options: [['never', '전혀 아니다', 0], ['sometimes', '가끔 그렇다', 1], ['often', '자주 그렇다', 2], ['always', '항상 그렇다', 3]] },
    { id: 'q5', text: '두통이나 안구 통증을 동반한 적이 있나요?',
      options: [['never', '전혀 아니다', 0], ['sometimes', '가끔 그렇다', 1], ['often', '자주 그렇다', 2], ['always', '항상 그렇다', 3]] },
    { id: 'q6', text: '렌즈를 착용하고 계신가요? (하루 착용 시간 기준)',
      options: [['no', '착용 안함', 0], ['under_8', '8시간 미만', 1], ['8_12', '8~12시간', 2], ['over_12', '12시간 이상', 3]] },
    { id: 'q7', text: '인공눈물을 하루에 몇 번 이상 사용하나요?',
      options: [['none', '사용 안함', 0], ['1_2', '1~2회', 1], ['3_5', '3~5회', 2], ['over_5', '5회 이상', 3]] },
    { id: 'q8', text: '취침 전 어두운 곳에서 스마트폰을 사용하나요?',
      options: [['never', '전혀 안한다', 0], ['sometimes', '가끔 한다', 1], ['often', '자주 한다', 2], ['always', '항상 한다', 3]] },
    { id: 'q9', text: '1년 이내에 안과 검진을 받으셨나요?',
      options: [['within_6', '6개월 이내', 0], ['within_1', '1년 이내', 1], ['over_1', '1년 이상 전', 2], ['never', '받은 적 없음', 3]] },
    { id: 'q10', text: '가족 중에 안구 질환(녹내장, 백내장 등)을 앓은 분이 있나요?',
      options: [['none', '없다', 0], ['dont_know', '모르겠다', 1], ['distant', '먼 친척', 2], ['immediate', '직계 가족', 3]] }
];

const REGULAR_QUESTIONS = [
    { id: 'rq1', text: '최근 일주일간 눈이 건조하다고 느낀 적이 있나요?',
      options: [['never', '전혀 없다', 0], ['sometimes', '가끔', 1], ['often', '자주', 2], ['always', '항상', 3]] },
    { id: 'rq2', text: '눈이 충혈되거나 피로한 상태가 지속되나요?',
      options: [['never', '전혀 없다', 0], ['sometimes', '가끔', 1], ['often', '자주', 2], ['always', '항상', 3]] },
    { id: 'rq3', text: '시야가 흐릿하거나 초점이 잘 안 맞나요?',
      options: [['never', '전혀 없다', 0], ['sometimes', '가끔', 1], ['often', '자주', 2], ['always', '항상', 3]] },
    { id: 'rq4', text: '두통이나 안구 통증이 있나요?',
      options: [['never', '전혀 없다', 0], ['sometimes', '가끔', 1], ['often', '자주', 2], ['always', '항상', 3]] },
    { id: 'rq5', text: '하루 평균 수면 시간은 얼마인가요?',
      options: [['over_7', '7시간 이상', 0], ['6_7', '6~7시간', 1], ['5_6', '5~6시간', 2], ['under_5', '5시간 미만', 3]] }
];

const SAMPLE_PRODUCTS = [
    { name: '서울안과의원', description: '제휴 안과 검진 20% 할인', price: 50000, category: 'eye_clinic', partner: '서울안과의원', emoji: '🏥' },
    { name: '클리어렌즈', description: '월간 렌즈 정기구독 (30pcs)', price: 35000, category: 'lens', partner: '클리어렌즈', emoji: '👁️' },
    { name: '블루블록 안경', description: '블루라이트 차단 안경테', price: 89000, category: 'glasses', partner: '블루블록', emoji: '🕶️' },
    { name: '리뉴 후레쉬', description: '다목적 렌즈 세정액 500ml', price: 12000, category: 'supplies', partner: '리뉴', emoji: '🧴' },
    { name: '인공눈물 0.1%', description: '무방부제 인공눈물 30개입', price: 25000, category: 'supplies', partner: '식약처인증', emoji: '💧' },
    { name: '온열안대', description: 'USB 충전식 온열안대', price: 39000, category: 'supplies', partner: '아이케어', emoji: '😌' },
    { name: '강남안과의원', description: '스마트 라식 검진 패키지', price: 150000, category: 'eye_clinic', partner: '강남안과', emoji: '🏥' },
    { name: '데이소프트 렌즈', description: '일회용 소프트렌즈 90pcs', price: 45000, category: 'lens', partner: '데이소프트', emoji: '👁️' },
];

const FAQS = [
    { q: '앱 사용 방법을 알려주세요.', a: '회원가입 후 자가진단을 완료하면 맞춤형 눈 건강 관리를 시작할 수 있습니다.' },
    { q: '자가진단은 얼마나 자주 해야 하나요?', a: '일반군은 한 달에 한 번, 주의군은 2주에 한 번, 위험군은 일주일에 한 번 자가진단을 권장합니다.' },
    { q: '구독 서비스의 혜택은 무엇인가요?', a: '광고 제거, 장기 PHR 분석 리포트 제공, 매월 10명 추첨 온열안대 증정. 월 1,900원입니다.' },
    { q: '측정 데이터는 어떻게 활용되나요?', a: '수집된 데이터는 개인별 눈 건강 상태 분석 및 맞춤형 관리에 활용됩니다.' },
    { q: '제휴 안과/안경사는 어떻게 이용하나요?', a: '쇼핑 탭에서 제휴 업체 정보를 확인하실 수 있습니다.' },
];

const CUSTOM_ITEMS = [
    { title: '눈 스트레칭 알림', desc: '1시간마다 눈 운동', icon: '👁️', active: true },
    { title: '블루라이트 차단', desc: '야간 모드 설정', icon: '💡', active: true },
    { title: '인공눈물 알림', desc: '2시간 간격 추천', icon: '💧', active: false },
];

// ==================== 페이지 라우팅 ====================
function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + name);
    if (el) el.classList.add('active');
    
    // 페이지 진입시 데이터 갱신
    if (name === 'main') refreshDashboard();
    else if (name === 'healthData') renderHealthData();
    else if (name === 'subscription') renderSubscription();
    else if (name === 'customerCenter') renderCustomerCenter();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    
    const content = document.getElementById('tab-' + tab);
    if (content) content.style.display = 'block';
    
    const tabEl = document.querySelector(`.tab-item[data-tab="${tab}"]`);
    if (tabEl) tabEl.classList.add('active');
    
    // 탭 진입시 데이터 갱신
    if (tab === 'home') refreshDashboard();
    else if (tab === 'consultation') renderConsultList();
    else if (tab === 'shopping') renderShopping('all');
    else if (tab === 'settings') renderSettings();
    else if (tab === 'mypage') renderMyPage();
    
    showPage('main');
}

// ==================== 알림/토스트 ====================
function flash(msg, type) {
    const container = document.getElementById('flashContainer');
    const div = document.createElement('div');
    div.className = 'flash-message flash-' + (type || 'info');
    div.innerHTML = `<span>${msg}</span><button class="flash-close" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(div);
    setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.3s'; setTimeout(() => div.remove(), 300); }, 3000);
}

function mainFlash(msg, type) {
    const container = document.getElementById('mainFlash');
    const div = document.createElement('div');
    div.className = 'flash-message flash-' + (type || 'info');
    div.innerHTML = `<span>${msg}</span><button class="flash-close" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(div);
    setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.3s'; setTimeout(() => div.remove(), 300); }, 3000);
}

// ==================== 인증 ====================
function register(event) {
    event.preventDefault();
    const id = document.getElementById('regId').value.trim();
    const pw = document.getElementById('regPw').value;
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    
    if (!id || !pw) { flash('아이디와 비밀번호를 입력해주세요.', 'error'); return false; }
    
    // 필수 약관 체크
    const required = document.querySelectorAll('.consent-required');
    for (let cb of required) {
        if (!cb.checked) { flash('필수 약관에 모두 동의해주세요.', 'error'); return false; }
    }
    
    const users = DB.getUsers();
    if (users[id]) { flash('이미 사용중인 아이디입니다.', 'error'); return false; }
    
    const consents = {};
    document.querySelectorAll('.consent-cb').forEach(cb => {
        consents[cb.dataset.key] = cb.checked ? 1 : 0;
    });
    
    const userData = {
        password: pw,
        name: name || id,
        email: email || '',
        createdAt: new Date().toISOString(),
        onboardingComplete: false,
        consents: consents,
        settings: { riskGroup: 'normal', notificationFreq: 'monthly', videoConsent: false, notificationEnabled: true, adEnabled: true },
        riskGroup: 'normal'
    };
    
    DB.saveUser(id, userData);
    DB.set('currentUser', id);
    flash('회원가입이 완료되었습니다!', 'success');
    showPage('welcome');
    return false;
}

function login(event) {
    event.preventDefault();
    const id = document.getElementById('loginId').value.trim();
    const pw = document.getElementById('loginPw').value;
    
    if (!id || !pw) { flash('아이디와 비밀번호를 입력해주세요.', 'error'); return false; }
    
    const users = DB.getUsers();
    const user = users[id];
    
    if (!user || user.password !== pw) {
        flash('아이디 또는 비밀번호가 올바르지 않습니다.', 'error');
        return false;
    }
    
    DB.set('currentUser', id);
    flash('로그인되었습니다.', 'success');
    
    if (!user.consents) {
        showPage('consent');
    } else if (!user.onboardingComplete) {
        showPage('welcome');
    } else {
        showPage('main');
    }
    return false;
}

function register(event) {
    event.preventDefault();
    const id = document.getElementById('regId').value.trim();
    const pw = document.getElementById('regPw').value;
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    
    if (!id || !pw) { flash('아이디와 비밀번호를 입력해주세요.', 'error'); return false; }
    
    const users = DB.getUsers();
    if (users[id]) { flash('이미 사용중인 아이디입니다.', 'error'); return false; }
    
    DB.saveUser(id, {
        password: pw,
        name: name || id,
        email: email || '',
        createdAt: new Date().toISOString(),
        onboardingComplete: false,
        consents: null,
        settings: { riskGroup: 'normal', notificationFreq: 'monthly', videoConsent: false, notificationEnabled: true, adEnabled: true },
        riskGroup: 'normal'
    });
    
    document.getElementById('regId').value = '';
    document.getElementById('regPw').value = '';
    document.getElementById('regName').value = '';
    document.getElementById('regEmail').value = '';
    
    flash('회원가입이 완료되었습니다. 로그인해주세요.', 'success');
    showPage('login');
    return false;
}

function submitConsent(event) {
    event.preventDefault();
    const user = DB.getCurrentUser();
    if (!user) return false;
    
    const required = document.querySelectorAll('#consentForm .consent-cb[data-required]');
    for (let cb of required) {
        if (!cb.checked) { flash('필수 약관에 모두 동의해주세요.', 'error'); return false; }
    }
    
    const consents = {};
    document.querySelectorAll('#consentForm .consent-cb').forEach(cb => {
        consents[cb.dataset.key] = cb.checked ? 1 : 0;
    });
    
    user.consents = consents;
    DB.saveUser(user.id, user);
    flash('약관 동의가 완료되었습니다!', 'success');
    showPage('welcome');
    return false;
}

function logout() {
    DB.set('currentUser', null);
    flash('로그아웃되었습니다.', 'info');
    showPage('login');
}

// ==================== 약관동의 ====================
function toggleAllConsents() {
    const all = document.getElementById('agreeAll');
    document.querySelectorAll('.consent-cb').forEach(cb => {
        if (cb.classList.contains('consent-required')) {
            cb.checked = all.checked;
        } else {
            cb.checked = all.checked;
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const all = document.getElementById('agreeAll');
    if (all) {
        all.addEventListener('change', function() {
            document.querySelectorAll('.consent-cb').forEach(cb => {
                cb.checked = all.checked;
            });
        });
    }
});

// ==================== 설문 렌더링 ====================
function renderQuestions(questions, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = questions.map((q, i) => `
        <div class="survey-question">
            <div class="q-text"><span class="q-number">${i + 1}</span>${q.text}</div>
            <div class="survey-options">
                ${q.options.map(([val, label]) => `
                    <label class="survey-option" onclick="this.querySelector('input').checked=true;document.querySelectorAll('input[name=${q.id}]').forEach(e=>e.closest('.survey-option').classList.remove('selected'));this.classList.add('selected')">
                        <input type="radio" name="${q.id}" value="${val}">
                        <span>${label}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ==================== 자가진단 ====================
function submitDiagnosis(event) {
    event.preventDefault();
    const user = DB.getCurrentUser();
    if (!user) return false;
    
    let totalScore = 0;
    const answers = {};
    
    for (let q of INITIAL_QUESTIONS) {
        const val = document.querySelector(`input[name="${q.id}"]:checked`);
        if (!val) { flash('모든 문항에 답변해주세요.', 'error'); return false; }
        answers[q.id] = val.value;
        for (let [optVal, , score] of q.options) {
            if (optVal === val.value) { totalScore += score; break; }
        }
    }
    
    const riskGroup = totalScore <= 7 ? 'normal' : (totalScore <= 14 ? 'caution' : 'risk');
    const freqMap = { normal: 'monthly', caution: 'biweekly', risk: 'weekly' };
    const dayMap = { normal: 30, caution: 14, risk: 7 };
    const labelMap = { normal: '일반군', caution: '주의군', risk: '위험군' };
    const colorMap = { normal: '#4CAF50', caution: '#FF9800', risk: '#f44336' };
    const descMap = { normal: '현재 눈 건강 상태가 양호합니다.', caution: '눈 건강에 주의가 필요한 상태입니다.', risk: '전문가 상담이 권장되는 상태입니다.' };
    
    // 진단 저장
    DB.addToMyCollection('diagnoses', {
        date: today(),
        answers, totalScore, riskGroup, isInitial: true
    });
    
    // 설정 업데이트
    user.settings = user.settings || {};
    user.settings.riskGroup = riskGroup;
    user.settings.notificationFreq = freqMap[riskGroup];
    const nextDate = addDays(today(), dayMap[riskGroup]);
    user.settings.nextDiagDate = nextDate;
    user.riskGroup = riskGroup;
    DB.saveUser(user.id, user);
    
    // 결과를 setupComplete 페이지에 표시
    document.getElementById('setupResult').innerHTML = `
        <div style="font-size:3rem;">${riskGroup === 'normal' ? '😊' : (riskGroup === 'caution' ? '😐' : '😟')}</div>
        <div class="result-label mt-2"><span class="risk-badge" style="background:${colorMap[riskGroup]};">${labelMap[riskGroup]}</span></div>
        <p class="text-lg font-bold mt-3">총점 ${totalScore}점</p>
        <p class="text-muted mt-2">${descMap[riskGroup]}</p>
    `;
    document.getElementById('setupFreq').textContent = 
        riskGroup === 'normal' ? '한 달에 한 번' : (riskGroup === 'caution' ? '2주에 한 번' : '일주일에 한 번');
    document.getElementById('setupFreq').style.color = colorMap[riskGroup];
    
    showPage('setupComplete');
    return false;
}

function submitRegularDiagnosis(event) {
    event.preventDefault();
    const user = DB.getCurrentUser();
    if (!user) return false;
    
    let totalScore = 0;
    const answers = {};
    
    for (let q of REGULAR_QUESTIONS) {
        const val = document.querySelector(`input[name="${q.id}"]:checked`);
        if (!val) { flash('모든 문항에 답변해주세요.', 'error'); return false; }
        answers[q.id] = val.value;
        for (let [optVal, , score] of q.options) {
            if (optVal === val.value) { totalScore += score; break; }
        }
    }
    
    const riskGroup = totalScore <= 4 ? 'normal' : (totalScore <= 8 ? 'caution' : 'risk');
    const dayMap = { normal: 30, caution: 14, risk: 7 };
    const labelMap = { normal: '일반군', caution: '주의군', risk: '위험군' };
    const colorMap = { normal: '#4CAF50', caution: '#FF9800', risk: '#f44336' };
    const descMap = { normal: '현재 눈 건강 상태가 양호합니다. 꾸준한 관리로 유지하세요!', caution: '눈 건강에 주의가 필요한 상태입니다. 생활 습관을 개선해보세요.', risk: '전문가 상담이 권장되는 상태입니다. 가까운 안과를 방문하세요.' };
    
    DB.addToMyCollection('diagnoses', {
        date: today(), answers, totalScore, riskGroup, isInitial: false
    });
    
    user.settings.riskGroup = riskGroup;
    const nextDate = addDays(today(), dayMap[riskGroup]);
    user.settings.nextDiagDate = nextDate;
    user.riskGroup = riskGroup;
    DB.saveUser(user.id, user);
    
    document.getElementById('diagResultContent').innerHTML = `
        <div class="card result-card">
            <div class="result-icon">${riskGroup === 'normal' ? '😊' : (riskGroup === 'caution' ? '😐' : '😟')}</div>
            <div class="result-label" style="color:${colorMap[riskGroup]};">${labelMap[riskGroup]}</div>
            <div class="result-score">총점: ${totalScore}점</div>
            <div class="divider"></div>
            <p class="text-muted">${descMap[riskGroup]}</p>
            <p class="text-sm text-muted mt-3">다음 진단 예정일: ${nextDate}</p>
        </div>
    `;
    
    showPage('diagResult');
    return false;
}

function completeSetup() {
    const user = DB.getCurrentUser();
    if (!user) return;
    
    user.onboardingComplete = true;
    user.settings = user.settings || {};
    user.settings.videoConsent = document.getElementById('videoConsent').checked;
    DB.saveUser(user.id, user);
    
    flash('눈 건강 관리 설정이 완료되었습니다!', 'success');
    showPage('main');
}

// ==================== 대시보드 ====================
function refreshDashboard() {
    const user = DB.getCurrentUser();
    if (!user) return;
    
    document.getElementById('greeting').textContent = `${user.name || user.id}님, 안녕하세요! 👋`;
    document.getElementById('todayDate').textContent = today();
    
    const rg = user.settings?.riskGroup || 'normal';
    const colorMap = { normal: '#4CAF50', caution: '#FF9800', risk: '#f44336' };
    const labelMap = { normal: '일반군', caution: '주의군', risk: '위험군' };
    const badge = document.getElementById('headerRiskBadge');
    badge.textContent = labelMap[rg];
    badge.style.background = colorMap[rg];
    
    // 피로도 점수
    const metrics = DB.getMyCollection('metrics');
    let fatigueScore = 0;
    if (metrics.length) {
        const recent = metrics.slice(-7);
        const scores = recent.filter(m => m.fatigue).map(m => m.fatigue);
        fatigueScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    } else {
        fatigueScore = Math.floor(Math.random() * 40) + 20;
    }
    
    document.getElementById('fatigueScoreDisplay').textContent = fatigueScore;
    const fatigueDesc = document.getElementById('fatigueDesc');
    if (fatigueScore < 30) fatigueDesc.textContent = '양호한 상태입니다 😊';
    else if (fatigueScore < 60) fatigueDesc.textContent = '보통 수준입니다 😐';
    else fatigueDesc.textContent = '피로가 쌓여있습니다 😟';
    
    // 위젯
    document.getElementById('widgetGrid').innerHTML = `
        <div class="widget-card"><div class="widget-icon">🩺</div><div class="widget-value">${Math.floor(Math.random() * 26) + 15}%</div><div class="widget-label">안구질환 위험도</div></div>
        <div class="widget-card"><div class="widget-icon">📱</div><div class="widget-value">${Math.floor(Math.random() * 7) + 2}h ${Math.floor(Math.random() * 60)}m</div><div class="widget-label">오늘 화면 사용시간</div></div>
        <div class="widget-card"><div class="widget-icon">👁️</div><div class="widget-value">${Math.floor(Math.random() * 600) + 200}</div><div class="widget-label">오늘 깜빡임</div></div>
        <div class="widget-card"><div class="widget-icon">📅</div><div class="widget-value" style="font-size:1rem;">${user.settings?.nextDiagDate || '설정필요'}</div><div class="widget-label">다음 진단일</div></div>
    `;
    
    // 맞춤관리
    document.getElementById('customItems').innerHTML = CUSTOM_ITEMS.map(item => `
        <div class="toggle-group">
            <div><div class="toggle-label">${item.icon} ${item.title}</div><div class="toggle-desc">${item.desc}</div></div>
            <label class="toggle-switch"><input type="checkbox" ${item.active ? 'checked' : ''}><span class="toggle-slider"></span></label>
        </div>
    `).join('');
    
    // 차트
    drawFatigueChart();
}

function drawFatigueChart() {
    const canvas = document.getElementById('fatigueChart');
    if (!canvas || !window.Chart) return;
    
    const metrics = DB.getMyCollection('metrics');
    const labels = [];
    const data = [];
    
    if (metrics.length > 0) {
        const recent = metrics.slice(-7);
        recent.forEach(m => { labels.push(m.date?.slice(5) || '-'); data.push(m.fatigue || 0); });
    } else {
        for (let i = 6; i >= 0; i--) {
            labels.push(addDays(today(), -i).slice(5));
            data.push(Math.floor(Math.random() * 40) + 20);
        }
    }
    
    new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: '눈 피로도', data, borderColor: '#2D9CDB', backgroundColor: 'rgba(45,156,219,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#2D9CDB' }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, grid: { display: false } }, x: { grid: { display: false } } } }
    });
}

// ==================== 고민상담 ====================
function renderConsultList() {
    const posts = DB.getCollection('consultations').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const el = document.getElementById('consultList');
    
    if (!posts.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><h3>아직 상담글이 없습니다</h3><p>첫 번째 상담글을 작성해보세요!</p></div>`;
        return;
    }
    
    el.innerHTML = `<div class="post-list">${posts.map(p => `
        <div class="post-item" onclick="showConsultDetail('${p.id}')">
            <div class="post-title">${p.title} ${p.answers?.length ? '<span class="post-badge answered">답변완료</span>' : ''}</div>
            <div class="post-meta"><span>${p.author || '익명'}</span><span>${(p.createdAt || '').slice(0, 10)}</span><span>${catLabel(p.category)}</span><span>💬 ${p.answers?.length || 0}</span></div>
        </div>
    `).join('')}</div>`;
}

function catLabel(cat) {
    return { general: '일반', eye_doctor: '안과', optician: '안경', lens: '렌즈' }[cat] || '일반';
}

function showConsultForm() {
    document.getElementById('consultTitle').value = '';
    document.getElementById('consultContent').value = '';
    document.getElementById('consultCategory').value = 'general';
    showPage('consultForm');
}

function submitConsult() {
    const title = document.getElementById('consultTitle').value.trim();
    const content = document.getElementById('consultContent').value.trim();
    const category = document.getElementById('consultCategory').value;
    const user = DB.getCurrentUser();
    
    if (!title || !content) { flash('제목과 내용을 입력해주세요.', 'error'); return; }
    
    DB.addToCollection('consultations', {
        title, content, category, author: user.name || user.id,
        answers: [], isAnswered: false, isPublic: true
    });
    
    flash('상담글이 등록되었습니다.', 'success');
    backToConsult();
}

function backToConsult() {
    renderConsultList();
    switchTab('consultation');
}

function showConsultDetail(id) {
    const posts = DB.getCollection('consultations');
    const post = posts.find(p => p.id === id);
    if (!post) return;
    
    document.getElementById('consultDetailContent').innerHTML = `
        <div class="detail-content">
            <div class="detail-title">${post.title}</div>
            <div class="detail-meta"><span>${post.author || '익명'}</span><span>${(post.createdAt || '').slice(0, 10)}</span><span class="post-badge">${catLabel(post.category)}</span>${post.answers?.length ? '<span class="post-badge answered">답변완료</span>' : ''}</div>
            <div class="detail-body">${post.content}</div>
        </div>
        <h3 class="font-bold mb-3">💬 답변 ${post.answers?.length || 0}개</h3>
        ${post.answers?.length ? post.answers.map(a => `
            <div class="answer-card">
                <div class="answer-header"><div><span class="expert-name">${a.expertName}</span><span class="expert-role"> · ${a.expertRole}</span></div><span class="text-xs text-muted">${(a.createdAt || '').slice(0, 10)}</span></div>
                <div class="answer-body">${a.content}</div>
            </div>
        `).join('') : `<div class="empty-state"><div class="empty-icon">⏳</div><h3>아직 답변이 없습니다</h3><p>전문가가 답변을 준비 중입니다.</p></div>`}
    `;
    
    showPage('consultDetail');
}

// ==================== 쇼핑 ====================
function renderShopping(category) {
    let products = DB.getCollection('products');
    if (!products.length) {
        SAMPLE_PRODUCTS.forEach(p => DB.addToCollection('products', p));
        products = DB.getCollection('products');
    }
    
    if (category && category !== 'all') {
        products = products.filter(p => p.category === category);
    }
    
    document.getElementById('shopCategories').innerHTML = `
        <span class="category-tab ${!category || category === 'all' ? 'active' : ''}" onclick="renderShopping('all')">전체</span>
        <span class="category-tab ${category === 'eye_clinic' ? 'active' : ''}" onclick="renderShopping('eye_clinic')">🏥 안과</span>
        <span class="category-tab ${category === 'lens' ? 'active' : ''}" onclick="renderShopping('lens')">👁️ 렌즈</span>
        <span class="category-tab ${category === 'glasses' ? 'active' : ''}" onclick="renderShopping('glasses')">🕶️ 안경</span>
        <span class="category-tab ${category === 'supplies' ? 'active' : ''}" onclick="renderShopping('supplies')">🧴 용품</span>
    `;
    
    document.getElementById('productGrid').innerHTML = products.length ? products.map(p => `
        <div class="product-card">
            <div class="product-emoji">${p.emoji || '🛒'}</div>
            <div class="product-name">${p.name}</div>
            <div class="product-desc">${p.description}</div>
            <div class="product-partner">${p.partner || ''}</div>
            <div class="product-price">${p.price.toLocaleString()}원</div>
        </div>
    `).join('') : `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🛍️</div><h3>준비 중입니다</h3></div>`;
}

// ==================== 설정 ====================
function renderSettings() {
    const user = DB.getCurrentUser();
    if (!user) return;
    const s = user.settings || {};
    
    document.getElementById('settingsContent').innerHTML = `
        <div class="card text-center">
            <p class="text-sm text-muted">현재 위험군</p>
            <span class="risk-badge" style="display:inline-block;margin-top:4px;padding:6px 20px;font-size:1.1rem;background:${riskColor(s.riskGroup)};">
                ${riskLabel(s.riskGroup)}
            </span>
        </div>
        <form onsubmit="return saveSettings(event)">
            <div class="card">
                <div class="card-header"><span class="card-title">🔔 알림 설정</span></div>
                <div class="card-body">
                    <div class="toggle-group">
                        <div><div class="toggle-label">알림 활성화</div><div class="toggle-desc">푸시 알림을 받습니다</div></div>
                        <label class="toggle-switch"><input type="checkbox" id="setNotif" ${s.notificationEnabled !== false ? 'checked' : ''}><span class="toggle-slider"></span></label>
                    </div>
                    <div class="form-group mt-3">
                        <label class="form-label">자가진단 알림 주기</label>
                        <select id="setFreq" class="form-select">
                            <option value="monthly" ${s.notificationFreq === 'monthly' ? 'selected' : ''}>한 달에 한 번</option>
                            <option value="biweekly" ${s.notificationFreq === 'biweekly' ? 'selected' : ''}>2주에 한 번</option>
                            <option value="weekly" ${s.notificationFreq === 'weekly' ? 'selected' : ''}>일주일에 한 번</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><span class="card-title">📹 측정 설정</span></div>
                <div class="card-body">
                    <div class="toggle-group">
                        <div><div class="toggle-label">영상 시청 중 측정</div><div class="toggle-desc">시청 중 눈 건강 데이터 측정 동의</div></div>
                        <label class="toggle-switch"><input type="checkbox" id="setVideo" ${s.videoConsent ? 'checked' : ''}><span class="toggle-slider"></span></label>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><span class="card-title">📢 광고 설정</span></div>
                <div class="card-body">
                    <div class="toggle-group">
                        <div><div class="toggle-label">광고 표시</div><div class="toggle-desc">제휴 상품 및 서비스 추천</div></div>
                        <label class="toggle-switch"><input type="checkbox" id="setAd" ${s.adEnabled !== false ? 'checked' : ''}><span class="toggle-slider"></span></label>
                    </div>
                    <p class="text-xs text-muted mt-2">구독 시 광고가 제거됩니다.</p>
                </div>
            </div>
            <button type="submit" class="btn btn-primary">설정 저장</button>
        </form>
    `;
}

function saveSettings(event) {
    event.preventDefault();
    const user = DB.getCurrentUser();
    if (!user) return false;
    
    user.settings = user.settings || {};
    user.settings.notificationEnabled = document.getElementById('setNotif').checked;
    user.settings.notificationFreq = document.getElementById('setFreq').value;
    user.settings.videoConsent = document.getElementById('setVideo').checked;
    user.settings.adEnabled = document.getElementById('setAd').checked;
    DB.saveUser(user.id, user);
    
    mainFlash('설정이 저장되었습니다.', 'success');
    return false;
}

// ==================== 마이페이지 ====================
function renderMyPage() {
    const user = DB.getCurrentUser();
    if (!user) return;
    
    const diagnoses = DB.getMyCollection('diagnoses');
    const activeSub = DB.getMyCollection('subscriptions').find(s => s.active);
    const consents = user.consents || {};
    
    document.getElementById('myPageContent').innerHTML = `
        <div class="card profile-card">
            <div class="profile-avatar">${(user.name || user.id)[0]}</div>
            <div class="profile-name">${user.name || user.id}</div>
            <div class="profile-email">${user.email || '이메일 미등록'}</div>
            <span class="risk-badge" style="display:inline-block;margin-top:8px;background:${riskColor(user.settings?.riskGroup)};">${riskLabel(user.settings?.riskGroup)}</span>
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">💎 구독 정보</span><a href="#" class="text-sm" onclick="showPage('subscription')">관리</a></div>
            <div class="card-body">${activeSub ? `<div class="info-row"><span class="info-label">상태</span><span class="info-value" style="color:var(--secondary);">구독중 ✓</span></div><div class="info-row"><span class="info-label">시작일</span><span class="info-value">${activeSub.startDate}</span></div>` : '<p class="text-muted text-sm">구독하지 않은 상태입니다.</p><a href="#" class="btn btn-accent btn-sm mt-2" style="width:auto;display:inline-block;" onclick="showPage(\'subscription\')">💎 구독하기 (1,900원)</a>'}</div>
        </div>
        ${Object.keys(consents).length ? `<div class="card">
            <div class="card-header"><span class="card-title">📄 동의 현황</span></div>
            <div class="card-body">
                ${Object.entries(consents).map(([k, v]) => `<div class="info-row"><span class="info-label">${consentLabel(k)}</span><span class="info-value">${v ? '✅' : '❌'}</span></div>`).join('')}
            </div>
        </div>` : ''}
        <div class="card">
            <div class="card-header"><span class="card-title">📊 자가진단 히스토리</span></div>
            <div class="card-body">${diagnoses.length ? diagnoses.slice(-10).reverse().map(d => `
                <div class="info-row"><span class="info-label">${d.date}</span><span><span class="risk-badge" style="font-size:0.7rem;padding:2px 8px;background:${riskColor(d.riskGroup)};">${d.totalScore}점</span></span></div>
            `).join('') : '<div class="text-center text-muted text-sm p-3">자가진단 기록이 없습니다.</div>'}</div>
        </div>
        <div class="flex flex-col gap-2 mt-4">
            <button class="btn btn-secondary" onclick="switchTab('settings')">⚙️ 알림 설정</button>
            <button class="btn btn-secondary" onclick="showPage('customerCenter')">📞 고객센터</button>
            <button class="btn btn-secondary" onclick="showPage('healthData')">📊 건강 데이터</button>
            <button class="btn btn-danger mt-2" onclick="logout()">🚪 로그아웃</button>
        </div>
    `;
}

function consentLabel(key) {
    const labels = {
        service_terms: '서비스 이용약관', privacy_collection: '개인정보 수집/이용',
        third_party_sharing: '제3자 제공', data_storage: '정보 저장',
        camera_access: '카메라 접근', notification: '알림',
        anonymized_data: '비식별 데이터', marketing_optin: '마케팅 수신'
    };
    return labels[key] || key;
}

// ==================== 건강 데이터 ====================
function renderHealthData() {
    const metrics = DB.getMyCollection('metrics');
    const diagnoses = DB.getMyCollection('diagnoses');
    const blinks = DB.getMyCollection('blinkLogs');
    
    let html = '';
    
    // 측정 데이터
    html += `<div class="card"><div class="card-header"><span class="card-title">📏 측정 데이터 기록</span></div>`;
    if (metrics.length) {
        html += `<div style="overflow-x:auto;"><table class="data-table"><thead><tr><th>날짜</th><th>피로도</th><th>건조감</th><th>충혈</th><th>깜빡임</th></tr></thead><tbody>`;
        metrics.slice(-10).reverse().forEach(m => {
            html += `<tr><td>${m.date}</td><td>${m.fatigue || '-'}</td><td>${m.dryness || '-'}</td><td>${m.redness || '-'}</td><td>${m.blink || '-'}</td></tr>`;
        });
        html += `</tbody></table></div>`;
    } else {
        html += `<div class="empty-state"><div class="empty-icon">📭</div><h3>측정 데이터가 없습니다</h3></div>`;
    }
    html += `</div>`;
    
    // 진단 기록
    html += `<div class="card"><div class="card-header"><span class="card-title">📋 자가진단 기록</span></div>`;
    if (diagnoses.length) {
        diagnoses.slice(-10).reverse().forEach(d => {
            html += `<div class="info-row"><span class="info-label">${d.date}</span><span><span class="risk-badge" style="font-size:0.7rem;padding:2px 8px;background:${riskColor(d.riskGroup)};">${d.totalScore}점</span></span></div>`;
        });
    } else {
        html += `<div class="empty-state"><div class="empty-icon">📋</div><h3>자가진단 기록이 없습니다</h3></div>`;
    }
    html += `</div>`;
    
    // 깜빡임 로그
    html += `<div class="card"><div class="card-header"><span class="card-title">👁️ 깜빡임 로그</span></div>`;
    if (blinks.length) {
        html += `<div style="overflow-x:auto;"><table class="data-table"><thead><tr><th>시간</th><th>총 깜빡임</th><th>분당</th></tr></thead><tbody>`;
        blinks.slice(-10).reverse().forEach(b => {
            html += `<tr><td>${(b.createdAt || '').slice(0, 16)}</td><td>${b.total || '-'}</td><td>${b.bpm || '-'}</td></tr>`;
        });
        html += `</tbody></table></div>`;
    } else {
        html += `<div class="empty-state"><div class="empty-icon">👁️</div><h3>측정 로그가 없습니다</h3></div>`;
    }
    html += `</div>`;
    
    document.getElementById('healthDataContent').innerHTML = html;
}

// ==================== 구독 ====================
function renderSubscription() {
    const subs = DB.getMyCollection('subscriptions');
    const active = subs.find(s => s.active);
    
    if (active) {
        document.getElementById('subscriptionContent').innerHTML = `
            <div class="subscription-card" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div style="font-size:3rem;margin-bottom:8px;">🌟</div>
                <div style="font-size:1.1rem;opacity:0.9;">구독중</div>
                <div class="sub-price">월 ${active.price.toLocaleString()}원</div>
                <div class="sub-period">${active.startDate} ~ ${active.endDate}</div>
            </div>
            <div class="card"><div class="card-header"><span class="card-title">✅ 구독 혜택</span></div>
                <ul class="subscription-benefits">
                    <li><span class="benefit-icon">🚫</span> 광고 제거</li>
                    <li><span class="benefit-icon">📊</span> 장기 PHR 분석 리포트 제공</li>
                    <li><span class="benefit-icon">🎁</span> 매월 10명 추첨 온열안대 증정</li>
                    <li><span class="benefit-icon">💝</span> 제휴 상품 할인 쿠폰</li>
                </ul>
            </div>
            <button class="btn btn-danger" onclick="cancelSubscription()">구독 취소</button>
        `;
    } else {
        document.getElementById('subscriptionContent').innerHTML = `
            <div class="subscription-card" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div style="font-size:3rem;margin-bottom:8px;">👁️</div>
                <div style="font-size:0.9rem;opacity:0.85;">프리미엄 구독</div>
                <div class="sub-price">월 1,900원</div>
                <div class="sub-period">부담없는 가격으로 프리미엄 케어</div>
            </div>
            <div class="card"><div class="card-header"><span class="card-title">🎁 구독 혜택</span></div>
                <ul class="subscription-benefits">
                    <li><span class="benefit-icon">🚫</span> 광고 제거</li>
                    <li><span class="benefit-icon">📊</span> 장기 PHR 분석 리포트 제공</li>
                    <li><span class="benefit-icon">🎁</span> 매월 10명 추첨 온열안대 증정</li>
                    <li><span class="benefit-icon">💝</span> 제휴 상품 할인 쿠폰</li>
                </ul>
            </div>
            <button class="btn btn-accent btn-lg" onclick="subscribe()">💎 월 1,900원 구독하기</button>
            <p class="text-xs text-muted text-center mt-3">※ 실제 결제는 구현되지 않은 UI입니다.</p>
        `;
    }
}

function subscribe() {
    const user = DB.getCurrentUser();
    if (!user) return;
    
    const start = today();
    const end = addDays(start, 30);
    
    DB.addToMyCollection('subscriptions', {
        startDate: start, endDate: end, active: true, price: 1900, autoRenew: true
    });
    
    flash('구독이 시작되었습니다! 1,900원 (UI만 구현)', 'success');
    showPage('subscription');
}

function cancelSubscription() {
    if (!confirm('정말 구독을 취소하시겠습니까?')) return;
    const subs = DB.getMyCollection('subscriptions');
    const active = subs.find(s => s.active);
    if (active) {
        DB.updateInCollection('subscriptions', active.id, { active: false });
        flash('구독이 취소되었습니다.', 'info');
        showPage('subscription');
    }
}

// ==================== 고객센터 ====================
function renderCustomerCenter() {
    let html = `
        <div class="card"><div class="card-header"><span class="card-title">❓ 자주 묻는 질문</span></div>
        <div class="card-body">${FAQS.map((f, idx) => `
            <div class="faq-item" data-idx="${idx}">
                <div class="faq-question">${f.q}</div>
                <div class="faq-answer" style="display:none;">${f.a}</div>
            </div>
        `).join('')}</div></div>
        <div class="card"><div class="card-header"><span class="card-title">📮 문의하기</span></div>
        <div class="card-body">
            <div class="info-row"><span class="info-label">📧 이메일</span><span class="info-value">eye@eye-care-phr.com</span></div>
            <div class="info-row"><span class="info-label">⏰ 응답 시간</span><span class="info-value">평일 기준 24시간 이내</span></div>
            <div class="info-row"><span class="info-label">🕐 운영 시간</span><span class="info-value">평일 09:00 - 18:00</span></div>
        </div></div>
        <div class="card"><div class="card-header"><span class="card-title">ℹ️ 앱 정보</span></div>
        <div class="card-body">
            <div class="info-row"><span class="info-label">앱 이름</span><span class="info-value">Eye Care PHR</span></div>
            <div class="info-row"><span class="info-label">버전</span><span class="info-value">v1.0.0</span></div>
        </div></div>
        <div class="card"><div class="card-header"><span class="card-title">📋 데이터 수집 안내</span></div>
        <div style="overflow-x:auto;"><table class="data-table"><thead><tr><th>데이터 유형</th><th>수집 방식</th><th>활용 목적</th></tr></thead><tbody>
            <tr><td>눈 피로도</td><td>자가 입력</td><td>피로 변화 추적</td></tr>
            <tr><td>건조감·충혈감</td><td>자가 입력</td><td>안구건조 위험 분석</td></tr>
            <tr><td>통증·흐릿함</td><td>자가 입력</td><td>안과 방문 권고 기준</td></tr>
            <tr><td>렌즈 착용 시간</td><td>앱 타이머 기록</td><td>장시간 착용 위험 분석</td></tr>
            <tr><td>인공눈물 사용 횟수</td><td>자가 입력</td><td>건조 증상 관리</td></tr>
            <tr><td>화면 사용 습관</td><td>자가 입력</td><td>눈 피로 위험도 분석</td></tr>
            <tr><td>깜빡임 횟수</td><td>카메라 측정</td><td>안구건조 위험 분석</td></tr>
            <tr><td>안과 검진 기록</td><td>자가 입력</td><td>장기 눈 건강 관리</td></tr>
        </tbody></table></div></div>
    `;
    document.getElementById('customerCenterContent').innerHTML = html;
    
    // FAQ 아코디언
    document.querySelectorAll('.faq-item').forEach(el => {
        const q = el.querySelector('.faq-question');
        const a = el.querySelector('.faq-answer');
        if (q && a) {
            q.addEventListener('click', () => {
                el.classList.toggle('open');
                a.style.display = el.classList.contains('open') ? 'block' : 'none';
            });
        }
    });
}

// ==================== 측정 (시뮬레이션) ====================
function startMeasurement() {
    const btn = document.getElementById('startMeasure');
    const timer = document.getElementById('measureTimer');
    const status = document.getElementById('measureStatus');
    const result = document.getElementById('measureResult');
    let seconds = 180;
    
    btn.disabled = true;
    btn.textContent = '측정 중...';
    status.textContent = '눈 깜빡임을 측정하고 있습니다...';
    result.style.display = 'none';
    
    const interval = setInterval(() => {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        timer.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;
        seconds--;
        
        if (seconds < 0) {
            clearInterval(interval);
            timer.textContent = '측정 완료!';
            status.textContent = '데이터를 분석하고 있습니다...';
            
            // 시뮬레이션 데이터
            const data = {
                fatigue: Math.floor(Math.random() * 60) + 20,
                dryness: Math.floor(Math.random() * 10),
                redness: Math.floor(Math.random() * 8),
                blink: Math.floor(Math.random() * 400) + 200,
                bpm: (Math.random() * 10 + 5).toFixed(1)
            };
            
            // 저장
            DB.addToMyCollection('metrics', {
                date: today(), fatigue: data.fatigue, dryness: data.dryness,
                redness: data.redness, blink: data.blink, screenTime: 3
            });
            DB.addToMyCollection('blinkLogs', {
                total: data.blink, bpm: data.bpm, date: today()
            });
            
            document.getElementById('mFatigue').textContent = data.fatigue;
            document.getElementById('mDryness').textContent = data.dryness;
            document.getElementById('mRedness').textContent = data.redness;
            document.getElementById('mBlink').textContent = data.blink;
            document.getElementById('mBpm').textContent = data.bpm;
            result.style.display = 'block';
            status.textContent = '측정이 완료되었습니다!';
            btn.disabled = false;
            btn.textContent = '다시 측정하기';
        }
    }, 1000);
}

// ==================== 헬퍼 함수 ====================
function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d, days) {
    const date = new Date(d);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function riskColor(rg) {
    return { normal: '#4CAF50', caution: '#FF9800', risk: '#f44336' }[rg] || '#4CAF50';
}

function riskLabel(rg) {
    return { normal: '일반군', caution: '주의군', risk: '위험군' }[rg] || '일반군';
}

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', function() {
    // 초기 진단 문항 렌더링
    renderQuestions(INITIAL_QUESTIONS, 'diagnosisQuestions');
    renderQuestions(REGULAR_QUESTIONS, 'regularDiagQuestions');
    
    // 로그인 상태 확인
    const user = DB.getCurrentUser();
    if (user) {
        if (!user.consents) {
            showPage('consent');
        } else if (!user.onboardingComplete) {
            showPage('welcome');
        } else {
            showPage('main');
        }
    } else {
        showPage('login');
    }
});
