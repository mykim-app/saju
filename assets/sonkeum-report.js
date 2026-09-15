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

// 손금 기초 그림 — 실제 사진을 분석해 그린 게 아니라, 네 가지 선이 보통
// 어느 자리에 있는지 보여 주는 일반적인 참고 그림이다. 사람마다 손 모양이
// 달라 실제 위치는 사진마다 조금씩 다를 수 있다.
const LINE_INFO = [
  { n: 1, name: "생명선", color: "#c23b2b", desc: "엄지 뿌리를 감싸며 손목 쪽으로 내려가는 줄입니다. 체력·건강 성향, 삶에 대한 열정을 본다고 알려져 있습니다." },
  { n: 2, name: "두뇌선", color: "#24466b", desc: "손바닥 가운데를 가로지르는 줄입니다. 사고방식·집중력·판단력을 본다고 알려져 있습니다." },
  { n: 3, name: "감정선", color: "#2f7d5b", desc: "손가락 아래쪽을 가로지르는 줄입니다. 감정 표현과 애정 성향을 본다고 알려져 있습니다." },
  { n: 4, name: "운명선", color: "#737a84", desc: "손목에서 가운뎃손가락 쪽으로 올라가는 줄입니다. 있는 사람도, 뚜렷하지 않은 사람도 있으며 직업·인생의 방향을 본다고 알려져 있습니다." },
];

function badge(cx, cy, color, n) {
  return `<circle cx="${cx}" cy="${cy}" r="13" fill="#f8faf6" stroke="${color}" stroke-width="2"/>
    <text x="${cx}" y="${cy + 1}" font-size="15" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="${color}">${n}</text>`;
}

export function handDiagramSection() {
  const svg = `
  <svg viewBox="0 0 320 400" role="img" aria-label="손금 네 가지 선의 위치를 보여 주는 참고 그림" style="width:100%;max-width:260px;display:block;margin:0 auto">
    <path d="M100,392 C83,372 76,344 76,306 L76,186 C76,170 89,159 100,159 C111,159 120,170 120,186
             L120,132 C120,113 135,102 146,102 C157,102 170,113 170,132
             L170,100 C170,81 185,70 196,70 C207,70 220,81 220,100
             L220,142 C220,123 233,112 244,112 C255,112 265,123 265,142
             L265,226 C265,318 252,368 228,392 Z" fill="#f8faf6" stroke="#c6d0c9" stroke-width="3"/>
    <path d="M76,286 C46,278 24,258 17,232 C11,208 22,188 42,190 C60,192 72,208 80,236 L86,278 Z"
          fill="#f8faf6" stroke="#c6d0c9" stroke-width="3"/>
    <path d="M84,148 C130,132 205,130 256,152" fill="none" stroke="#2f7d5b" stroke-width="5" stroke-linecap="round"/>
    <path d="M78,198 C122,215 180,222 244,202" fill="none" stroke="#24466b" stroke-width="5" stroke-linecap="round"/>
    <path d="M112,160 C90,168 76,198 74,240 C72,282 82,335 106,378" fill="none" stroke="#c23b2b" stroke-width="5" stroke-linecap="round"/>
    <path d="M148,385 C150,300 153,200 158,140" fill="none" stroke="#737a84" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 11"/>
    ${badge(106, 378, "#c23b2b", 1)}
    ${badge(244, 202, "#24466b", 2)}
    ${badge(256, 152, "#2f7d5b", 3)}
    ${badge(149, 360, "#737a84", 4)}
  </svg>`;
  const legend = LINE_INFO.map((l) => `<li><span class="dot" style="background:${l.color}">${l.n}</span><b>${l.name}</b> ${l.desc}</li>`).join("");
  return `
  <section class="rsec handmap" data-pdf-block>
    <h2>손금 기초 알아보기</h2>
    ${svg}
    <ul class="handmap-legend">${legend}</ul>
    <p class="hint">실제 사진을 분석해 그린 그림이 아니라, 네 선이 보통 어느 자리에 있는지 보여 주는 일반적인 참고 그림입니다. 손 모양은 사람마다 달라 실제 위치는 사진마다 조금씩 다를 수 있습니다.</p>
  </section>`;
}
