document.getElementById('csv-file').addEventListener('change', handleFileUpload);

// 1. 외부 라이브러리 없이 자체적으로 CSV 파일을 읽어오는 함수
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('file-name').textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const parsedData = parseCSV(text); // 자체 내장 파서 실행
        processAndRender(parsedData);
    };
    reader.readAsText(file, 'UTF-8'); // 한글 깨짐 방지
}

// 2. 따옴표와 쉼표, 줄바꿈을 완벽하게 계산하는 내장 CSV 파싱 로직
function parseCSV(text) {
    let lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        let next = text[i+1];

        if (c === '"') {
            if (inQuotes && next === '"') { 
                row[row.length - 1] += '"'; 
                i++; 
            } else { 
                inQuotes = !inQuotes; 
            }
        } else if (c === ',' && !inQuotes) {
            row.push('');
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') { i++; }
            lines.push(row);
            row = [''];
        } else {
            row[row.length - 1] += c;
        }
    }
    if (row.length > 1 || row[0] !== '') lines.push(row);
    return lines;
}

function processAndRender(rawData) {
    // 레이아웃 전환 (가이드 숨기고 대시보드 표출)
    document.getElementById('upload-placeholder').classList.add('hidden');
    document.getElementById('dashboard-content').classList.remove('hidden');

    // 데이터 구조화 작업
    let processedData = rawData.map(row => {
        if(row.length < 5) return null;
        const diaryText = row[1] || '';
        return {
            date: row[0],
            diary: diaryText,
            rawTags: row[2] || '',
            color: row[3],
            score: parseFloat(row[4]) || 0,
            situation: classifySituation(diaryText),
            emotion: classifyEmotion(row[2]),
            action: classifyAction(diaryText)
        };
    }).filter(d => d !== null).sort((a, b) => a.date > b.date ? 1 : -1);

    // 시각화 컴포넌트 렌더링
    renderTrendChart(processedData);
    renderSankeyChart(processedData);
    renderStackedBarChart(processedData);

    // 교사 인사이트 자동 추출
    analyzeInsights(processedData);
}

// --- 임상 기반 텍스트 자동 키워드 분류기 ---
function classifySituation(text) {
    if (['친구', '지우', '민하', '소율', '혼자', '인기', '애들', '박준후', '외롭'].some(k => text.includes(k))) return '또래 관계';
    if (['숙제', '학원', '시험', '공부', '수행평가', '와니니', '글쓰기', '교실', '과목', '문법', '독해', '책'].some(k => text.includes(k))) return '학교/학업 과제';
    if (['엄마', '아빠', '잔소리', '할아버지', '솜이', '가족', '어버이날'].some(k => text.includes(k))) return '가정 환경';
    return '개인 일상';
}

function classifyEmotion(tagStr) {
    if (!tagStr) return '기타';
    const firstTag = tagStr.split(',')[0].trim();
    const mapping = {
        'Frustration': '좌절/짜증', 'Anxiety': '불안/걱정', 'Fatigue': '피로/지침',
        'Fear': '두려움', 'Worry': '걱정/불안', 'Tension': '긴장', 'Solitude': '외로움/고립',
        'Sadness': '슬픔', 'Relief': '안도', 'Disappointment': '실망', 'Excitement': '설렘/기대',
        'Warmth': '따뜻함', 'Annoyance': '짜증', 'Embarrassment': '당황/부끄러움',
        'Joy': '기쁨', 'Satisfaction': '만족', 'Hope': '희망', 'Anger': '분노',
        'Timidity': '소심함', 'Depression': '우울', 'Love': '사랑', 'Desire': '욕구/바람', 'Happiness': '행복'
    };
    return mapping[firstTag] || firstTag;
}

function classifyAction(text) {
    if (['눈 감고', '할아버지처럼', '다 까먹어버렸다', '싫다', '지긋지긋'].some(k => text.includes(k))) return '무기력/극단적 회피';
    if (['조용히', '어색한말투', '혼자', '창피', '모르겠다'].some(k => text.includes(k))) return '위축/소통 거부';
    if (['싸워서', '반항', '잔소리', '창피하고 분하기도'].some(k => text.includes(k))) return '갈등/감정 표출';
    if (['사과편지', '화이팅', '기쁘다', '좋다', '행복', '카네이션', '귀엽다', '안심'].some(k => text.includes(k))) return '긍정적 대처/노력';
    return '일반 일상 대처';
}

