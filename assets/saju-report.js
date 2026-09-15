import * as C from "./saju-core.js";
import * as T from "./saju-data.js";
import { analyzeName, elementOfStrokes } from "./naming.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
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

// 십신을 쉬운 말로
export const TG_PLAIN = ["동료·자립", "경쟁·승부", "재능·먹을 복", "표현·변화", "큰돈·활동", "꾸준한 돈", "책임·압박", "명예·인정", "배움·직감", "도움·문서"];
// 무리(비겁·식상·재성·관성·인성)가 뜻하는 것 — 성별에 따라 다른 부분만 넣는다
function groupMeans(i, gender) {
  return [
    "나 자신·형제·친구·동료",
    gender === "F" ? "말·재능·표현·자녀" : "말·재능·표현",
    gender === "M" ? "재물·결과·아내" : "재물·결과",
    gender === "F" ? "직장·규칙·명예·남편" : "직장·규칙·명예",
    "공부·문서·어머니·윗사람의 도움",
  ][i];
}
// 십신이 주는 느낌: 1 밝음, 0 중간, -1 부담
const TONE = [0, -1, 1, -1, 0, 1, -1, 1, 0, 1];
// 지지(바탕)의 기운이 천간과 다를 때 덧붙이는 말
const BRANCH_LIFE = [
  "친구·동료와 어울리거나 함께할 일이 늘어납니다.",
  "하고 싶은 말과 해 보고 싶은 일이 많아집니다.",
  "돈이 들어오고 나갈 일이 많아집니다.",
  "맡은 일과 책임이 늘어납니다.",
  "배우거나 도움을 받을 일이 생깁니다.",
];
const firstPart = (s) => { const i = s.indexOf("니다."); return i > 0 ? s.slice(0, i + 3) : s; };

/* 운(대운·세운·월운·일진) 풀이를 한 흐름으로 이어 붙인다.
   kind: big(대운) / year(세운) / month(월운) / day(일진)
   앞 문장(십신의 뜻)과 뒤 문장(좋음·조심 판단)이 서로 어긋나지 않도록
   십신의 느낌(TONE)과 판단을 함께 보고 잇는 말을 고른다. */
