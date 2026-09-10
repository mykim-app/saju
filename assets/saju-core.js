/* 사주 계산 엔진
 * - 절기·간지 계산: lunar-javascript (assets/vendor/lunar.js, 전역 Solar)
 * - 한국 음력 변환: korean-lunar-calendar (한국천문연구원 자료 기반)
 * - 시각 처리: 입력 시각을 당시 한국 시간대(서머타임·127.5도 표준시 시기 포함)로 해석해
 *   세계시로 바꾼 뒤, 년·월주는 절기 순간 기준, 일·시주는 태어난 곳의 평균태양시 기준으로 잡는다.
 */
import KoreanLunarCalendar from "./vendor/korean-lunar-calendar.mjs";

const LIB = () => {
  const S = globalThis.Solar;
  if (!S) throw new Error("만세력 파일(assets/vendor/lunar.js)을 불러오지 못했습니다.");
  return S;
};

/* ── 기본 표 ───────────────────────────────────────── */
export const STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
export const STEMS_HJ = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
export const BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
export const BRANCHES_HJ = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
export const ANIMALS = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
export const ELEMENTS = ["목", "화", "토", "금", "수"];
export const ELEMENTS_HJ = ["木", "火", "土", "金", "水"];

export const STEM_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
export const STEM_YANG = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
export const BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
// 십신을 볼 때 쓰는 지지의 음양(본기 기준): 자=계(음), 사=병(양), 오=정(음), 해=임(양)
export const BRANCH_YANG = [0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1];
// 지장간(여기·중기·정기 순). 마지막이 정기(본기)
export const HIDDEN = [
  [8, 9], [9, 7, 5], [4, 2, 0], [0, 1], [1, 9, 4], [4, 6, 2],
  [2, 5, 3], [3, 1, 5], [4, 8, 6], [6, 7], [7, 3, 4], [4, 0, 8],
];
export const BRANCH_MAIN = HIDDEN.map((h) => h[h.length - 1]);

const NAYIN = ["해중금", "노중화", "대림목", "노방토", "검봉금", "산두화", "간하수", "성두토", "백랍금", "양류목",
  "천중수", "옥상토", "벽력화", "송백목", "장류수", "사중금", "산하화", "평지목", "벽상토", "금박금",
  "복등화", "천하수", "대역토", "차천금", "상자목", "대계수", "사중토", "천상화", "석류목", "대해수"];

export const TEN_GODS = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"];
export const GROUPS = ["비겁", "식상", "재성", "관성", "인성"];
export const STAGES = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"];
const STAGE_START = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3]; // 각 천간의 장생 지지
export const SINSAL12 = ["겁살", "재살", "천살", "지살", "연살", "월살", "망신살", "장성살", "반안살", "역마살", "육해살", "화개살"];

export const POS = ["year", "month", "day", "hour"];
export const POS_KO = { year: "년주", month: "월주", day: "일주", hour: "시주" };

export const mod = (n, m) => ((n % m) + m) % m;
export const ganzhiIndex = (s, b) => { for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i; return -1; };
export const ganzhiName = (s, b) => STEMS[s] + BRANCHES[b];
export const nayin = (s, b) => NAYIN[Math.floor(ganzhiIndex(s, b) / 2)];

/* ── 출생 지역(경도) ─────────────────────────────────── */
export const REGIONS = [
  { id: "seoul", name: "서울", lon: 126.98 },
  { id: "incheon", name: "인천", lon: 126.70 },
  { id: "suwon", name: "경기(수원)", lon: 127.03 },
  { id: "chuncheon", name: "춘천", lon: 127.73 },
  { id: "gangneung", name: "강릉", lon: 128.90 },
  { id: "cheongju", name: "청주", lon: 127.49 },
  { id: "daejeon", name: "대전", lon: 127.38 },
  { id: "jeonju", name: "전주", lon: 127.15 },
  { id: "gwangju", name: "광주", lon: 126.85 },
  { id: "daegu", name: "대구", lon: 128.60 },
  { id: "pohang", name: "포항", lon: 129.37 },
  { id: "ulsan", name: "울산", lon: 129.31 },
  { id: "changwon", name: "창원", lon: 128.68 },
  { id: "busan", name: "부산", lon: 129.08 },
  { id: "jeju", name: "제주", lon: 126.53 },
  { id: "none", name: "보정하지 않음(입력한 시각 그대로)", lon: null },
];
export const regionOf = (id) => REGIONS.find((r) => r.id === id) || REGIONS[0];

