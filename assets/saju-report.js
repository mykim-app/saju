import * as C from "./saju-core.js";
import * as T from "./saju-data.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const firstSentence = (s) => { const i = s.indexOf("니다."); return i > 0 ? s.slice(0, i + 3) : s; };
const elName = (e) => `${C.ELEMENTS[e]}(${C.ELEMENTS_HJ[e]})`;
const yinyang = (isYang) => (isYang ? "양" : "음");
const josa = (word, a, b) => { const c = word.charCodeAt(word.length - 1); if (c < 0xac00 || c > 0xd7a3) return word + b; return word + ((c - 0xac00) % 28 ? a : b); };

function gzCell(s, b, small) {
  return `<span class="gz ${small ? "gz-s" : ""}"><b class="el-${C.STEM_EL[s]}">${C.STEMS_HJ[s]}</b><b class="el-${C.BRANCH_EL[b]}">${C.BRANCHES_HJ[b]}</b></span>`;
}
const gzText = (s, b) => `${C.STEMS[s]}${C.BRANCHES[b]}`;

// 운의 좋고 나쁨: 용신·희신이면 좋음, 기신이면 조심
function luckScore(chart, ys, s, b) {
  let v = 0;
  const se = C.STEM_EL[s], be = C.BRANCH_EL[b];
  if (se === ys.useEl || se === ys.helpEl) v += 1; else if (se === ys.avoidEl) v -= 1;
  if (be === ys.useEl || be === ys.helpEl) v += 1; else if (be === ys.avoidEl) v -= 1;
  const rel = C.branchRelToChart(chart, b);
  const dayChung = rel.some((r) => r.type === "충" && r.pos === "day");
  if (dayChung) v -= 0.5;
  return { v, dayChung, label: v >= 1 ? "좋음" : v <= -1 ? "조심" : "보통", cls: v >= 1 ? "good" : v <= -1 ? "warn" : "mid" };
}

const ADD_LONG = { good: " 이 사주에 힘이 되는 기운이라 적극적으로 움직여도 좋습니다.", warn: " 다만 이 사주에는 부담이 되는 기운이라, 욕심을 줄이고 지키는 쪽으로 움직이세요.", mid: "" };
const ADD_SHORT = { good: " 흐름이 좋으니 미뤄 둔 일을 해 보세요.", warn: " 무리하지 말고 조심스럽게 움직이세요.", mid: "" };
const DAY_TIPS = [
  { work: "혼자 밀어붙이기보다 동료와 나누면 수월합니다.", money: "함께 쓰는 돈, 빌려주는 돈을 조심하세요.", people: "경쟁심이 올라오니 말은 부드럽게 하세요." },
  { work: "생각한 것을 말이나 글로 꺼내 보면 좋습니다.", money: "작은 재주가 수입으로 이어질 수 있습니다.", people: "말실수만 조심하면 호감을 얻습니다." },
  { work: "결과를 챙기고 마무리 짓기 좋습니다.", money: "돈 흐름이 활발하니 계산은 꼼꼼히 하세요.", people: "실속 있는 만남이 생깁니다." },
  { work: "해야 할 일이 몰리니 순서를 정해 처리하세요.", money: "큰 지출은 하루 미뤄 보세요.", people: "윗사람의 요구가 있으니 예의를 지키세요." },
  { work: "공부·서류·계획 정리에 알맞습니다.", money: "계약서나 영수증을 한 번 더 확인하세요.", people: "도움을 청하면 들어줄 사람이 있습니다." },
];

function section(title, inner, id) {
  return `<section class="rsec" ${id ? `id="${id}"` : ""}><h2>${title}</h2>${inner}</section>`;
}