function luckText(chart, ys, s, b, kind, full) {
  const dm = chart.dm;
  const sTG = C.tenGodOfStem(dm, s), bTG = C.tenGodOfBranch(dm, b);
  const gS = C.groupOf(sTG), gB = C.groupOf(bTG);
  const sc = luckScore(chart, ys, s, b);
  const L = T.LUCK_TEXT[sTG];
  const warn = sc.cls === "warn";
  const out = [];
  if (kind === "big") out.push(warn ? (L.bigWarn || L.big) : L.big);
  else if (kind === "year") out.push(full ? (warn ? (L.yearWarn || L.year) : L.year) : firstPart(warn ? (L.yearWarn || L.year) : L.year));
  else if (kind === "month") out.push((warn ? (L.dayWarn || L.day) : L.day).replaceAll("날입니다", "달입니다"));
  else out.push(warn ? (L.dayWarn || L.day) : L.day);
  if (gB !== gS && kind !== "day" && !warn) out.push("또 " + BRANCH_LIFE[gB]);

  const tone = TONE[sTG];
  const useGroup = C.groupOf(C.tenGodOfStem(dm, [0, 2, 4, 6, 8][ys.useEl]));
  // 관성(부담)이 인성(도움)으로 이어지는 짜임: 관성이 들어와도 오히려 힘이 된다
  const gwanIn = sc.cls === "good" && sTG === 6 && (gB === 4 || useGroup === 4);
  const unit = { big: "10년", year: "해", month: "달", day: "날" }[kind];
  let v = "";
  if (sc.cls === "good") {
    if (gwanIn) v = kind === "big" ? "책임이 커지는 만큼 배움과 도움도 함께 들어와, 부담이 인정으로 바뀌는 10년입니다."
      : `부담이 배움과 도움으로 이어지는 흐름이라, 이 사주에는 오히려 힘이 되는 ${unit}입니다.`;
    else if (tone >= 0) v = kind === "month" || kind === "day" ? "흐름이 좋으니 미뤄 둔 일을 해 보세요."
      : `이 사주에 필요한 기운이 들어오는 ${unit}라 계획한 일을 밀고 나가도 좋습니다.`;
    else v = kind === "month" || kind === "day" ? "바쁘더라도 이 사주에는 힘이 되는 흐름입니다."
      : "겉으로는 부담스러워 보여도 이 사주에는 필요한 기운이라, 잘 버티면 오히려 힘이 됩니다.";
  } else if (sc.cls === "mid" && !sc.dayChung && (kind === "big" || kind === "year")) {
    v = "좋고 나쁨이 크게 치우치지 않으니 하던 일을 꾸준히 이어 가세요.";
  }
  if (v) out.push(v);
  if (sc.dayChung) out.push(kind === "day" ? "오늘은 배우자 자리와 부딪치는 날이라 가까운 사람과 말다툼을 피하세요."
    : "배우자 자리(일지)와 부딪치는 기운이라 이사·이직 같은 변동이 생기기 쉽습니다.");
  const text = out.join(" ").replace(/\{([MF]):([^}]*)\}/g, (_, g, t) => (g === chart.input.gender ? t : ""));
  return { text, sc, sTG, bTG };
}
const tgCell = (a, b) => `${C.TEN_GODS[a]}<br>${C.TEN_GODS[b]}`;
const DAY_TIPS = [
  { work: "혼자 밀어붙이기보다 동료와 나누면 수월합니다.", money: "함께 쓰는 돈, 빌려주는 돈을 조심하세요.", people: "경쟁심이 올라오니 말은 부드럽게 하세요." },
  { work: "생각한 것을 말이나 글로 꺼내 보면 좋습니다.", money: "작은 재주가 수입으로 이어질 수 있습니다.", people: "말실수만 조심하면 호감을 얻습니다." },
  { work: "결과를 챙기고 마무리 짓기 좋습니다.", money: "돈 흐름이 활발하니 계산은 꼼꼼히 하세요.", people: "실속 있는 만남이 생깁니다." },
  { work: "해야 할 일이 몰리니 순서를 정해 처리하세요.", money: "큰 지출은 하루 미뤄 보세요.", people: "윗사람의 요구가 있으니 예의를 지키세요." },
  { work: "공부·서류·계획 정리에 알맞습니다.", money: "계약서나 영수증을 한 번 더 확인하세요.", people: "도움을 청하면 들어줄 사람이 있습니다." },
];

