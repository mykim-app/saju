import * as C from "./saju-core.js";
import * as G from "./compat-data.js";
import { analyzeCompat, sokAllowed } from "./compat.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const elName = (e) => `${C.ELEMENTS[e]}(${C.ELEMENTS_HJ[e]})`;
const gzText = (s, b) => `${C.STEMS[s]}${C.BRANCHES[b]}`;
const gzHj = (s, b) => `${C.STEMS_HJ[s]}${C.BRANCHES_HJ[b]}`;

function section(title, inner, id) {
  return `<section class="rsec" data-pdf-block ${id ? `id="${id}"` : ""}><h2>${title}</h2>${inner}</section>`;
}

function personLine(name, chart) {
  const s = chart.solar, P = chart.pillars;
  return `
    <div class="pcard">
      <p class="pcard-name">${esc(name)}</p>
      <p class="hint">${s.y}년 ${s.m}월 ${s.d}일${chart.input.timeUnknown ? "" : ` ${String(chart.clock.h).padStart(2, "0")}:${String(chart.clock.mi).padStart(2, "0")}`} · ${chart.input.gender === "M" ? "남성" : "여성"} · ${C.ANIMALS[P.year.b]}띠</p>
      <p class="pcard-ilju">${gzHj(P.day.s, P.day.b)} <span class="hint">${gzText(P.day.s, P.day.b)}일주 · 납음 ${C.nayin(P.day.s, P.day.b)}</span></p>
    </div>`;
}

