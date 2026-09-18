import { PALACE_MEANING, MAJOR_STAR_MEANING, MINOR_STAR_MEANING, SIHUA_MEANING, FIVE_ELEMENT_CLASS } from "./jami-data.js";
import { soulPalace, bodyPalace, brightnessOf, allStarsOf } from "./jami-core.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function section(title, inner, id) {
  return `<section class="rsec" data-pdf-block${id ? ` id="${id}"` : ""}><h2>${esc(title)}</h2>${inner}</section>`;
}

function starTag(s) {
  const b = brightnessOf(s.brightness);
  const cls = s.type === "major" ? "star-major" : s.type === "tianma" || s.type === "soft" || s.type === "lucun" ? "star-minor" : "star-adj";
  const parts = [esc(s.name)];
  if (b && b.label) parts.push(`<small class="star-b">${esc(b.label)}</small>`);
  if (s.mutagen) parts.push(`<small class="star-si">${esc(s.mutagen)}</small>`);
  return `<span class="star ${cls}">${parts.join(" ")}</span>`;
}

// 이 궁에 있는 주성·보조성 각각의 뜻을, 그 궁 카드 바로 안에서 하나씩 보여 준다
// (전에는 화면 맨 아래에 명반 전체 별을 한꺼번에 모아 뒀는데, 그러면 지금 보는
// 궁의 별이 무슨 뜻인지 알려면 한참 아래로 내려가야 해서 보기 불편했다).
function starMeaningList(p) {
  const items = [];
  for (const s of [...p.majorStars, ...p.minorStars]) {
    const desc = MAJOR_STAR_MEANING[s.name] || MINOR_STAR_MEANING[s.name];
    if (desc) items.push(`<li><b>${esc(s.name)}</b> ${esc(desc)}</li>`);
  }
  return items.length ? `<ul class="jami-glossary" style="margin-top:8px">${items.join("")}</ul>` : "";
}

function palaceCard(p, isSoul, isBody) {
  const meaning = PALACE_MEANING[p.name] || "";
  const stars = allStarsOf(p);
  const tags = [];
  if (isSoul) tags.push('<span class="tag good">명궁</span>');
  if (isBody) tags.push('<span class="tag good">신궁</span>');
  const label = p.name.endsWith("궁") ? p.name : `${p.name}궁`;
  return `
  <div class="jami-card">
    <div class="jami-card-head">
      <b>${esc(label)}</b> ${tags.join(" ")}
      <span class="gz">${esc(p.heavenlyStem)}${esc(p.earthlyBranch)}</span>
    </div>
    <p class="hint" style="margin:2px 0 8px">${esc(meaning)}</p>
    <div class="jami-stars">${stars.length ? stars.map(starTag).join(" ") : '<span class="hint">이 궁에는 뚜렷한 별이 없습니다(공궁). 맞은편 궁(대궁)의 별을 함께 봅니다.</span>'}</div>
    ${starMeaningList(p)}
    <p class="hint" style="margin-top:6px">12운 : ${esc(p.changsheng12)} · 대한 ${p.decadal.range[0]}~${p.decadal.range[1]}세</p>
  </div>`;
}

function glossarySection() {
  const sihuaList = Object.entries(SIHUA_MEANING).map(([k, v]) => `<li><b>${esc(k)}</b> ${esc(v)}</li>`).join("");
  return section("사화·밝기 표시가 뜻하는 것", `
    <p class="sub-h">사화(四化) — 별 이름 옆 작은 글자의 뜻</p>
    <ul class="jami-glossary">${sihuaList}</ul>
    <p class="hint">별 이름 옆 [묘][왕][득][리][평][부][함]은 그 자리에서 별의 기운이 얼마나 잘 드러나는지를 나타냅니다(묘가 가장 강하고, 함이 가장 약함). 각 궁의 별 뜻은 그 궁 카드 안에 바로 적어 두었습니다.</p>
  `);
}

export function renderJamiReport(name, astrolabe) {
  const soul = soulPalace(astrolabe), body = bodyPalace(astrolabe);
  const fec = FIVE_ELEMENT_CLASS[astrolabe.fiveElementsClass];
  const order = [];
  const soulIdx = astrolabe.palaces.findIndex((p) => p.name === "명궁");
  for (let i = 0; i < 12; i++) order.push(astrolabe.palaces[(soulIdx + i) % 12]);

  const head = `<header class="rhead" data-pdf-block>
    <h1>${esc(name)}님의 자미두수</h1>
    <p class="hint">${esc(astrolabe.gender)} · 양력 ${esc(astrolabe.solarDate)}(음력 ${esc(astrolabe.lunarDate)}) · ${esc(astrolabe.time)}(${esc(astrolabe.timeRange)})</p>
  </header>`;

  const summary = section("한눈에 보기", `
    <dl class="pairs">
      <div><dt>오행국</dt><dd>${esc(astrolabe.fiveElementsClass)} <span class="hint">${fec ? esc(fec.desc) : ""}</span></dd></div>
      <div><dt>명궁</dt><dd>${esc(soul.heavenlyStem)}${esc(soul.earthlyBranch)}궁 · ${soul.majorStars.length ? soul.majorStars.map((s) => esc(s.name)).join("·") : "주성 없음(공궁)"}</dd></div>
      <div><dt>신궁</dt><dd>${esc(body.name)}궁(${esc(body.heavenlyStem)}${esc(body.earthlyBranch)}) · ${body.majorStars.length ? body.majorStars.map((s) => esc(s.name)).join("·") : "주성 없음(공궁)"}</dd></div>
      <div><dt>사주</dt><dd>${esc(astrolabe.chineseDate)} <span class="hint">(참고용 — 사주풀이 계산과는 별개입니다)</span></dd></div>
    </dl>
    <p class="hint">자미두수는 명궁을 '체(體)', 신궁을 '용(用)'으로 봅니다. 명궁이 타고난 그릇이라면, 신궁은 특히 중년 이후 그 그릇을 실제로 살아가는 방식입니다.</p>
  `);

  const cards = order.map((p) => palaceCard(p, p.name === "명궁", p.isBodyPalace)).join("");
  const palacesSec = section("12궁 — 명궁부터 차례로", `<div class="jami-grid">${cards}</div>`);

  const glossary = glossarySection();

  const outro = `
  <section class="rsec outro" data-pdf-block>
    <p>자미두수는 유파에 따라 사화·밝기·별의 배치를 다르게 보기도 합니다. 여기서는 대만·홍콩에서 널리 쓰이는 기본 이론(남파)을 바탕으로 했습니다. 재미로 참고하시고, 중요한 결정의 근거로 쓰지 마세요.</p>
    <div class="actions no-print">
      <button class="btn" type="button" data-act="pdf">PDF로 저장</button>
      <button class="btn-ghost" type="button" data-act="print">인쇄</button>
    </div>
    <p class="hint no-print" data-pdf-hint>PDF 파일이 바로 내려받아집니다.</p>
    <p class="hint no-print" data-pdf-webview-warn hidden>지금 보고 계신 앱 안 화면에서는 파일 저장이 막힐 때가 있습니다. 오른쪽 위 메뉴(⋮ 또는 …)에서 <b>'다른 브라우저로 열기'</b>를 고른 뒤 다시 눌러 보세요.</p>
    <a class="btn no-print" data-act="pdf-fallback" hidden download style="text-decoration:none">PDF 파일 눌러서 저장</a>
  </section>`;

  return `<article class="report" data-pdf-root>
    ${head}
    ${summary}
    ${palacesSec}
    ${glossary}
    ${outro}
  </article>`;
}