/* ── 시간 계산 도우미 ──────────────────────────────── */
let _fmt = null;
function seoulOffsetMin(utcMs) {
  _fmt = _fmt || new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", hourCycle: "h23", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(_fmt.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs) / 60000;
}
// 한국에서 시계로 본 시각 → 세계시(ms). 서머타임·UTC+8:30 시기 반영
export function seoulWallToUtc(y, m, d, h, mi) {
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let t = wall - 540 * 60000;
  for (let i = 0; i < 4; i++) t = wall - seoulOffsetMin(t) * 60000;
  return t;
}
const parts = (ms) => { const x = new Date(ms); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), h: x.getUTCHours(), mi: x.getUTCMinutes(), s: x.getUTCSeconds() }; };
const solarOf = (p) => LIB().fromYmdHms(p.y, p.m, p.d, p.h, p.mi, p.s || 0);
const idxStem = (hz) => STEMS_HJ.indexOf(hz);
const idxBranch = (hz) => BRANCHES_HJ.indexOf(hz);
const splitGZ = (gz) => ({ s: idxStem(gz[0]), b: idxBranch(gz[1]) });

/* ── 한국 음력 ─────────────────────────────────────── */
export function lunarToSolar(y, m, d, leap) {
  const k = new KoreanLunarCalendar();
  if (!k.setLunarDate(y, m, d, !!leap)) return null;
  const s = k.getSolarCalendar();
  if (leap && !k.getLunarCalendar().intercalation) return null; // 그해에 윤달이 없음
  return { y: s.year, m: s.month, d: s.day };
}
export function solarToLunar(y, m, d) {
  const k = new KoreanLunarCalendar();
  if (!k.setSolarDate(y, m, d)) return null;
  const l = k.getLunarCalendar();
  return { y: l.year, m: l.month, d: l.day, leap: !!l.intercalation };
}
export function validDate(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/* ── 십신·운성·신살 ─────────────────────────────────── */
// 일간 dm 에서 본 천간 s 의 십신 번호(0~9)
export function tenGodOfStem(dm, s) {
  const a = STEM_EL[dm], b = STEM_EL[s];
  const same = STEM_YANG[dm] === STEM_YANG[s] ? 0 : 1;
  const rel = mod(b - a, 5); // 0 같음, 1 내가 생함, 2 내가 극함, 3 나를 극함, 4 나를 생함
  return rel * 2 + same;
}
export const tenGodOfBranch = (dm, b) => tenGodOfStem(dm, BRANCH_MAIN[b]);
export const groupOf = (tg) => Math.floor(tg / 2);
export function stageOf(stem, branch) {
  const st = STAGE_START[stem];
  const k = STEM_YANG[stem] ? mod(branch - st, 12) : mod(st - branch, 12);
  return k;
}
export function sinsal12(baseBranch, target) {
  // 삼합의 첫 글자(지살 자리): 인오술→인, 신자진→신, 사유축→사, 해묘미→해
  const first = [8, 5, 2, 11][[8, 0, 4].includes(baseBranch) ? 0 : [5, 9, 1].includes(baseBranch) ? 1 : [2, 6, 10].includes(baseBranch) ? 2 : 3];
  return mod(target - first + 3, 12);
}
export const xunKong = (s, b) => { const start = mod(b - s, 12); return [mod(start + 10, 12), mod(start + 11, 12)]; };

/* ── 핵심: 사주 세우기 ─────────────────────────────── */
/* input: { name, gender:'M'|'F', calendar:'solar'|'lunar', leap, y, m, d, hour, minute, timeUnknown, region, yajasi } */
export function buildChart(input) {
  const Solar = LIB();
  let sol = { y: input.y, m: input.m, d: input.d };
  if (input.calendar === "lunar") {
    sol = lunarToSolar(input.y, input.m, input.d, input.leap);
    if (!sol) throw new Error(input.leap ? "그해 그달에는 윤달이 없습니다. 날짜를 확인해 주세요." : "없는 음력 날짜입니다. 날짜를 확인해 주세요.");
  } else if (!validDate(sol.y, sol.m, sol.d)) {
    throw new Error("없는 날짜입니다. 날짜를 확인해 주세요.");
  }
  const lunar = solarToLunar(sol.y, sol.m, sol.d);
  const unknown = !!input.timeUnknown;
  const hh = unknown ? 12 : input.hour, mm = unknown ? 0 : input.minute;
  const region = regionOf(input.region);

  const utc = seoulWallToUtc(sol.y, sol.m, sol.d, hh, mm);
  const clockOffset = seoulOffsetMin(utc); // 그 당시 한국 시계의 세계시 차이(분)
  const bj = parts(utc + 480 * 60000);      // 절기 계산용(라이브러리 기준시 UTC+8)
  let local;                                 // 일·시주용 시각
  let corrMin = 0;
  if (region.lon == null) {
    local = { y: sol.y, m: sol.m, d: sol.d, h: hh, mi: mm, s: 0 };
  } else {
    const lmt = utc + region.lon * 4 * 60000;
    local = parts(lmt);
    corrMin = Math.round(region.lon * 4 - clockOffset);
  }

  const ecBJ = solarOf(bj).getLunar().getEightChar();
  const ecLocal = solarOf(local).getLunar().getEightChar();
  ecLocal.setSect(input.yajasi ? 2 : 1);

  const Y = splitGZ(ecBJ.getYear()), M = splitGZ(ecBJ.getMonth());
  let D = splitGZ(ecLocal.getDay());
  let H = unknown ? null : splitGZ(ecLocal.getTime());
  if (unknown) {
    // 시각을 모르면 일주는 달력 날짜 그대로
    const e0 = Solar.fromYmdHms(sol.y, sol.m, sol.d, 12, 0, 0).getLunar().getEightChar();
    D = splitGZ(e0.getDay());
  }

  // 시각을 모를 때 절기가 바뀌는 날인지 확인
  let monthUncertain = false;
  if (unknown) {
    const a = splitGZ(solarOf(parts(seoulWallToUtc(sol.y, sol.m, sol.d, 0, 0) + 480 * 60000)).getLunar().getEightChar().getMonth());
    const b = splitGZ(solarOf(parts(seoulWallToUtc(sol.y, sol.m, sol.d, 23, 59) + 480 * 60000)).getLunar().getEightChar().getMonth());
    monthUncertain = a.s !== b.s || a.b !== b.b;
  }

  // 대운
  const yun = ecBJ.getYun(input.gender === "M" ? 1 : 0);
  const startSolar = yun.getStartSolar();
  const dys = yun.getDaYun(11).slice(1).map((dy, i) => {
    const g = splitGZ(dy.getGanZhi());
    return { s: g.s, b: g.b, startYear: startSolar.getYear() + i * 10, startMonth: startSolar.getMonth(), ageMan: yun.getStartYear() + i * 10 };
  });

  const pillars = { year: Y, month: M, day: D, hour: H };
  return {
    input: { ...input },
    solar: sol, lunar,
    region, unknown, monthUncertain,
    clock: { h: hh, mi: mm, offsetMin: clockOffset, dst: (clockOffset === 600 || clockOffset === 570) },
    local, corrMin,
    pillars,
    dm: D.s,
    daeun: {
      forward: yun.isForward(), years: yun.getStartYear(), months: yun.getStartMonth(), days: yun.getStartDay(),
      start: { y: startSolar.getYear(), m: startSolar.getMonth(), d: startSolar.getDay() },
      list: dys,
    },
  };
}

/* ── 분석 ─────────────────────────────────────────── */
export function listChars(chart) {
  // 각 글자: {pos, kind:'stem'|'branch', idx, el}
  const out = [];
  for (const p of POS) {
    const q = chart.pillars[p];
    if (!q) continue;
    out.push({ pos: p, kind: "stem", idx: q.s, el: STEM_EL[q.s] });
    out.push({ pos: p, kind: "branch", idx: q.b, el: BRANCH_EL[q.b] });
  }
  return out;
}

export function elementCount(chart) {
  const c = [0, 0, 0, 0, 0];
  for (const x of listChars(chart)) c[x.el]++;
  return c;
}

// 지장간까지 반영한 오행 세기(정기 60%, 중기 25%, 여기 15% 식으로 나눔)
export function elementWeight(chart) {
  const w = [0, 0, 0, 0, 0];
  for (const p of POS) {
    const q = chart.pillars[p];
    if (!q) continue;
    w[STEM_EL[q.s]] += 1;
    const h = HIDDEN[q.b];
    const share = h.length === 2 ? [0.3, 0.7] : [0.15, 0.25, 0.6];
    h.forEach((s, i) => { w[STEM_EL[s]] += share[i]; });
  }
  return w.map((v) => Math.round(v * 10) / 10);
}

export function tenGodTable(chart) {
  const dm = chart.dm, res = {};
  for (const p of POS) {
    const q = chart.pillars[p];
    if (!q) { res[p] = null; continue; }
    res[p] = {
      stemTG: p === "day" ? null : tenGodOfStem(dm, q.s),
      branchTG: tenGodOfBranch(dm, q.b),
      hidden: HIDDEN[q.b].map((s) => ({ s, tg: tenGodOfStem(dm, s) })),
      stage: stageOf(dm, q.b),
      selfStage: stageOf(q.s, q.b),
      sinsal: sinsal12(chart.pillars.year.b, q.b),
      nayin: nayin(q.s, q.b),
    };
  }
  return res;
}

export function groupCount(chart) {
  const g = [0, 0, 0, 0, 0];
  const dm = chart.dm;
  for (const x of listChars(chart)) {
    if (x.pos === "day" && x.kind === "stem") continue;
    const tg = x.kind === "stem" ? tenGodOfStem(dm, x.idx) : tenGodOfBranch(dm, x.idx);
    g[groupOf(tg)]++;
  }
  return g;
}

export function tenGodCount(chart) {
  const c = new Array(10).fill(0);
  const dm = chart.dm;
  for (const x of listChars(chart)) {
    if (x.pos === "day" && x.kind === "stem") continue;
    c[x.kind === "stem" ? tenGodOfStem(dm, x.idx) : tenGodOfBranch(dm, x.idx)]++;
  }
  return c;
}

// 신강·신약: 일간을 돕는 글자(비겁·인성)의 자리 점수 합
const WEIGHT = { year: { stem: 10, branch: 10 }, month: { stem: 10, branch: 30 }, day: { stem: 0, branch: 15 }, hour: { stem: 10, branch: 15 } };
export function strength(chart) {
  const dm = chart.dm;
  const dmEl = STEM_EL[dm];
  let help = 0, total = 0;
  for (const x of listChars(chart)) {
    const w = WEIGHT[x.pos][x.kind];
    if (!w) continue;
    total += w;
    const el = x.kind === "stem" ? STEM_EL[x.idx] : STEM_EL[BRANCH_MAIN[x.idx]];
    const rel = mod(el - dmEl, 5);
    if (rel === 0 || rel === 4) help += w;
  }
  const score = Math.round((help / total) * 100);
  let level;
  if (score < 25) level = "많이 약한 편";
  else if (score < 45) level = "약한 편";
  else if (score <= 55) level = "균형 잡힌 편";
  else if (score <= 75) level = "강한 편";
  else level = "많이 강한 편";
  const monthHelps = [0, 4].includes(mod(STEM_EL[BRANCH_MAIN[chart.pillars.month.b]] - dmEl, 5));
  return { score, level, strong: score > 55, weak: score < 45, monthHelps };
}

// 억부 방식의 간단한 용신: 신약이면 돕는 기운, 신강이면 덜어 내는 기운
export function yongsin(chart) {
  const st = strength(chart);
  const g = groupCount(chart);
  const dmEl = STEM_EL[chart.dm];
  const elOfGroup = (gi) => mod(dmEl + [0, 1, 2, 3, 4][gi], 5);
  // use: 용신 무리, help: 희신 무리 (0 비겁, 1 식상, 2 재성, 3 관성, 4 인성)
  let use, help, reason;
  if (st.weak) {
    if (g[2] >= g[1] && g[2] >= g[3]) { use = 0; help = 4; reason = "재성이 많아 몸이 약해진 사주라, 같은 기운(비겁)으로 힘을 보태는 것이 좋습니다."; }
    else { use = 4; help = 0; reason = (g[3] >= g[1] ? "관성의 압박이" : "식상으로 빠져나가는 기운이") + " 커서 일간이 약하므로, 나를 돕는 기운(인성)이 필요합니다."; }
  } else if (st.strong) {
    if (g[4] > g[0]) { use = 2; help = 1; reason = "인성이 넘쳐 생각과 의지가 한쪽으로 쏠리기 쉬워, 재성으로 균형을 잡는 것이 좋습니다."; }
    else if (g[3] > 0) { use = 3; help = 2; reason = "같은 기운(비겁)이 강해 고집이 세지기 쉬우므로, 관성으로 틀을 잡아 주는 것이 좋습니다."; }
    else { use = 1; help = 2; reason = "같은 기운(비겁)이 강해 넘치는 힘을 식상으로 풀어내는 것이 좋습니다."; }
  } else {
    const c = elementCount(chart);
    const minEl = c.indexOf(Math.min(...c));
    return { level: st, useEl: minEl, helpEl: mod(minEl - 1, 5), avoidEl: mod(minEl - 2, 5), group: null,
      reason: "일간의 힘이 고른 편이라, 가장 부족한 오행을 채우는 쪽으로 봅니다." };
  }
  const useEl = elOfGroup(use);
  // 기신: 용신을 누르는 오행
  return { level: st, useEl, helpEl: elOfGroup(help), avoidEl: mod(useEl - 2, 5), group: use, reason };
}

/* ── 합·충·형·파·해 ─────────────────────────────────── */
const STEM_HAP = { "0-5": "토", "1-6": "금", "2-7": "수", "3-8": "목", "4-9": "화" };
const STEM_CHUNG = ["0-6", "1-7", "2-8", "3-9"];
const YUKHAP = { "0-1": "토", "2-11": "목", "3-10": "화", "4-9": "금", "5-8": "수", "6-7": "화" };
const CHUNG = ["0-6", "1-7", "2-8", "3-9", "4-10", "5-11"];
const PA = ["0-9", "1-4", "2-11", "3-6", "5-8", "7-10"];
const HAE = ["0-7", "1-6", "2-5", "3-4", "8-11", "9-10"];
const WONJIN = ["0-7", "1-6", "2-9", "3-8", "4-11", "5-10"];
const GWIMUN = ["0-9", "1-6", "2-7", "3-8", "4-11", "5-10"];
const SAMHAP = [{ set: [8, 0, 4], el: "수", king: 0 }, { set: [11, 3, 7], el: "목", king: 3 }, { set: [2, 6, 10], el: "화", king: 6 }, { set: [5, 9, 1], el: "금", king: 9 }];
const BANGHAP = [{ set: [2, 3, 4], el: "목" }, { set: [5, 6, 7], el: "화" }, { set: [8, 9, 10], el: "금" }, { set: [11, 0, 1], el: "수" }];
const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// 파는 관례상 부르는 순서가 따로 있다(술미파, 사신파 등).
const PA_NAME = { "0-9": "자유", "1-4": "축진", "2-11": "인해", "3-6": "묘오", "5-8": "사신", "7-10": "술미" };
export function relations(chart) {
  const ps = POS.filter((p) => chart.pillars[p]);
  const out = [];
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const A = chart.pillars[ps[i]], B = chart.pillars[ps[j]];
    const where = `${POS_KO[ps[i]]}·${POS_KO[ps[j]]}`;
    const sk = key(A.s, B.s), bk = key(A.b, B.b);
    // 이름은 흔히 부르는 순서(자축인묘… 앞 글자 먼저)로 통일한다.
    const s2 = STEMS[Math.min(A.s, B.s)] + STEMS[Math.max(A.s, B.s)];
    const b2 = BRANCHES[Math.min(A.b, B.b)] + BRANCHES[Math.max(A.b, B.b)];
    if (STEM_HAP[sk]) out.push({ type: "천간합", text: `${s2}합(${STEM_HAP[sk]})`, where });
    if (STEM_CHUNG.includes(sk)) out.push({ type: "천간충", text: `${s2}충`, where });
    if (YUKHAP[bk]) out.push({ type: "육합", text: `${b2}합(${YUKHAP[bk]})`, where });
    if (CHUNG.includes(bk)) out.push({ type: "충", text: `${b2}충`, where });
    if (PA.includes(bk)) out.push({ type: "파", text: `${PA_NAME[bk] || b2}파`, where });
    if (HAE.includes(bk)) out.push({ type: "해", text: `${b2}해`, where });
    if (WONJIN.includes(bk)) out.push({ type: "원진", text: `${b2} 원진`, where });
    if (GWIMUN.includes(bk)) out.push({ type: "귀문", text: `${b2} 귀문`, where });
    // 형
    const t1 = [2, 5, 8], t2 = [1, 10, 7];
    if (A.b !== B.b && t1.includes(A.b) && t1.includes(B.b)) out.push({ type: "형", text: `${b2}형(인사신 삼형의 일부)`, where });
    if (A.b !== B.b && t2.includes(A.b) && t2.includes(B.b)) out.push({ type: "형", text: `${b2}형(축술미 삼형의 일부)`, where });
    if (bk === "0-3") out.push({ type: "형", text: "자묘형(서로 형)", where });
    if (A.b === B.b && [4, 6, 9, 11].includes(A.b)) out.push({ type: "형", text: `${b2} 자형`, where });
  }
  const bs = ps.map((p) => chart.pillars[p].b);
  for (const h of SAMHAP) {
    const n = h.set.filter((x) => bs.includes(x)).length;
    if (n === 3) out.push({ type: "삼합", text: `${h.set.map((x) => BRANCHES[x]).join("")} 삼합(${h.el})`, where: "사주 전체" });
    else if (n === 2 && bs.includes(h.king)) out.push({ type: "반합", text: `${h.set.filter((x) => bs.includes(x)).map((x) => BRANCHES[x]).join("")} 반합(${h.el})`, where: "사주 전체" });
  }
  for (const h of BANGHAP) {
    if (h.set.every((x) => bs.includes(x))) out.push({ type: "방합", text: `${h.set.map((x) => BRANCHES[x]).join("")} 방합(${h.el})`, where: "사주 전체" });
  }
  return out;
}