export function renderReport(chart, opts = {}) {
  const P = chart.pillars;
  const dm = chart.dm;
  const tgt = C.tenGodTable(chart);
  const cnt = C.elementCount(chart);
  const wgt = C.elementWeight(chart);
  const grp = C.groupCount(chart);
  const tgc = C.tenGodCount(chart);
  const ys = C.yongsin(chart);
  const st = ys.level;
  const rels = C.relations(chart);
  const sins = C.specialSinsal(chart);
  const inp = chart.input;
  const name = esc(inp.name);
  const today = C.todayKST();

  /* 기본 정보 */
  const sol = chart.solar, lun = chart.lunar;
  const timeTxt = chart.unknown ? "시각 모름" : `${pad(chart.clock.h)}:${pad(chart.clock.mi)}`;
  const notes = [];
  if (!chart.unknown) {
    if (chart.clock.dst) notes.push("태어난 때가 서머타임 시기라 1시간을 빼고 계산했습니다.");
    if (chart.region.lon != null) notes.push(`${chart.region.name} 경도에 맞춰 ${chart.corrMin > 0 ? "+" : ""}${chart.corrMin}분 보정한 ${pad(chart.local.h)}:${pad(chart.local.mi)}을 기준으로 시주를 세웠습니다.`);
    notes.push(inp.yajasi ? "밤 11시~자정 사이는 날짜를 넘기지 않는 방식(야자시)을 적용했습니다." : "밤 11시(자시)부터 다음 날로 보는 방식을 적용했습니다.");
  } else {
    notes.push("태어난 시각을 몰라 시주를 빼고 여섯 글자로 풀었습니다. 대운 시작 시기는 낮 12시로 가정해 계산했습니다.");
    if (chart.monthUncertain) notes.push("태어난 날이 절기가 바뀌는 날이라, 시각에 따라 월주가 달라질 수 있습니다. 시각을 알면 다시 확인해 보세요.");
  }

  const head = `
  <header class="rhead">
    <p class="rname">${name}님의 사주</p>
    <dl class="rinfo">
      <div><dt>양력</dt><dd>${sol.y}년 ${sol.m}월 ${sol.d}일 ${timeTxt}</dd></div>
      <div><dt>음력</dt><dd>${lun ? `${lun.y}년 ${lun.leap ? "윤" : ""}${lun.m}월 ${lun.d}일` : "-"}</dd></div>
      <div><dt>성별</dt><dd>${inp.gender === "M" ? "남성" : "여성"}</dd></div>
      <div><dt>띠</dt><dd>${C.ANIMALS[P.year.b]}띠 (${gzText(P.year.s, P.year.b)}년생)</dd></div>
    </dl>
    <ul class="rnotes">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
  </header>`;

  /* 원국 */
  const cols = ["hour", "day", "month", "year"];
  const th = cols.map((p) => `<th>${C.POS_KO[p]}</th>`).join("");
  const row = (label, fn) => `<tr><th scope="row">${label}</th>${cols.map((p) => `<td>${P[p] ? fn(P[p], tgt[p], p) : (label === "천간" || label === "지지" ? '<span class="unk">모름</span>' : "")}</td>`).join("")}</tr>`;
  const table = `
  <div class="wonguk-wrap">
  <table class="wonguk">
    <thead><tr><th></th>${th}</tr></thead>
    <tbody>
      ${row("십신", (q, t, p) => (p === "day" ? '<span class="me">나</span>' : C.TEN_GODS[t.stemTG]))}
      ${row("천간", (q) => `<span class="big el-${C.STEM_EL[q.s]}">${C.STEMS_HJ[q.s]}</span><span class="sub">${C.STEMS[q.s]} · ${yinyang(C.STEM_YANG[q.s])}${C.ELEMENTS[C.STEM_EL[q.s]]}</span>`)}
      ${row("지지", (q) => `<span class="big el-${C.BRANCH_EL[q.b]}">${C.BRANCHES_HJ[q.b]}</span><span class="sub">${C.BRANCHES[q.b]} · ${yinyang(C.BRANCH_YANG[q.b])}${C.ELEMENTS[C.BRANCH_EL[q.b]]}</span>`)}
      ${row("십신", (q, t) => C.TEN_GODS[t.branchTG])}
      ${row("지장간", (q, t) => t.hidden.map((h) => `<span class="el-${C.STEM_EL[h.s]}">${C.STEMS[h.s]}</span>`).join(" "))}
      ${row("12운성", (q, t) => C.STAGES[t.stage])}
      ${row("12신살", (q, t) => C.SINSAL12[t.sinsal])}
      ${row("납음", (q, t) => t.nayin)}
    </tbody>
  </table>
  </div>
  <p class="hint">십신·12운성은 일간(나)을 기준으로, 12신살은 년지를 기준으로 봤습니다. 지장간은 지지 속에 숨은 천간입니다.</p>`;

  /* 오행 */
  const maxW = Math.max(...wgt, 1);
  const elRows = C.ELEMENTS.map((e, i) => `
    <li class="elrow">
      <span class="elname el-${i}">${C.ELEMENTS_HJ[i]} ${e}</span>
      <span class="bar"><i class="bg-${i}" style="width:${Math.round((wgt[i] / maxW) * 100)}%"></i></span>
      <span class="elnum">${cnt[i]}개</span>
    </li>`).join("");
  const elComments = [];
  cnt.forEach((c, i) => {
    if (c >= 3) elComments.push(`<p><b class="el-${i}">${elName(i)}</b> 기운이 많습니다. ${T.ELEMENT_TEXT[i].many}</p>`);
    if (c === 0) elComments.push(`<p><b class="el-${i}">${elName(i)}</b> 기운이 겉으로 드러나 있지 않습니다. ${T.ELEMENT_TEXT[i].few} ${T.ELEMENT_TEXT[i].boost}</p>`);
  });
  if (!elComments.length) elComments.push("<p>다섯 가지 기운이 고르게 있는 편입니다. 한쪽으로 크게 치우치지 않아 균형 잡힌 성향을 보입니다.</p>");
  const ohaeng = `
    <ul class="ellist">${elRows}</ul>
    <p class="hint">막대 길이는 지지 속 숨은 기운까지 더한 세기이고, 숫자는 드러난 여덟 글자(시각을 모르면 여섯 글자) 가운데 개수입니다.</p>
    ${elComments.join("")}`;

  /* 일간·일주 */
  const D = T.DAY_MASTER[dm];
  const ilgan = `
    <p class="lead-in"><b class="el-${C.STEM_EL[dm]}">${D.name}</b> · ${D.image}</p>
    <p>${D.body}</p>
    <dl class="pairs"><div><dt>강점</dt><dd>${D.good}</dd></div><div><dt>살필 점</dt><dd>${D.care}</dd></div></dl>`;
  const iljuName = gzText(P.day.s, P.day.b);
  const ilju = `
    <p class="lead-in">${gzCell(P.day.s, P.day.b, true)} <b>${iljuName}일주</b> · 납음 ${C.nayin(P.day.s, P.day.b)}</p>
    <p>${T.ILJU[iljuName]}</p>
    <p class="hint">띠(${C.ANIMALS[P.year.b]}): ${T.ANIMAL_TEXT[P.year.b]}</p>`;

  /* 십신 */
  const maxG = Math.max(...grp, 1);
  const gRows = T.GROUP_TEXT.map((g, i) => `
    <li class="elrow">
      <span class="elname">${g.name}</span>
      <span class="bar"><i class="bg-g" style="width:${Math.round((grp[i] / maxG) * 100)}%"></i></span>
      <span class="elnum">${grp[i]}개</span>
    </li>`).join("");
  const gComments = [];
  grp.forEach((c, i) => {
    const g = T.GROUP_TEXT[i];
    if (c >= 3) gComments.push(`<p><b>${g.name}</b>(${g.means})이 많습니다. ${g.many}</p>`);
    if (c === 0) gComments.push(`<p><b>${g.name}</b>(${g.means})이 없습니다. ${g.none}</p>`);
  });
  const present = tgc.map((c, i) => (c ? `<li><b>${C.TEN_GODS[i]}</b> ${c}개 — ${T.TEN_GOD_TEXT[i].short}. ${T.TEN_GOD_TEXT[i].body}</li>` : "")).join("");
  const sipsin = `
    <ul class="ellist">${gRows}</ul>
    ${gComments.join("") || "<p>다섯 무리가 고르게 있어 어느 한쪽으로 치우치지 않습니다.</p>"}
    <details><summary>사주에 있는 십신 자세히 보기</summary><ul class="plain">${present}</ul></details>`;

  /* 신강·신약, 용신 */
  const U = T.ELEMENT_TEXT[ys.useEl];
  const strengthHtml = `
    <div class="gauge" role="img" aria-label="일간의 힘 ${st.score}점">
      <span class="gauge-fill" style="width:${st.score}%"></span>
      <span class="gauge-mid"></span>
    </div>
    <p class="gauge-labels"><span>약함</span><span>균형</span><span>강함</span></p>
    <p>일간의 힘은 <b>${st.level}</b>(${st.score}점)입니다. ${st.monthHelps ? "태어난 달의 기운이 일간을 도와 뿌리가 튼튼합니다." : "태어난 달의 기운이 일간을 직접 돕지는 않습니다."}</p>
    <p>${ys.reason}</p>
    <dl class="pairs">
      <div><dt>도움이 되는 기운(용신)</dt><dd><b class="el-${ys.useEl}">${elName(ys.useEl)}</b></dd></div>
      <div><dt>함께 좋은 기운(희신)</dt><dd><b class="el-${ys.helpEl}">${elName(ys.helpEl)}</b></dd></div>
      <div><dt>조심할 기운(기신)</dt><dd><b class="el-${ys.avoidEl}">${elName(ys.avoidEl)}</b></dd></div>
    </dl>
    <dl class="lucky">
      <div><dt>행운의 색</dt><dd>${U.color}</dd></div>
      <div><dt>행운의 숫자</dt><dd>${U.number}</dd></div>
      <div><dt>좋은 방향</dt><dd>${U.dir}</dd></div>
      <div><dt>힘이 나는 계절</dt><dd>${U.season}</dd></div>
    </dl>
    <p class="hint">여기서는 일간의 강약을 기준으로 간단히 뽑았습니다. 계절의 차고 더움까지 따지는 방식에 따라 다르게 볼 수도 있습니다.</p>`;

  /* 신살 */
  const sinsalItems = sins.filter((x) => x.id !== "공망" || x.where.length).map((x) => `
    <li><b>${x.id}</b> <span class="where">${x.where.join(", ")}</span><br>${T.SINSAL_TEXT[x.id]}</li>`).join("");
  const kong = sins.find((x) => x.id === "공망");
  const sinsal = `
    ${sinsalItems ? `<ul class="plain">${sinsalItems}</ul>` : "<p>두드러진 신살이 없습니다. 특별히 치우친 기운 없이 무난한 편입니다.</p>"}
    <p class="hint">공망(비어 있는 지지): ${kong.kong.join(", ")}. 신살은 성향을 보는 참고 요소일 뿐, 좋고 나쁨을 단정하지 않습니다.</p>`;

  /* 합충 */
  const relTypes = [...new Set(rels.map((r) => r.type))];
  const relHtml = rels.length ? `
    <ul class="plain">${rels.map((r) => `<li><b>${r.text}</b> <span class="where">${r.where}</span></li>`).join("")}</ul>
    ${relTypes.map((t) => `<p><b>${t}</b>: ${T.REL_TEXT[t]}</p>`).join("")}` : "<p>사주 안에서 서로 크게 부딪치거나 묶이는 글자가 없습니다. 기운의 흐름이 비교적 순탄합니다.</p>";

  /* 분야별 풀이 */
  const strongest = grp.indexOf(Math.max(...grp));
  const personality = `${name}님은 ${D.image} 같은 기운을 타고났습니다. 일간의 힘은 ${st.level}이고, 사주에서는 <b>${T.GROUP_TEXT[strongest].name}</b>(${T.GROUP_TEXT[strongest].means})의 기운이 가장 두드러집니다. ${st.strong ? "스스로 판단하고 밀고 나가는 힘이 있으니, 넘치는 힘을 어디에 쓸지 방향을 잡는 것이 중요합니다." : st.weak ? "주변의 도움과 좋은 환경을 만나면 크게 피어나는 사주이니, 믿을 사람과 배움을 곁에 두세요." : "힘이 고른 편이라 상황에 따라 유연하게 대처하는 장점이 있습니다."}`;

  let wealth;
  const jae = grp[2], sik = grp[1];
  if (jae === 0) wealth = sik > 0 ? "재성이 겉으로 드러나 있지 않지만 식상(재능)이 있어, 기술과 재주로 돈을 버는 구조입니다. 실력을 쌓을수록 수입이 따라옵니다." : "재성과 식상이 약해 큰돈을 좇기보다 안정된 수입이 맞습니다. 수입·지출을 적어 두는 습관이 재물을 지켜 줍니다.";
  else if (st.weak && jae >= 3) wealth = "재물 기회는 많지만 그것을 감당할 힘이 모자란 편입니다. 혼자 크게 벌이기보다 믿을 사람과 나누어 맡고, 체력을 먼저 챙기세요.";
  else if (st.strong) wealth = "재물을 다룰 힘이 충분합니다. 적극적으로 기회를 찾아 늘려 가도 좋은 사주입니다.";
  else wealth = "벌고 쓰는 흐름이 균형 잡힌 편입니다. 무리하지 않고 꾸준히 모으면 안정됩니다.";
  if (jae > 0) wealth += tgc[4] > tgc[5] ? " 편재가 더 강해 한 번에 크게 움직이는 돈과 인연이 있습니다." : tgc[5] > tgc[4] ? " 정재가 더 강해 차곡차곡 모으는 쪽이 잘 맞습니다." : "";
  if (sins.some((x) => x.id === "역마살" && x.where.length)) wealth += " 역마의 기운이 있어 이동이 많은 일, 먼 곳과의 거래에서 돈이 됩니다.";

  const career = `기운으로 보면 <b>${T.CAREER_GROUP[strongest]}</b> 쪽이 잘 맞습니다. 도움이 되는 ${elName(ys.useEl)} 기운과 관련된 <b>${T.CAREER_ELEMENT[ys.useEl]}</b> 분야도 좋습니다.${grp[3] === 0 ? " 관성이 약해 틀에 박힌 조직보다 자율성이 큰 환경에서 능력이 잘 드러납니다." : grp[3] >= 2 ? " 관성이 있어 조직 안에서 인정받고 자리를 잡는 힘도 있습니다." : ""}`;

  const spouseStar = inp.gender === "M" ? 2 : 3;
  const spCount = grp[spouseStar];
  const dayTG = tgt.day.branchTG;
  const dayChungIn = rels.some((r) => r.type === "충" && r.where.includes("일주"));
  let love = `배우자 자리(일지)에 <b>${C.TEN_GODS[dayTG]}</b>${josa(C.TEN_GODS[dayTG], "이", "가").slice(-1)} 있습니다. ${T.SPOUSE_TEXT[dayTG]} `;
  love += spCount === 0 ? `${inp.gender === "M" ? "재성" : "관성"}이 드러나 있지 않아 인연이 늦게 오거나 스스로 연애에 크게 매달리지 않는 편입니다. 서두르지 않아도 운이 들어오는 해에 좋은 사람을 만납니다.`
    : spCount >= 3 ? `${inp.gender === "M" ? "재성" : "관성"}이 많아 이성 인연이 많은 편입니다. 여러 인연 가운데 오래 갈 사람을 고르는 눈이 중요합니다.`
      : `${inp.gender === "M" ? "재성" : "관성"}이 적당히 있어 자연스럽게 인연을 만나는 편입니다.`;
  if (sins.some((x) => (x.id === "도화살" || x.id === "홍염살") && x.where.length)) love += " 도화·홍염의 매력이 있어 사람을 끄는 힘이 좋습니다.";
  if (dayChungIn) love += " 배우자 자리가 다른 글자와 부딪치고 있어 서로의 생활 방식을 맞추는 노력이 필요합니다.";

  const weakEl = cnt.indexOf(Math.min(...cnt));
  const strongEl = wgt.indexOf(Math.max(...wgt));
  const health = `상대적으로 부족한 <b class="el-${weakEl}">${elName(weakEl)}</b> 기운과 관련된 <b>${T.ELEMENT_TEXT[weakEl].body}</b>${josa(T.ELEMENT_TEXT[weakEl].body, "을", "를").slice(-1)} 챙기세요. 기운이 몰린 <b class="el-${strongEl}">${elName(strongEl)}</b> 쪽(${T.ELEMENT_TEXT[strongEl].body})도 무리하면 탈이 나기 쉽습니다. 이 내용은 전통적인 풀이일 뿐 건강 진단이 아니니, 몸에 이상이 있으면 병원에서 확인하세요.`;

  const fields = `
    <dl class="fields">
      <div><dt>성격</dt><dd>${personality}</dd></div>
      <div><dt>재물</dt><dd>${wealth}</dd></div>
      <div><dt>직업·적성</dt><dd>${career}</dd></div>
      <div><dt>연애·결혼</dt><dd>${love}</dd></div>
      <div><dt>건강</dt><dd>${health}</dd></div>
    </dl>`;

  /* 대운 */
  const curIdx = C.currentDaeun(chart);
  const dList = chart.daeun.list.map((d, i) => {
    const sTG = C.tenGodOfStem(dm, d.s), bTG = C.tenGodOfBranch(dm, d.b);
    const sc = luckScore(chart, ys, d.s, d.b);
    return `<li class="dcard ${i === curIdx ? "now" : ""}">
      <span class="dage">만 ${d.ageMan}세</span>
      ${gzCell(d.s, d.b)}
      <span class="dtg">${C.TEN_GODS[sTG]}<br>${C.TEN_GODS[bTG]}</span>
      <span class="dyear">${d.startYear}년~</span>
      <span class="tag ${sc.cls}">${sc.label}</span>
    </li>`;
  }).join("");
  let dNow = "";
  if (curIdx >= 0) {
    const d = chart.daeun.list[curIdx];
    const sTG = C.tenGodOfStem(dm, d.s), bTG = C.tenGodOfBranch(dm, d.b);
    const sc = luckScore(chart, ys, d.s, d.b);
    dNow = `<div class="now-box">
      <p class="lead-in">지금은 <b>${gzText(d.s, d.b)} 대운</b>(${d.startYear}년 ~ ${d.startYear + 9}년)입니다.</p>
      <p>${T.LUCK_TEXT[sTG].big}</p>
      <p>이 대운의 앞쪽 5년은 천간 ${C.TEN_GODS[sTG]}, 뒤쪽 5년은 지지 ${C.TEN_GODS[bTG]}의 기운이 더 강하게 작용합니다. ${sc.label === "좋음" ? "도움이 되는 기운이 들어오는 시기라 적극적으로 움직여도 좋습니다." : sc.label === "조심" ? "조심할 기운이 들어오는 시기라 새로운 일은 준비를 단단히 한 뒤 시작하세요." : "좋고 나쁨이 크게 치우치지 않는 시기입니다."}${sc.dayChung ? " 배우자 자리와 부딪치는 대운이라 이사·이직 같은 변동이 생기기 쉽습니다." : ""}</p>
    </div>`;
  } else {
    dNow = `<p>첫 대운이 시작되기 전입니다. 첫 대운은 ${chart.daeun.start.y}년 ${chart.daeun.start.m}월 무렵 시작합니다.</p>`;
  }
  const daeun = `
    <p>대운은 10년 단위로 바뀌는 큰 운의 흐름입니다. ${chart.daeun.forward ? "순서대로 나아가는(순행)" : "거꾸로 거슬러 가는(역행)"} 대운이며, 태어나서 ${chart.daeun.years}년 ${chart.daeun.months}개월 뒤인 <b>${chart.daeun.start.y}년 ${chart.daeun.start.m}월</b> 무렵 첫 대운이 시작됩니다.</p>
    <ol class="dlist">${dList}</ol>
    ${dNow}`;

  const num = (d) => d.y * 10000 + d.m * 100 + d.d;
  /* 세운 */
  const years = [];
  const sy = num(today) < num(C.monthsOfYear(today.y)[0].start) ? today.y - 1 : today.y;
  for (let y = sy; y < sy + 10; y++) {
    const g = C.yearGZ(y);
    const sTG = C.tenGodOfStem(dm, g.s), bTG = C.tenGodOfBranch(dm, g.b);
    const sc = luckScore(chart, ys, g.s, g.b);
    years.push(`<tr class="${y === sy ? "now" : ""}">
      <td class="nw">${y}년</td><td class="nw">${gzCell(g.s, g.b, true)} ${gzText(g.s, g.b)}</td>
      <td class="nw">${C.TEN_GODS[sTG]}<br>${C.TEN_GODS[bTG]}</td>
      <td><span class="tag ${sc.cls}">${sc.label}</span></td>
      <td class="yt">${y === sy ? T.LUCK_TEXT[sTG].year : firstSentence(T.LUCK_TEXT[sTG].year)}${ADD_LONG[sc.cls]}${sc.dayChung ? " 이사·이직 같은 변동이 생기기 쉽습니다." : ""}</td>
    </tr>`);
  }
  const seun = `
    <div class="tscroll"><table class="ytable">
      <thead><tr><th>연도</th><th>간지</th><th>십신(천간·지지)</th><th>흐름</th><th>풀이</th></tr></thead>
      <tbody>${years.join("")}</tbody>
    </table></div>
    <p class="hint">한 해의 운은 입춘(2월 4일 무렵)에 바뀝니다. 흐름은 이 사주에 도움이 되는 기운(용신·희신)이 들어오면 좋음, 조심할 기운(기신)이 들어오면 조심으로 표시했습니다.</p>`;

  /* 월운 */
  const ipchun = C.monthsOfYear(today.y)[0].start;
  const sajuYear = num(today) < num(ipchun) ? today.y - 1 : today.y;
  const months = C.monthsOfYear(sajuYear);
  let curM = -1;
  months.forEach((m, i) => { if (num(m.start) <= num(today)) curM = i; });
  const mRows = months.map((m, i) => {
    const sTG = C.tenGodOfStem(dm, m.s), bTG = C.tenGodOfBranch(dm, m.b);
    const sc = luckScore(chart, ys, m.s, m.b);
    return `<tr class="${i === curM ? "now" : ""}">
      <td class="nw">${m.start.m}월 ${m.start.d}일~<br><span class="hint">${m.term}</span></td>
      <td class="nw">${gzCell(m.s, m.b, true)}</td>
      <td class="nw">${C.TEN_GODS[sTG]}<br>${C.TEN_GODS[bTG]}</td>
      <td><span class="tag ${sc.cls}">${sc.label}</span></td>
      <td class="yt">${T.LUCK_TEXT[sTG].day.replaceAll("날입니다", "달입니다")}${ADD_SHORT[sc.cls]}</td>
    </tr>`;
  }).join("");
  const wolun = `
    <div class="tscroll"><table class="ytable">
      <thead><tr><th>시작일</th><th>간지</th><th>십신(천간·지지)</th><th>흐름</th><th>풀이</th></tr></thead>
      <tbody>${mRows}</tbody>
    </table></div>
    <p class="hint">사주의 한 달은 절기가 드는 날부터 시작합니다. 날짜는 한국 시간 기준입니다.</p>`;

  /* 오늘의 운세 */
  const tg = C.dayGZ(today.y, today.m, today.d);
  const tS = C.tenGodOfStem(dm, tg.s), tB = C.tenGodOfBranch(dm, tg.b);
  const tsc = luckScore(chart, ys, tg.s, tg.b);
  const tRel = C.branchRelToChart(chart, tg.b);
  const iljin = `
    <div class="today-box">
      <p class="lead-in">${today.y}년 ${today.m}월 ${today.d}일 ${gzCell(tg.s, tg.b, true)} ${gzText(tg.s, tg.b)}일 · <span class="tag ${tsc.cls}">${tsc.label}</span></p>
      <p>${T.LUCK_TEXT[tS].day}${ADD_SHORT[tsc.cls]} 12운성으로는 ${C.STAGES[C.stageOf(dm, tg.b)]}에 해당해 ${T.STAGE_TEXT[C.stageOf(dm, tg.b)].split(". ")[1]}의 기운이 있습니다.${tRel.some((r) => r.type === "충" && r.pos === "day") ? " 오늘은 배우자 자리와 부딪치는 날이니 가까운 사람과 말다툼을 피하세요." : ""}${tRel.some((r) => r.type === "합" && r.pos === "day") ? " 오늘은 배우자 자리와 합이 드는 날이라 가까운 사람과 마음이 잘 통합니다." : ""}</p>
      <dl class="pairs">
        <div><dt>일</dt><dd>${DAY_TIPS[C.groupOf(tS)].work}</dd></div>
        <div><dt>돈</dt><dd>${DAY_TIPS[C.groupOf(tS)].money}</dd></div>
        <div><dt>사람</dt><dd>${DAY_TIPS[C.groupOf(tB)].people}</dd></div>
      </dl>
      <p class="hint">오늘의 행운 색은 ${U.color}, 숫자는 ${U.number}, 좋은 방향은 ${U.dir}입니다.</p>
    </div>`;

  const outro = `
    <section class="rsec outro">
      <p>사주는 타고난 기운의 짜임을 읽는 전통적인 방법입니다. 풀이는 스스로를 돌아보는 참고로만 쓰시고, 건강·돈·진로 같은 중요한 결정은 전문가와 상의하세요.</p>
      ${opts.hidePrint ? "" : '<button class="btn-ghost no-print" type="button" data-act="print">인쇄하거나 PDF로 저장</button>'}
    </section>`;

  return `
  <article class="report">
    ${head}
    ${section("사주 원국", table, "sec-wonguk")}
    ${section("오행의 균형", ohaeng)}
    ${section("타고난 성향", ilgan)}
    ${section("일주 풀이", ilju)}
    ${section("십신으로 본 짜임", sipsin)}
    ${section("일간의 힘과 도움이 되는 기운", strengthHtml)}
    ${section("신살", sinsal)}
    ${section("합·충·형·파·해", relHtml)}
    ${section("분야별 풀이", fields)}
    ${section("대운", daeun)}
    ${section("앞으로 10년의 흐름(세운)", seun)}
    ${section(`${sajuYear}년 월별 흐름(월운)`, wolun)}
    ${section("오늘의 운세", iljin)}
    ${outro}
  </article>`;
}

export function pillarsText(chart) {
  return C.POS.map((p) => (chart.pillars[p] ? gzText(chart.pillars[p].s, chart.pillars[p].b) : "--")).join(" ");
}
export { gzCell, gzText };
