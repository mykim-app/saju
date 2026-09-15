/* AI가 "## 제목" 형식으로 준 손금 풀이 글을 화면 구성에 맞춰 절로 나눈다.
   sonkeum.js(입력 화면)와 admin.js(관리자 기록 다시 보기)가 함께 쓴다.
   AI가 만든 글이라 있는 그대로 믿지 않고 반드시 이스케이프부터 한 뒤에
   굵게(**) 표시만 옮긴다 — 사진 속에 숨겨진 지시문 등으로 이상한 태그가
   들어와도 화면에 그대로 문자로만 보이고 실행되지 않는다. */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderReading(text) {
  const blocks = String(text ?? "").split(/\n(?=##\s)/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b) => {
    const m = /^##\s*(.+?)\s*\n([\s\S]*)$/.exec(b);
    const title = m ? m[1] : "";
    const bodyRaw = m ? m[2].trim() : b;
    const body = bodyRaw.split(/\n{2,}/).filter(Boolean)
      .map((para) => `<p>${esc(para).replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</p>`).join("");
    return `<section class="rsec" data-pdf-block>${title ? `<h2>${esc(title)}</h2>` : ""}${body}</section>`;
  }).join("");
}

// 손금 기초 그림 — 실제 사진을 분석해 그린 게 아니라, 네 가지 선이 손금
// 사진에서 보통 어떤 모양으로 보이는지 하나씩 나눠서 보여 주는 일반적인
// 참고 그림이다(손바닥을 확대한 모양 + 그 줄만 색으로 표시). 사람마다 손
// 모양이 달라 실제 위치·굵기는 사진마다 조금씩 다를 수 있다.
const LINE_INFO = [
  { name: "생명선", color: "#c23b2b",
    path: "M30,10 Q10,70 25,130 Q40,175 65,195",
    desc: "엄지 뿌리를 감싸며 손목 쪽으로 내려가는 줄. 체력·건강 성향, 삶에 대한 열정을 본다고 알려져 있습니다." },
  { name: "두뇌선", color: "#24466b",
    path: "M10,80 Q90,95 150,80 Q185,72 200,60",
    desc: "손바닥 가운데를 가로지르는 줄. 사고방식·집중력·판단력을 본다고 알려져 있습니다." },
  { name: "감정선", color: "#2f7d5b",
    path: "M5,45 Q90,20 150,42 Q185,55 205,75",
    desc: "손가락 아래쪽을 가로지르는 줄. 감정 표현과 애정 성향을 본다고 알려져 있습니다." },
  { name: "운명선", color: "#737a84",
    path: "M100,195 L102,10",
    desc: "손목에서 가운뎃손가락 쪽으로 올라가는 줄. 있는 사람도, 뚜렷하지 않은 사람도 있으며 직업·인생의 방향을 본다고 알려져 있습니다." },
];

// 확대한 손바닥 살결처럼 보이도록, 짙은 색 줄 하나 + 옅은 다른 주름 두 개를 곁들인다.
function palmCard(l) {
  return `
  <div class="handcard">
    <svg viewBox="0 0 210 200" role="img" aria-label="${l.name} 위치 예시 그림">
      <rect width="210" height="200" rx="16" fill="#f4ece4"/>
      <path d="M-10,50 Q60,20 120,60 T220,95" fill="none" stroke="#e3d3c0" stroke-width="3"/>
      <path d="M-10,140 Q80,115 140,150 T220,135" fill="none" stroke="#e3d3c0" stroke-width="3"/>
      <path d="${l.path}" fill="none" stroke="${l.color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="1 14"/>
    </svg>
    <p class="handcard-name" style="color:${l.color}">${l.name}</p>
    <p class="hint">${l.desc}</p>
  </div>`;
}

export function handDiagramSection() {
  return `
  <section class="rsec handmap" data-pdf-block>
    <h2>손금 기초 알아보기</h2>
    <div class="handcard-grid">${LINE_INFO.map(palmCard).join("")}</div>
    <p class="hint">실제 사진을 분석해 그린 그림이 아니라, 각 줄이 보통 어떤 자리·모양으로 나타나는지 보여 주는 일반적인 참고 그림입니다. 손 모양은 사람마다 달라 실제 위치는 사진마다 조금씩 다를 수 있습니다.</p>
  </section>`;
}