// 운(대운·세운·일진)의 지지와 원국 지지 사이 관계
export function branchRelToChart(chart, b) {
  const res = [];
  for (const p of POS) {
    const q = chart.pillars[p];
    if (!q) continue;
    const k = key(q.b, b);
    if (CHUNG.includes(k)) res.push({ type: "충", pos: p });
    if (YUKHAP[k]) res.push({ type: "합", pos: p });
  }
  return res;
}

/* ── 신살 ─────────────────────────────────────────── */
const CHEONEUL = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [3, 5], [3, 5]];
const MUNCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];
const YANGIN = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 };
const HONGYEOM = [6, 6, 2, 7, 4, 4, 10, 9, 0, 8];
const GOEGANG = ["경진", "경술", "임진", "임술", "무술"];
const BAEKHO = ["갑진", "을미", "병술", "정축", "무진", "임술", "계축"];

export function specialSinsal(chart) {
  const dm = chart.dm, out = [];
  const ps = POS.filter((p) => chart.pillars[p]);
  const at = (pred) => ps.filter((p) => pred(chart.pillars[p]));
  const add = (id, where) => { if (where.length) out.push({ id, where: where.map((p) => POS_KO[p]) }); };
  add("천을귀인", at((q) => CHEONEUL[dm].includes(q.b)));
  add("문창귀인", at((q) => q.b === MUNCHANG[dm]));
  if (YANGIN[dm] !== undefined) add("양인살", at((q) => q.b === YANGIN[dm]));
  add("홍염살", at((q) => q.b === HONGYEOM[dm]));
  const yb = chart.pillars.year.b, db = chart.pillars.day.b;
  // 년지 기준은 년주를, 일지 기준은 일주를 빼고 본다(자기 자신을 기준으로 삼지 않음)
  const bySal = (sal) => ps.filter((p) => {
    const b = chart.pillars[p].b;
    return (p !== "year" && sinsal12(yb, b) === sal) || (p !== "day" && sinsal12(db, b) === sal);
  });
  add("도화살", bySal(4));
  add("역마살", bySal(9));
  add("화개살", bySal(11));
  add("괴강살", at((q) => GOEGANG.includes(ganzhiName(q.s, q.b))));
  add("백호살", at((q) => BAEKHO.includes(ganzhiName(q.s, q.b))));
  const kong = xunKong(chart.pillars.day.s, chart.pillars.day.b);
  const kw = ps.filter((p) => p !== "day" && kong.includes(chart.pillars[p].b));
  out.push({ id: "공망", where: kw.map((p) => POS_KO[p]), kong: kong.map((b) => BRANCHES[b]) });
  return out;
}

