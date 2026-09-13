/* ── 궁합 ──────────────────────────────────────────────────
   두 사람의 사주를 견주어 보는 전통적인 방법 몇 가지를 계산한다.
   - 띠(연지) 궁합: 삼합·육합·방합(좋음) / 원진·형·해·충(주의)
   - 일주 궁합: 일간끼리 관계(합·상생·상극) + 일지끼리 관계(부부·애정 자리로 봄)
   - 십성으로 본 서로의 자리: 상대의 일간이 나에게 어떤 십성인지
   - 오행으로 서로 채워주는 정도: 상대 사주에 내 용신·기신이 얼마나 있는지
   - 납음오행 궁합: 두 일주 납음의 오행끼리 상생·상극

   궁합을 보는 법은 유파·문헌마다 차이가 커서(어느 자리를 더 중요하게 볼지,
   어떤 관계를 얼마나 크게 반영할지) 여기서는 흔히 쓰이는 방법을 소개하는
   수준으로만 다룬다. 하나의 숫자로 등급을 매기되, 그 숫자 자체는 화면에
   보이지 않게 하고 이유를 문장으로 풀어서 보여 준다. */
import * as C from "./saju-core.js";

const GEN = [1, 2, 3, 4, 0]; // 목생화 화생토 토생금 금생수 수생목
const T1 = [2, 5, 8], T2 = [1, 10, 7]; // 인사신 삼형, 축술미 삼형(두 글자만 겹쳐도 형으로 봄)

// 두 지지 사이의 관계 중 대표적인 것 하나. 여러 관계가 겹치는 경우는 드물어
// 합 > 충 > 나머지(원진·귀문·파·해·형) 순으로 하나만 고른다.
export function branchRelation(ba, bb) {
  if (ba === bb) return { type: "동일", tag: "mid" };
  const k = C.key(ba, bb);
  if (C.YUKHAP[k]) return { type: "육합", el: C.YUKHAP[k], tag: "good" };
  for (const g of C.SAMHAP) if (g.set.includes(ba) && g.set.includes(bb)) return { type: "삼합", el: g.el, tag: "good" };
  for (const g of C.BANGHAP) if (g.set.includes(ba) && g.set.includes(bb)) return { type: "방합", el: g.el, tag: "good" };
  if (C.CHUNG.includes(k)) return { type: "충", tag: "warn" };
  if (C.WONJIN.includes(k)) return { type: "원진", tag: "warn" };
  if (C.GWIMUN.includes(k)) return { type: "귀문", tag: "warn" };
  if (C.PA.includes(k)) return { type: "파", tag: "warn" };
  if (C.HAE.includes(k)) return { type: "해", tag: "warn" };
  if ((T1.includes(ba) && T1.includes(bb)) || (T2.includes(ba) && T2.includes(bb)) || k === "0-3") return { type: "형", tag: "warn" };
  return { type: "무관", tag: "mid" };
}

export function stemRelation(sa, sb) {
  if (sa === sb) return { type: "동일", tag: "mid" };
  const k = C.key(sa, sb);
  if (C.STEM_HAP[k]) return { type: "간합", el: C.STEM_HAP[k], tag: "good" };
  if (C.STEM_CHUNG.includes(k)) return { type: "충", tag: "warn" };
  const ea = C.STEM_EL[sa], eb = C.STEM_EL[sb];
  if (ea === eb) return { type: "비화", tag: "mid" };
  if (GEN[ea] === eb) return { type: "상생", dir: "a2b", tag: "good" };
  if (GEN[eb] === ea) return { type: "상생", dir: "b2a", tag: "good" };
  return { type: "상극", tag: "warn" };
}

// 납음오행 이름의 마지막 글자(금목수화토)로 오행 인덱스를 찾는다.
function nayinEl(s, b) {
  const name = C.nayin(s, b);
  return C.ELEMENTS.indexOf(name[name.length - 1]);
}

export function nayinRelation(sa, ba, sb, bb) {
  const ea = nayinEl(sa, ba), eb = nayinEl(sb, bb);
  if (ea === eb) return { type: "비화", ea, eb, tag: "mid" };
  if (GEN[ea] === eb) return { type: "상생", dir: "a2b", ea, eb, tag: "good" };
  if (GEN[eb] === ea) return { type: "상생", dir: "b2a", ea, eb, tag: "good" };
  return { type: "상극", ea, eb, tag: "warn" };
}

// score: 합·상생 등 좋은 관계는 +, 충·상극 등은 - 로 더해 종합 등급을 매긴다.
// 이 점수는 화면에 숫자로 보여 주지 않고, 좋음/보통/조심 세 등급으로만 쓴다.
// sok(속궁합) = false이면 일지(배우자 자리)·납음오행은 점수에 넣지 않는다.
export function analyzeCompat(a, b, opts = {}) {
  const sok = opts.sok !== false;
  const A = a.pillars, B = b.pillars;
  const year = branchRelation(A.year.b, B.year.b);
  const dayBranch = branchRelation(A.day.b, B.day.b);
  const dayStem = stemRelation(A.day.s, B.day.s);
  const nayin = nayinRelation(A.day.s, A.day.b, B.day.s, B.day.b);

  const tgBonA = C.tenGodOfStem(a.dm, b.dm); // B가 A에게 어떤 십성인지
  const tgAonB = C.tenGodOfStem(b.dm, a.dm); // A가 B에게 어떤 십성인지

  const ysA = C.yongsin(a), ysB = C.yongsin(b);
  const cntB = C.elementCount(b), cntA = C.elementCount(a);
  const helpForA = cntB[ysA.useEl] + cntB[ysA.helpEl]; // B의 사주에 A가 필요로 하는 기운이 얼마나 있나
  const hurtForA = cntB[ysA.avoidEl];
  const helpForB = cntA[ysB.useEl] + cntA[ysB.helpEl];
  const hurtForB = cntA[ysB.avoidEl];

  let score = 0;
  const bump = (rel, good = 2, warn = -2) => { if (rel.tag === "good") score += good; else if (rel.tag === "warn") score += warn; };
  bump(year, 2, -2);
  if (sok) bump(dayBranch, 3, -3); // 일지(배우자 자리)는 속궁합을 볼 때만 크게 반영
  bump(dayStem, 2, -1);
  if (sok) bump(nayin, 1, -1);
  score += Math.min(helpForA, 3) - hurtForA;
  score += Math.min(helpForB, 3) - hurtForB;

  const tier = score >= 5 ? "good" : score >= 0 ? "mid" : "warn";
  const label = { good: "좋음", mid: "보통", warn: "조심" }[tier];

  return { year, dayBranch, dayStem, nayin, tgBonA, tgAonB, ysA, ysB, helpForA, hurtForA, helpForB, hurtForB, tier, label, sok };
}

// 만 나이(생일이 지났는지까지 반영)
export function ageManOf(chart) {
  const s = chart.solar;
  const t = C.todayKST();
  let age = t.y - s.y;
  if (t.m < s.m || (t.m === s.m && t.d < s.d)) age--;
  return age;
}

// 속궁합(일지·납음오행)을 보여 줘도 되는 경우인지: 둘 다 만 20세 이상이고, 성별이 남녀 한 쌍일 때만.
export function sokAllowed(chartA, chartB) {
  return ageManOf(chartA) >= 20 && ageManOf(chartB) >= 20 && chartA.input.gender !== chartB.input.gender;
}
