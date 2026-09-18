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

// 손금 기초 그림 — 실제 사진을 분석해 그린 게 아니라, 네 가지 선이 손바닥
// 전체에서 대략 어느 자리에 있는지 한 번에 보여 주는 일반적인 참고 그림이다.
// 이용자가 어느 손을 기준으로 풀이를 받았는지(handedness)에 맞춰 좌우를
// 뒤집어, 실제 자기 손을 보듯 자연스럽게 비교할 수 있게 한다.
const LINE_INFO = [
  { name: "생명선", color: "#c23b2b",
    desc: "엄지 뿌리를 감싸며 손목 쪽으로 내려가는 줄. 체력·건강 성향, 삶에 대한 열정을 본다고 알려져 있습니다." },
  { name: "두뇌선", color: "#24466b",
    desc: "손바닥 가운데를 가로지르는 줄. 사고방식·집중력·판단력을 본다고 알려져 있습니다." },
  { name: "감정선", color: "#2f7d5b",
    desc: "손가락 아래쪽을 가로지르는 줄. 감정 표현과 애정 성향을 본다고 알려져 있습니다." },
  { name: "운명선", color: "#8a7a68",
    desc: "손목에서 가운뎃손가락 쪽으로 올라가는 줄. 있는 사람도, 뚜렷하지 않은 사람도 있으며 직업·인생의 방향을 본다고 알려져 있습니다." },
];

// handedness: "right"|"left" — 왼손 기준이면 손 그림 전체를 좌우로 뒤집는다.
export function handDiagramSection(handedness) {
  const flip = handedness === "left";
  const legend = LINE_INFO.map((l) => `<li><span class="dot" style="background:${l.color}"></span><b style="color:${l.color}">${l.name}</b> ${l.desc}</li>`).join("");
  return `
  <section class="rsec handmap" data-pdf-block>
    <h2>손금 기초 알아보기</h2>
    <svg viewBox="0 0 300 400" role="img" aria-label="손바닥 전체와 네 가지 손금 선의 위치를 보여 주는 참고 그림" style="width:100%;max-width:220px;display:block;margin:0 auto">
      <g ${flip ? 'transform="scale(-1,1) translate(-300,0)"' : ""}>
        <path d="M75,180 L225,180 L225,300 C225,350 190,392 150,392 C110,392 75,350 75,300 Z" fill="#f4ece2" stroke="#d9c6ae" stroke-width="3"/>
        <rect x="82" y="70" width="34" height="118" rx="17" fill="#f4ece2" stroke="#d9c6ae" stroke-width="3"/>
        <rect x="133" y="40" width="34" height="148" rx="17" fill="#f4ece2" stroke="#d9c6ae" stroke-width="3"/>
        <rect x="184" y="55" width="34" height="133" rx="17" fill="#f4ece2" stroke="#d9c6ae" stroke-width="3"/>
        <rect x="228" y="90" width="30" height="98" rx="15" fill="#f4ece2" stroke="#d9c6ae" stroke-width="3"/>
        <path d="M78,240 C45,232 20,210 14,183 C9,160 22,142 42,146 C60,150 70,168 78,196 Z" fill="#f4ece2" stroke="#d9c6ae" stroke-width="3"/>
        <rect x="75" y="172" width="150" height="16" fill="#f4ece2"/>
        <path d="M85,210 C130,195 195,194 250,213" fill="none" stroke="#2f7d5b" stroke-width="7" stroke-linecap="round"/>
        <path d="M78,248 C125,262 190,266 245,244" fill="none" stroke="#24466b" stroke-width="7" stroke-linecap="round"/>
        <path d="M112,192 C90,202 76,228 74,265 C72,302 84,345 105,385" fill="none" stroke="#c23b2b" stroke-width="7" stroke-linecap="round"/>
        <path d="M150,388 C151,320 152,240 154,180" fill="none" stroke="#8a7a68" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 13"/>
      </g>
    </svg>
    <ul class="jami-glossary" style="margin-top:12px">${legend}</ul>
    <p class="hint">${handedness === "left" ? "왼손" : "오른손"} 기준으로 그린 그림입니다. 실제 사진을 분석해 그린 것이 아니라, 각 줄이 보통 어느 자리에 있는지 보여 주는 일반적인 참고 그림입니다. 손 모양은 사람마다 달라 실제 위치는 사진마다 조금씩 다를 수 있습니다.</p>
  </section>`;
}