/* ── 운의 흐름 ─────────────────────────────────────── */
export const yearGZ = (y) => { const i = mod(y - 4, 60); return { s: i % 10, b: i % 12 }; };
// 해당 연도의 월주(인월부터 축월까지) + 절입일(한국 시간)
export function monthsOfYear(y) {
  const Solar = LIB();
  const ys = yearGZ(y).s;
  const first = mod((ys % 5) * 2 + 2, 10);
  const names = ["立春", "惊蛰", "清明", "立夏", "芒种", "小暑", "立秋", "白露", "寒露", "立冬", "大雪", "小寒"];
  const ko = ["입춘", "경칩", "청명", "입하", "망종", "소서", "입추", "백로", "한로", "입동", "대설", "소한"];
  const tbl = Solar.fromYmd(y, 6, 1).getLunar().getJieQiTable(); // 6월 1일이 든 음력 해의 절기표
  return names.map((n, i) => {
    const sol = i < 11 ? tbl[n] : tbl["XIAO_HAN"]; // 소한은 다음 해 1월
    const t = Date.UTC(sol.getYear(), sol.getMonth() - 1, sol.getDay(), sol.getHour(), sol.getMinute()) + 60 * 60000; // UTC+8 → UTC+9
    const k = parts(t);
    return { s: mod(first + i, 10), b: mod(2 + i, 12), term: ko[i], start: k };
  });
}
export function dayGZ(y, m, d) {
  const e = LIB().fromYmdHms(y, m, d, 12, 0, 0).getLunar().getEightChar();
  return splitGZ(e.getDay());
}
export function todayKST() {
  const p = parts(Date.now() + 540 * 60000);
  return { y: p.y, m: p.m, d: p.d, h: p.h, mi: p.mi };
}
// 오늘의 년·월·일 간지(한국 시간 기준)
export function todayPillars() {
  const t = todayKST();
  const bj = parts(seoulWallToUtc(t.y, t.m, t.d, t.h, t.mi) + 480 * 60000);
  const e = solarOf(bj).getLunar().getEightChar();
  return { year: splitGZ(e.getYear()), month: splitGZ(e.getMonth()), day: dayGZ(t.y, t.m, t.d), date: t };
}
export function currentDaeun(chart, y = todayKST().y, m = todayKST().m) {
  const list = chart.daeun.list;
  const v = y * 12 + m;
  let cur = -1;
  list.forEach((d, i) => { if (d.startYear * 12 + d.startMonth <= v) cur = i; });
  return cur;
}