export function renderCompatReport(nameA, chartA, nameB, chartB, opts = {}) {
  const relType = opts.relType || "romantic";
  const relLabel = G.REL_TYPE_LABEL[relType] || G.REL_TYPE_LABEL.romantic;
  const sok = sokAllowed(chartA, chartB, relType);
  const r = analyzeCompat(chartA, chartB, { sok });
  const tagOf = (tag) => tag === "good" ? "좋음" : tag === "warn" ? "조심" : "보통";

  const head = `
    <header class="rhead" data-pdf-block>
      <h1>${esc(nameA)}님과 ${esc(nameB)}님의 궁합</h1>
      <p class="hint" style="margin:2px 0 14px">${relLabel} 사이로 봤습니다.</p>
      <div class="row" style="gap:12px">${personLine(nameA, chartA)}${personLine(nameB, chartB)}</div>
    </header>`;

  // 한눈에 보기 — 가장 크게 작용한 요인 한두 개를 골라 문장으로
  const reasons = [];
  if (sok && r.dayBranch.tag !== "mid") reasons.push(`일지(부부·애정 자리)가 ${r.dayBranch.type}`);
  if (r.year.tag !== "mid") reasons.push(`띠(연지)가 ${r.year.type}`);
  if (r.dayStem.tag === "good") reasons.push(`일간끼리 ${r.dayStem.type}`);
  const summary = `
  <section class="rsec summary" data-pdf-block>
    <h2>한눈에 보기</h2>
    <dl class="pairs">
      <div><dt>전반적 일치도</dt><dd><span class="match-percent">${r.percent}%</span> <span class="hint">두 사람의 궁합 요소를 종합해 매긴 참고용 수치입니다.</span></dd></div>
      <div><dt>종합</dt><dd><span class="tag ${r.tier}">${r.label}</span> ${reasons.length ? reasons.join(", ") + "인 점이 크게 작용했습니다." : "두드러지게 좋거나 조심할 관계는 없는, 무난한 짜임입니다."}</dd></div>
      ${sok ? `<div><dt>일지 관계</dt><dd>${gzText(chartA.pillars.day.s, chartA.pillars.day.b)} · ${gzText(chartB.pillars.day.s, chartB.pillars.day.b)} — <b>${r.dayBranch.type}</b></dd></div>` : ""}
      <div><dt>띠 관계</dt><dd>${C.ANIMALS[chartA.pillars.year.b]}띠 · ${C.ANIMALS[chartB.pillars.year.b]}띠 — <b>${r.year.type}</b></dd></div>
    </dl>
  </section>`;

  const ddaeSec = section("띠 궁합(연지)", `
    <p><span class="tag ${r.year.tag}">${tagOf(r.year.tag)}</span> ${G.branchRelText(r.year.type, relType)}${r.year.el ? ` 두 사람의 기운이 합쳐지면 ${elName(C.ELEMENTS.indexOf(r.year.el))} 기운이 됩니다.` : ""}</p>
    <p class="hint">띠 궁합은 태어난 해의 지지(연지)로 보는, 가장 널리 알려진 궁합법입니다. 서로 만나는 자리(부부·연인·친구·동업 등)와 상관없이 보는 큰 틀의 궁합입니다.</p>`);

  const iljuSec = section("일간 궁합", `
    <p><span class="tag ${r.dayStem.tag}">${tagOf(r.dayStem.tag)}</span> ${typeof G.STEM_REL_TEXT[r.dayStem.type] === "string" ? G.STEM_REL_TEXT[r.dayStem.type] : G.STEM_REL_TEXT[r.dayStem.type][r.dayStem.dir]}${r.dayStem.el ? ` 두 기운이 합쳐지면 ${elName(C.ELEMENTS.indexOf(r.dayStem.el))} 기운이 됩니다.` : ""}</p>
    <p class="hint">일간은 태어난 날의 천간으로, 나 자신을 뜻합니다. 성향이나 대화 방식이 얼마나 잘 맞는지를 봅니다.</p>`);

  // 속궁합은 연인·부부 사이일 때만 다룬다. 친구·동료, 가족 사이라면 아예 다루지 않는다(조건 안내도 필요 없음).
  const sokSec = relType !== "romantic" ? "" : section("속궁합", sok ? `
    <p class="sub-h">일지(땅의 기운, 배우자 자리)끼리</p>
    <p><span class="tag ${r.dayBranch.tag}">${tagOf(r.dayBranch.tag)}</span> ${G.branchRelText(r.dayBranch.type, relType)}${r.dayBranch.el ? ` 두 사람의 기운이 합쳐지면 ${elName(C.ELEMENTS.indexOf(r.dayBranch.el))} 기운이 됩니다.` : ""}</p>
    <p class="hint">일지는 배우자 자리로 보아, 애정·결혼 궁합에서는 다른 무엇보다 이 관계를 무겁게 봅니다.</p>
    <p class="sub-h">납음오행</p>
    <p><span class="tag ${r.nayin.tag}">${tagOf(r.nayin.tag)}</span> ${G.NAYIN_REL_TEXT[r.nayin.type]}</p>
    <p class="hint">${C.nayin(chartA.pillars.day.s, chartA.pillars.day.b)}(${elName(r.nayin.ea)}) · ${C.nayin(chartB.pillars.day.s, chartB.pillars.day.b)}(${elName(r.nayin.eb)}) — 태어난 날의 육십갑자에 붙는 전통적인 오행입니다.</p>
  ` : `
    <p class="hint">속궁합(배우자 자리·납음오행)은 두 사람 모두 만 20세 이상이고 남녀 한 쌍일 때만 보여 드립니다.</p>
  `);

  const tgSec = section("서로에게 어떤 자리인지(십성)", `
    <p><b>${esc(nameB)}님</b>은 ${esc(nameA)}님에게 — ${G.tenGodCompatText(r.tgBonA, relType)} <span class="hint">(${C.TEN_GODS[r.tgBonA]})</span></p>
    <p><b>${esc(nameA)}님</b>은 ${esc(nameB)}님에게 — ${G.tenGodCompatText(r.tgAonB, relType)} <span class="hint">(${C.TEN_GODS[r.tgAonB]})</span></p>
    <p class="hint">십성은 상대의 일간을 내 일간 기준으로 보았을 때의 관계입니다. 두 사람이 서로에게 같은 자리로 보이지 않는 것이 자연스럽습니다.</p>`);

  const flowSec = section("오행으로 서로 채워 주는 정도", `
    <p>${esc(nameA)}님에게 필요한 기운(${elName(r.ysA.useEl)}·${elName(r.ysA.helpEl)})이 ${esc(nameB)}님의 사주에 ${r.helpForA ? `${r.helpForA}개 있어 도움이 됩니다.` : "뚜렷하게 있지는 않습니다."}${r.hurtForA ? ` 다만 ${esc(nameA)}님이 조심할 ${elName(r.ysA.avoidEl)} 기운도 ${r.hurtForA}개 있습니다.` : ""}</p>
    <p>${esc(nameB)}님에게 필요한 기운(${elName(r.ysB.useEl)}·${elName(r.ysB.helpEl)})이 ${esc(nameA)}님의 사주에 ${r.helpForB ? `${r.helpForB}개 있어 도움이 됩니다.` : "뚜렷하게 있지는 않습니다."}${r.hurtForB ? ` 다만 ${esc(nameB)}님이 조심할 ${elName(r.ysB.avoidEl)} 기운도 ${r.hurtForB}개 있습니다.` : ""}</p>
    <p class="hint">각자의 사주에서 부족하거나 필요한 기운(용신·희신)을 상대가 지니고 있으면, 서로 기대고 채워 주는 관계로 봅니다.</p>`);

  const outro = `
    <section class="rsec outro" data-pdf-block>
      <p>궁합을 보는 방법은 무엇을 더 크게 볼지에 따라 유파와 문헌마다 차이가 큽니다. 여기서는 널리 쓰이는 몇 가지 방법을 소개하는 수준으로 다뤘습니다. 재미로 참고하시고, 실제 관계는 두 사람이 함께 만들어 가는 것임을 잊지 마세요.</p>
      ${opts.hidePrint ? "" : `<div class="actions no-print">
        <button class="btn" type="button" data-act="pdf">PDF로 저장</button>
        <button class="btn-ghost" type="button" data-act="print">인쇄</button>
      </div>
      <p class="hint no-print" data-pdf-hint>PDF 파일이 바로 내려받아집니다.</p>
      <p class="hint no-print" data-pdf-webview-warn hidden>지금 보고 계신 앱 안 화면에서는 파일 저장이 막힐 때가 있습니다. 오른쪽 위 메뉴(⋮ 또는 …)에서 <b>‘다른 브라우저로 열기’</b>를 고른 뒤 다시 눌러 보세요.</p>
      <a class="btn no-print" data-act="pdf-fallback" hidden download style="text-decoration:none">PDF 파일 눌러서 저장</a>`}
    </section>`;

  return `<article class="report" data-pdf-root>
    ${head}
    ${summary}
    ${ddaeSec}
    ${iljuSec}
    ${sokSec}
    ${tgSec}
    ${flowSec}
    ${outro}
  </article>`;
}
