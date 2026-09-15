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