function section(title, inner, id) {
  return `<section class="rsec" data-pdf-block ${id ? `id="${id}"` : ""}><h2>${title}</h2>${inner}</section>`;
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
  <header class="rhead" data-pdf-block>
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
  const G = inp.gender;
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
  <p class="hint">위 칸은 하늘의 기운(천간), 아래 칸은 땅의 기운(지지)입니다. 일주의 천간이 ‘나’(일간)이고, 나머지 글자는 나와의 관계(십신)로 읽습니다. 12운성은 그 자리에서 내 기운이 얼마나 센지, 지장간은 지지 속에 숨은 기운, 12신살은 태어난 해의 지지를 기준으로 본 특징, 납음은 60갑자마다 붙인 옛 이름입니다.</p>
  <div class="tglegend">
    <p class="tgl-title">십신 쉽게 보기</p>
    <ul>${C.TEN_GODS.map((t, i) => `<li><b>${t}</b> ${TG_PLAIN[i]}</li>`).join("")}</ul>
  </div>`;

  /* 오행 */
  const maxW = Math.max(...wgt, 1);
  const elRows = C.ELEMENTS.map((e, i) => `
    <li class="elrow">
      <span class="elname el-${i}">${C.ELEMENTS_HJ[i]} ${e}</span>
      <span class="bar"><i class="bg-${i}" style="width:${Math.round((wgt[i] / maxW) * 100)}%"></i></span>
      <span class="elnum">${cnt[i]}개</span>
    </li>`).join("");
  const ysEarly = C.yongsin(chart);
  const elComments = [];
  cnt.forEach((c, i) => {
    const E = T.ELEMENT_TEXT[i];
    if (c >= 3) elComments.push(`<p><b class="el-${i}">${elName(i)}</b> 기운이 많습니다. ${E.many}${i === ysEarly.avoidEl ? " 이 사주에서 조심할 기운이기도 하니 이 기운이 더해지는 때에는 속도를 늦추세요." : ""}</p>`);
    if (c === 0) {
      let tail;
      if (i === ysEarly.useEl || i === ysEarly.helpEl) tail = `이 사주에 필요한 기운이기도 해서 채워 주면 좋습니다. ${E.boost}`;
      else if (i === ysEarly.avoidEl) tail = "다만 이 사주에서는 조심할 기운이라, 억지로 채우기보다 없는 대로 두는 편이 낫습니다.";
      else tail = E.boost;
      elComments.push(`<p><b class="el-${i}">${elName(i)}</b> 기운이 여덟 글자에 드러나 있지 않습니다. ${E.few} ${tail}</p>`);
    }
  });
  if (!elComments.length) elComments.push("<p>다섯 가지 기운이 고르게 있는 편입니다. 한쪽으로 크게 치우치지 않아 균형 잡힌 성향을 보입니다.</p>");
  const ohaeng = `
    <ul class="ellist">${elRows}</ul>
    <p class="hint">숫자는 여덟 글자 가운데 몇 개인지이고(시각을 모르면 여섯 글자), 막대는 지지 속에 숨은 기운까지 더해 본 세기입니다.</p>
    ${elComments.join("")}`;

  /* 일간·일주 */
  const D = T.DAY_MASTER[dm];
  const ilgan = `
    <p class="lead-in"><b class="el-${C.STEM_EL[dm]}">${D.name}</b> · ${D.image}</p>
    <p>${D.body}</p>
    <dl class="pairs"><div><dt>강점</dt><dd>${D.good}</dd></div><div><dt>살필 점</dt><dd>${D.care}</dd></div><div><dt>띠</dt><dd>${C.ANIMALS[P.year.b]}띠 — ${T.ANIMAL_TEXT[P.year.b]}</dd></div></dl>`;
  const iljuName = gzText(P.day.s, P.day.b);
  const ilju = `
    <p class="lead-in">${gzCell(P.day.s, P.day.b, true)} <b>${iljuName}일주</b> · 납음 ${C.nayin(P.day.s, P.day.b)}</p>
    <p>${T.ILJU[iljuName]}</p>
    <p class="hint">일주는 태어난 날의 두 글자로, 나 자신과 배우자 자리를 함께 보여 줍니다.</p>`;

  /* 십신 */
  const maxG = Math.max(...grp, 1);
  const gRows = T.GROUP_TEXT.map((g, i) => `
    <li class="elrow">
      <span class="elname">${g.name}<small>${groupMeans(i, G).split("·").slice(0, 2).join("·")}</small></span>
      <span class="bar"><i class="bg-g" style="width:${Math.round((grp[i] / maxG) * 100)}%"></i></span>
      <span class="elnum">${grp[i]}개</span>
    </li>`).join("");
  const gComments = [];
  grp.forEach((c, i) => {
    const g = T.GROUP_TEXT[i];
    if (c >= 3) gComments.push(`<p><b>${g.name}</b>이 많습니다. ${g.name}은 ${josa(groupMeans(i, G), "을", "를")} 뜻합니다. ${g.many}</p>`);
    if (c === 0) gComments.push(`<p>겉으로 드러난 <b>${g.name}</b>이 없습니다. ${g.name}은 ${josa(groupMeans(i, G), "을", "를")} 뜻합니다. ${g.none}</p>`);
  });
  const present = tgc.map((c, i) => (c ? `<li><b>${C.TEN_GODS[i]}</b> ${c}개 — ${T.TEN_GOD_TEXT[i].short}입니다. ${T.TEN_GOD_TEXT[i].body}</li>` : "")).join("");
  const sipsin = `
    <ul class="ellist">${gRows}</ul>
    ${gComments.join("") || "<p>다섯 무리가 고르게 있어 어느 한쪽으로 치우치지 않습니다.</p>"}
    <p class="sub-h">이 사주에 있는 십신</p><ul class="plain">${present}</ul>`;

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

  /* 이름 풀이(한자 성명학) */
  let nameSection = "", nameSummary = "";
  if (inp.hanja) {
    const nm = analyzeName(inp.name, [...inp.hanja]);
    if (nm.error) {
      nameSection = section("이름 풀이(한자)", `<p class="err" style="margin:0">${esc(nm.error)} 한자를 다시 확인해 주세요.</p>`);
    } else {
      const rows = nm.chars.map((c, i) => `
        <li class="hjrow">
          <span class="hjch el-${c.el}">${c.char}</span>
          <span class="hjinfo"><b>${esc(c.hangul)}</b> · ${c.strokes}획 · <b class="el-${c.el}">${C.ELEMENTS[c.el]}(${C.ELEMENTS_HJ[c.el]})</b>${c.match ? "" : ` <span class="hint">대표 음은 ‘${c.reading}’</span>`}</span>
        </li>`).join("");
      const cntTxt = nm.elCount.map((n, i) => (n ? `${C.ELEMENTS[i]} ${n}개` : "")).filter(Boolean).join(" · ");
      const sg = nm.sagyeok;
      let sgRow = "";
      if (sg) {
        const list = [sg.won, sg.hyeong, sg.i, sg.jeong].map((g) => ({ ...g, el: elementOfStrokes(g.n) }));
        const good = list.filter((g) => g.el === ys.useEl || g.el === ys.helpEl).map((g) => g.period.split("·")[0].replace("운", ""));
        const bad = list.filter((g) => g.el === ys.avoidEl).map((g) => g.period.split("·")[0].replace("운", ""));
        sgRow = `
        <dl class="pairs">${list.map((g) => `<div><dt>${g.label}</dt><dd>${g.n} → <b class="el-${g.el}">${elName(g.el)}</b> · ${g.period} <span class="hint">— ${g.desc}</span></dd></div>`).join("")}</dl>
        <p>${good.length ? `이 사주에 도움이 되는 기운이 드는 시기는 <b>${good.join("·")}</b>입니다.` : "사격 가운데 이 사주의 용신·희신 기운이 드는 시기는 없습니다."}${bad.length ? ` 조심할 ${elName(ys.avoidEl)} 기운이 드는 시기는 ${bad.join("·")}입니다.` : ""}</p>`;
      }
      let soundTxt = "";
      if (nm.soundFlow) {
        const seq = nm.soundFlow.els.map((e) => C.ELEMENTS[e]).join(" → ");
        const { gen, ctrl, same } = nm.soundFlow;
        let judge;
        if (!ctrl && gen) judge = "서로 살려 주는 상생으로 이어져 소리의 결이 부드럽습니다.";
        else if (!ctrl && !gen) judge = "같은 기운끼리 이어져 소리가 한결같은 편입니다.";
        else if (!gen && !same) judge = "서로 누르는 상극으로 이어져 소리가 다소 부딪히는 편입니다.";
        else judge = `상생${gen ? ` ${gen}번` : " 없이"}, 상극 ${ctrl}번${same ? `, 같은 기운 ${same}번` : ""}이 섞여 있습니다.`;
        soundTxt = `<p>이름을 부르는 소리(첫 자음)의 오행은 <b>${seq}</b> 순서로 이어집니다. ${judge}</p>`;
      }
      const need = [ys.useEl, ys.helpEl], avoid = ys.avoidEl;
      const needCnt = nm.chars.filter((c) => need.includes(c.el)).length;
      const avoidCnt = nm.chars.filter((c) => c.el === avoid).length;
      let fit;
      if (needCnt && !avoidCnt) fit = `이름 글자 가운데 ${needCnt}개가 이 사주에 도움이 되는 ${elName(ys.useEl)}·${elName(ys.helpEl)} 기운이라, 사주에 필요한 기운을 이름이 보태 주는 짜임입니다.`;
      else if (avoidCnt && !needCnt) fit = `이름 글자 가운데 ${avoidCnt}개가 이 사주에서 조심하는 ${elName(ys.avoidEl)} 기운이라, 사주가 이미 조심하는 기운을 이름에서도 쓰고 있습니다.`;
      else if (needCnt && avoidCnt) fit = `도움이 되는 기운과 조심할 기운이 이름 안에 함께 있습니다(도움 ${needCnt}자 · 조심 ${avoidCnt}자).`;
      else fit = "이름의 오행이 이 사주의 용신·기신 어느 쪽과도 크게 겹치지 않습니다.";
      nameSummary = `${esc(inp.hanja)} — 이름 글자의 오행은 ${cntTxt}${needCnt ? `, 사주에 도움이 되는 기운이 ${needCnt}자` : ""}${avoidCnt ? `, 조심할 기운이 ${avoidCnt}자` : ""}입니다.`;
      const warn = nm.mismatch.length
        ? `<p class="hint">한글 이름과 한자 음이 다른 글자가 있습니다(${nm.mismatch.map((c) => `${esc(c.hangul)} ↔ ${c.char}`).join(", ")}). 순서가 바뀌었는지 확인해 주세요. 음이 여러 개인 한자라면 그대로 두셔도 됩니다.</p>` : "";
      nameSection = section("이름 풀이(한자)", `
        <ul class="hjlist">${rows}</ul>
        ${warn}
        <p class="hint">이름 글자의 오행: ${cntTxt}</p>
        <p class="sub-h">사격(四格)</p>
        ${sgRow || '<p>성 글자만 있고 이름 글자가 없어 사격은 계산하지 않았습니다.</p>'}
        <p class="hint">사격은 이름 획수를 성과 조합해 초년·청년·중년·노년 네 시기로 나눠 보는 전통 방식입니다. 숫자의 끝자리로 오행을 정합니다(1·2 목, 3·4 화, 5·6 토, 7·8 금, 9·0 수). 이 숫자로 길흉을 매기는 81수리 표도 있지만, 문헌과 유파마다 배정이 달라 여기서는 다루지 않았습니다.</p>
        ${soundTxt}
        <p>${fit}</p>
        <p class="hint">획수는 부수를 획이 줄기 전의 본래 글자로 보고 세는 원획을 썼습니다(예: 삼수변 氵→물 水로 보아 4획). 발음오행은 훈민정음의 소리 분류를 오행에 대응한 것으로, ㅁㅂㅍ·ㅇㅎ의 분류는 유파에 따라 다르게 보기도 합니다.</p>`);
    }
  }

  /* 신살 */
  const POS_MEAN = { "년주": "조상·어린 시절", "월주": "부모·형제·사회생활", "일주": "나와 배우자", "시주": "자녀·말년" };
  const sinsalItems = sins.filter((x) => x.id !== "공망" || x.where.length).map((x) => {
    const body = x.id === "공망"
      ? `비어 있는 자리라는 뜻입니다. 이 사주에서는 ${x.where.map((w) => `${w}(${POS_MEAN[w]})`).join(", ")} 자리가 비어 있어, 그 자리가 뜻하는 일에 기대보다 실속이 적을 수 있습니다. 대신 정신적·종교적 분야에서는 오히려 좋게 쓰입니다.`
      : T.SINSAL_TEXT[x.id];
    return `
    <li><b>${x.id}</b> <span class="where">${x.where.join(", ")}</span><br>${body}</li>`;
  }).join("");
  const kong = sins.find((x) => x.id === "공망");
  const sinsal = `
    ${sinsalItems ? `<ul class="plain">${sinsalItems}</ul>` : "<p>두드러진 신살이 없습니다. 특별히 치우친 기운 없이 무난한 편입니다.</p>"}
    <p class="hint">이 사주의 공망 글자는 ${kong.kong.join("·")}입니다. 도화·역마·화개는 태어난 해와 태어난 날의 지지를 모두 기준으로 보기 때문에, 위 원국 표의 12신살(태어난 해 기준)과 다르게 나올 수 있습니다. 신살은 성향을 보는 참고일 뿐, 좋고 나쁨을 정하지 않습니다.</p>`;

  /* 합충 */
  const relTypes = [...new Set(rels.map((r) => r.type))];
  const relHtml = rels.length ? `
    <ul class="plain">${rels.map((r) => `<li><b>${r.text}</b> <span class="where">${r.where}</span></li>`).join("")}</ul>
    <p class="hint">년주는 조상·어린 시절, 월주는 부모·형제·사회생활, 일주는 나와 배우자, 시주는 자녀·말년 자리입니다. 부딪치는 자리가 뜻하는 쪽에서 변화가 생기기 쉽다고 봅니다.</p>
    ${relTypes.map((t) => `<p><b>${t}</b>: ${T.REL_TEXT[t]}</p>`).join("")}` : "<p>사주 안에서 서로 크게 부딪치거나 묶이는 글자가 없습니다. 기운의 흐름이 비교적 순탄합니다.</p>";

  /* 분야별 풀이 */
  const strongest = grp.indexOf(Math.max(...grp));
  const personality = `${name}님은 ${D.image} 같은 기운을 타고났습니다. 일간의 힘은 ${st.level}이고, 사주에서는 <b>${T.GROUP_TEXT[strongest].name}</b>, 곧 ${josa(groupMeans(strongest, G), "을", "를")} 뜻하는 기운이 가장 두드러집니다. ${st.strong ? "스스로 판단하고 밀고 나가는 힘이 있으니, 넘치는 힘을 어디에 쓸지 방향을 잡는 것이 중요합니다." : st.weak ? "주변의 도움과 좋은 환경을 만나면 크게 피어나는 사주이니, 믿을 사람과 배움을 곁에 두세요." : "힘이 고른 편이라 상황에 따라 유연하게 대처하는 장점이 있습니다."}`;

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

  const order = [0, 1, 2, 3, 4];
  const weakEl = [...order].sort((a, b) => cnt[a] - cnt[b] || wgt[a] - wgt[b])[0];
  const strongEl = [...order].sort((a, b) => cnt[b] - cnt[a] || wgt[b] - wgt[a])[0];
  const health = `가장 적은 <b class="el-${weakEl}">${elName(weakEl)}</b> 기운과 관련된 <b>${T.ELEMENT_TEXT[weakEl].body}</b>${josa(T.ELEMENT_TEXT[weakEl].body, "을", "를").slice(-1)} 챙기세요. 가장 많은 <b class="el-${strongEl}">${elName(strongEl)}</b> 기운과 관련된 ${T.ELEMENT_TEXT[strongEl].body}도 무리하면 탈이 나기 쉽습니다. 이 내용은 전통적인 풀이일 뿐 건강 진단이 아니니, 몸에 이상이 있으면 병원에서 확인하세요.`;

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
  const dStartM = chart.daeun.start.m;
  const dList = chart.daeun.list.map((d, i) => {
    const sTG = C.tenGodOfStem(dm, d.s), bTG = C.tenGodOfBranch(dm, d.b);
    const sc = luckScore(chart, ys, d.s, d.b);
    return `<li class="dcard ${i === curIdx ? "now" : ""}">
      <span class="dage">만 ${d.ageMan}세</span>
      ${gzCell(d.s, d.b)}
      <span class="dtg">${tgCell(sTG, bTG)}</span>
      <span class="dyear">${d.startYear}년~</span>
      <span class="tag ${sc.cls}">${sc.label}</span>
    </li>`;
  }).join("");
  let dNow = "";
  if (curIdx >= 0) {
    const d = chart.daeun.list[curIdx];
    const next = chart.daeun.list[curIdx + 1];
    const r = luckText(chart, ys, d.s, d.b, "big");
    dNow = `<div class="now-box">
      <p class="lead-in">지금은 <b>${gzText(d.s, d.b)} 대운</b>입니다 · <span class="tag ${r.sc.cls}">${r.sc.label}</span></p>
      <p class="hint">${d.startYear}년 ${dStartM}월 무렵부터 10년${next ? `, 다음 ${gzText(next.s, next.b)} 대운은 ${next.startYear}년 ${dStartM}월 무렵 시작` : ""}</p>
      <p>${r.text}</p>
      <p>10년 가운데 앞 5년은 천간 ${C.STEMS[d.s]}(${C.TEN_GODS[r.sTG]}: ${TG_PLAIN[r.sTG]}), 뒤 5년은 지지 ${C.BRANCHES[d.b]}(${C.TEN_GODS[r.bTG]}: ${TG_PLAIN[r.bTG]})의 영향이 더 크다고 봅니다.</p>
    </div>`;
  } else {
    dNow = `<p>첫 대운이 시작되기 전입니다. 첫 대운은 ${chart.daeun.start.y}년 ${chart.daeun.start.m}월 무렵 시작합니다.</p>`;
  }
  const daeun = `
    <p>대운은 10년마다 바뀌는 큰 운의 흐름입니다. 이 사주는 ${chart.daeun.forward ? "순서대로 나아가는(순행)" : "거꾸로 거슬러 가는(역행)"} 대운이며, 태어나서 ${chart.daeun.years}년 ${chart.daeun.months}개월 뒤인 <b>${chart.daeun.start.y}년 ${chart.daeun.start.m}월</b> 무렵 첫 대운이 시작됩니다. 각 칸의 두 글자 아래에는 그 대운이 나에게 어떤 기운인지(십신)를 적었습니다.</p>
    <ol class="dlist">${dList}</ol>
    ${dNow}`;

  const num = (d) => d.y * 10000 + d.m * 100 + d.d;
  /* 세운 */
  const years = [];
  const sy = num(today) < num(C.monthsOfYear(today.y)[0].start) ? today.y - 1 : today.y;
  for (let y = sy; y < sy + 10; y++) {
    const g = C.yearGZ(y);
    const r = luckText(chart, ys, g.s, g.b, "year", y === sy);
    years.push(`<tr class="${y === sy ? "now" : ""}">
      <td class="nw">${y}년</td><td class="nw">${gzCell(g.s, g.b, true)} ${gzText(g.s, g.b)}</td>
      <td class="nw">${tgCell(r.sTG, r.bTG)}</td>
      <td><span class="tag ${r.sc.cls}">${r.sc.label}</span></td>
      <td class="yt">${r.text}</td>
    </tr>`);
  }
  const seun = `
    <div class="tscroll"><table class="ytable">
      <thead><tr><th>연도</th><th>간지</th><th>십신</th><th>흐름</th><th>풀이</th></tr></thead>
      <tbody>${years.join("")}</tbody>
    </table></div>
    <p class="hint">한 해의 운은 입춘(2월 4일 무렵)에 바뀝니다. 그해의 기운이 이 사주에 필요한 기운(용신·희신)이면 좋음, 조심할 기운(기신)이면 조심으로 표시했습니다. 십신은 위가 천간, 아래가 지지입니다.</p>`;

  /* 월운 */
  const ipchun = C.monthsOfYear(today.y)[0].start;
  const sajuYear = num(today) < num(ipchun) ? today.y - 1 : today.y;
  const months = C.monthsOfYear(sajuYear);
  let curM = -1;
  months.forEach((m, i) => { if (num(m.start) <= num(today)) curM = i; });
  const mRows = months.map((m, i) => {
    const r = luckText(chart, ys, m.s, m.b, "month");
    const yl = m.start.y !== sajuYear ? `${m.start.y}년 ` : "";
    return `<tr class="${i === curM ? "now" : ""}">
      <td class="nw">${yl}${m.start.m}월 ${m.start.d}일~<br><span class="hint">${m.term}</span></td>
      <td class="nw">${gzCell(m.s, m.b, true)}</td>
      <td class="nw">${tgCell(r.sTG, r.bTG)}</td>
      <td><span class="tag ${r.sc.cls}">${r.sc.label}</span></td>
      <td class="yt">${r.text}</td>
    </tr>`;
  }).join("");
  const wolun = `
    <div class="tscroll"><table class="ytable">
      <thead><tr><th>시작일</th><th>간지</th><th>십신</th><th>흐름</th><th>풀이</th></tr></thead>
      <tbody>${mRows}</tbody>
    </table></div>
    <p class="hint">사주에서 한 달은 1일이 아니라 절기가 드는 날부터 시작합니다(${sajuYear}년 입춘부터 ${sajuYear + 1}년 소한까지). 날짜는 한국 시간 기준입니다.</p>`;

  /* 오늘의 운세 */
  const tg = C.dayGZ(today.y, today.m, today.d);
  const tr = luckText(chart, ys, tg.s, tg.b, "day");
  const tS = tr.sTG, tB = tr.bTG, tsc = tr.sc;
  const tRel = C.branchRelToChart(chart, tg.b);
  const stg = C.stageOf(dm, tg.b);
  const iljin = `
    <div class="today-box">
      <p class="lead-in">${today.y}년 ${today.m}월 ${today.d}일 ${gzCell(tg.s, tg.b, true)} ${gzText(tg.s, tg.b)}일 · <span class="tag ${tsc.cls}">${tsc.label}</span></p>
      <p>${tr.text} 오늘은 12운성으로 ${C.STAGES[stg]}, 곧 ‘${T.STAGE_TEXT[stg].split(". ")[0]}’에 해당해 ${T.STAGE_TEXT[stg].split(". ")[1]}의 기운이 있습니다.${tRel.some((r) => r.type === "합" && r.pos === "day") ? " 배우자 자리와 합이 드는 날이라 가까운 사람과 마음이 잘 통합니다." : ""}</p>
      <dl class="pairs">
        <div><dt>일</dt><dd>${DAY_TIPS[C.groupOf(tS)].work}</dd></div>
        <div><dt>돈</dt><dd>${DAY_TIPS[C.groupOf(tS)].money}</dd></div>
        <div><dt>사람</dt><dd>${DAY_TIPS[C.groupOf(tB)].people}</dd></div>
      </dl>
      <p class="hint">오늘의 행운 색은 ${U.color}, 숫자는 ${U.number}, 좋은 방향은 ${U.dir}입니다.</p>
    </div>`;

  /* 한눈에 보기 */
  const yNow = C.yearGZ(sy);
  const yR = luckText(chart, ys, yNow.s, yNow.b, "year");
  const dCur = curIdx >= 0 ? chart.daeun.list[curIdx] : null;
  const dCurSc = dCur ? luckScore(chart, ys, dCur.s, dCur.b) : null;
  const summary = `
  <section class="rsec summary" data-pdf-block>
    <h2>한눈에 보기</h2>
    <dl class="pairs">
      <div><dt>타고난 기운</dt><dd><b class="el-${C.STEM_EL[dm]}">${D.name}</b> — ${D.image}. ${firstPart(D.body)}</dd></div>
      <div><dt>일간의 힘</dt><dd>${st.level}이라 ${elName(ys.useEl)} 기운이 도움이 되고, ${elName(ys.avoidEl)} 기운은 조심하는 것이 좋습니다.</dd></div>
      <div><dt>두드러진 기운</dt><dd>${T.GROUP_TEXT[strongest].name} — ${josa(groupMeans(strongest, G), "을", "를")} 뜻하는 기운이 가장 많습니다.</dd></div>
      ${dCur ? `<div><dt>지금 대운</dt><dd>${gzText(dCur.s, dCur.b)} 대운(${dCur.startYear}~${dCur.startYear + 10}년) · <span class="tag ${dCurSc.cls}">${dCurSc.label}</span></dd></div>` : ""}
      ${nameSummary ? `<div><dt>이름</dt><dd>${nameSummary}</dd></div>` : ""}
      <div><dt>올해</dt><dd>${sy}년 ${gzText(yNow.s, yNow.b)}년 · <span class="tag ${yR.sc.cls}">${yR.sc.label}</span> ${firstPart(yR.text)}</dd></div>
    </dl>
  </section>`;

  const outro = `
    <section class="rsec outro" data-pdf-block>
      <p>사주는 타고난 기운의 짜임을 읽는 전통적인 방법입니다. 풀이는 스스로를 돌아보는 참고로만 쓰시고, 건강·돈·진로 같은 중요한 결정은 전문가와 상의하세요.</p>
      ${opts.hidePrint ? "" : `<div class="actions no-print">
        <button class="btn" type="button" data-act="pdf">PDF로 저장</button>
        <button class="btn-ghost" type="button" data-act="print">인쇄</button>
      </div>
      <p class="hint no-print" data-pdf-hint>PDF 파일이 바로 내려받아집니다. 내용이 쪽 경계에서 잘리지 않도록 나눠 담습니다.</p>
      <p class="hint no-print" data-pdf-webview-warn hidden>지금 보고 계신 앱 안 화면에서는 파일 저장이 막힐 때가 있습니다. 오른쪽 위 메뉴(⋮ 또는 …)에서 <b>‘다른 브라우저로 열기’</b>를 고른 뒤 다시 눌러 보세요.</p>
      <a class="btn no-print" data-act="pdf-fallback" hidden download style="text-decoration:none">PDF 파일 눌러서 저장</a>`}
    </section>`;

  return `
  <article class="report" data-pdf-root>
    ${head}
    ${summary}
    ${section("사주 원국", table, "sec-wonguk")}
    ${section("오행의 균형", ohaeng)}
    ${section("타고난 성향", ilgan)}
    ${section("일주 풀이", ilju)}
    ${section("십신으로 본 짜임", sipsin)}
    ${section("일간의 힘과 도움이 되는 기운", strengthHtml)}
    ${nameSection}
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