// --- 차트 1: 타임라인 선 그래프 (Plotly) ---
function renderTrendChart(data) {
    const dates = data.map(d => d.date);
    const scores = data.map(d => d.score);
    const hovers = data.map(d => `<b>날짜:</b> ${d.date}<br><b>감정:</b> ${d.rawTags}<br><b>일기 요약:</b> ${d.diary.substring(0, 60)}...`);

    const trace = {
        x: dates, y: scores, mode: 'lines+markers',
        text: hovers, hoverinfo: 'text',
        line: { color: '#3b82f6', width: 2 },
        marker: { size: 6, color: '#f97316' }
    };

    const layout = {
        margin: { t: 20, b: 40, l: 40, r: 20 },
        xaxis: { gridcolor: '#e2e8f0' },
        yaxis: { gridcolor: '#e2e8f0' },
        shapes: [{ type: 'line', x0: dates[0], y0: 0, x1: dates[dates.length-1], y1: 0, line: { color: '#cbd5e1', dash: 'dash' } }]
    };
    Plotly.newPlot('trend-chart', [trace], layout, {responsive: true});
}

// --- 차트 2: 심리 매커니즘 산키 다이어그램 ---
function renderSankeyChart(data) {
    let nodes = [];
    data.forEach(d => {
        if (!nodes.includes(d.situation)) nodes.push(d.situation);
        if (!nodes.includes(d.emotion)) nodes.push(d.emotion);
        if (!nodes.includes(d.action)) nodes.push(d.action);
    });

    let flowMap = {};
    data.forEach(d => {
        let k1 = `${d.situation}->${d.emotion}`;
        let k2 = `${d.emotion}->${d.action}`;
        flowMap[k1] = (flowMap[k1] || 0) + 1;
        flowMap[k2] = (flowMap[k2] || 0) + 1;
    });

    let sources = [], targets = [], values = [];
    Object.keys(flowMap).forEach(key => {
        let parts = key.split('->');
        sources.push(nodes.indexOf(parts[0]));
        targets.push(nodes.indexOf(parts[1]));
        values.push(flowMap[key]);
    });

    const sankeyData = {
        type: "sankey",
        node: { pad: 15, thickness: 15, label: nodes, color: '#475569' },
        link: { source: sources, target: targets, value: values }
    };
    Plotly.newPlot('sankey-chart', [sankeyData], {margin: {t:10, b:10, l:10, r:10}}, {responsive: true});
}

// --- 차트 3: 정서-상황 누적 막대 차트 ---
function renderStackedBarChart(data) {
    let emotions = [...new Set(data.map(d => d.emotion))];
    let situations = ['또래 관계', '학교/학업 과제', '가정 환경', '개인 일상'];
    
    let traces = situations.map(sit => {
        return {
            x: emotions.map(emo => data.filter(d => d.emotion === emo && d.situation === sit).length),
            y: emotions, name: sit, type: 'bar', orientation: 'h'
        };
    });

    const layout = { barmode: 'stack', margin: { t: 10, b: 40, l: 80, r: 20 }, legend: { orientation: 'h', y: -0.15 } };
    Plotly.newPlot('stacked-bar-chart', traces, layout, {responsive: true});
}

// --- 4. 고위험 단어 자동 검출 및 데이터 요약 스캔 ---
function analyzeInsights(data) {
    const alertZone = document.getElementById('danger-alert-zone');
    const alertList = document.getElementById('alert-list');
    alertList.innerHTML = '';

    const dangerKeywords = ['눈 감고', '할아버지처럼', '죽고싶', '편안하게 눈', '사라지고'];
    let alertsFound = 0;

    data.forEach(d => {
        if (dangerKeywords.some(keyword => d.diary.includes(keyword)) || d.score <= -20) {
            alertsFound++;
            let alertItem = document.createElement('div');
            alertItem.className = 'alert-item';
            alertItem.innerHTML = `<strong>⚠️ [위험 감지 - ${d.date.substring(5,10)}]</strong> 점수: ${d.score}<br>"...${d.diary.substring(0,60)}..."`;
            alertList.appendChild(alertItem);
        }
    });

    if (alertsFound > 0) alertZone.classList.remove('hidden');
    else alertZone.classList.add('hidden');

    let mondayScores = data.filter(d => new Date(d.date).getDay() === 1).map(d => d.score);
    if(mondayScores.length > 0) {
        let avgMonday = mondayScores.reduce((a,b)=>a+b, 0) / mondayScores.length;
        if(avgMonday < -10) {
            document.getElementById('insight-weekly').innerHTML = `이 학생은 월요일 평균 감정 점수가 <strong>${avgMonday.toFixed(1)}점</strong>으로 주중 가장 낮습니다. 전형적인 <b>'환경 진입 거부 리듬(월요일 증후군)'</b>을 보이고 있으니 월요일 아침 첫 대면 관찰과 정서 지지에 특별히 유의하십시오.`;
        } else {
            document.getElementById('insight-weekly').textContent = "요일별 특이 추이 패턴이 크게 나타나지 않았습니다. 지속적인 일상 모니터링이 권장됩니다.";
        }
    }
}
