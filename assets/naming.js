/* ── 한자 이름(성명학) ─────────────────────────────────────
   한자 이름을 넣으면 획수로 오행을 뽑아 사주와 함께 봅니다.

   - 획수는 "원획"을 씁니다. 부수를 획이 줄기 전의 본래 글자로 보고 센
     획수입니다. 예를 들어 삼수변(氵)은 쓸 때는 3획이지만 본래 글자인
     水(물 수)로 보아 4획으로 셉니다. 이 계산을 하지 않으면(필획만 세면)
     사격의 숫자 자체가 달라져 버립니다.
   - 오행은 획수의 끝자리로 봅니다: 1·2획 목, 3·4획 화, 5·6획 토,
     7·8획 금, 9·0(10)획 수.
   - 사격(원격·형격·이격·정격)은 성 1자·이름 1~2자 이름을 기준으로 계산합니다.
     이 네 숫자를 81수리 표에 대조해 길흉을 매기는 방법도 있지만, 그 표는
     문헌과 유파마다 배정이 달라 이 사이트에서는 다루지 않습니다.
   - 발음오행(부르는 소리의 오행)도 함께 봅니다. 다만 이 분류도 유파에 따라
     차이가 있어(특히 ㅁㅂㅍ, ㅇㅎ을 어디로 볼지), 참고용으로만 보여 줍니다.

   데이터 출처와 라이선스는 assets/hanja-data.js 주석 참고. */
import { CHARS, READS, STROKES, KNOWN } from "./hanja-data.js";
import { ELEMENTS, ELEMENTS_HJ } from "./saju-core.js";

const IDX = new Map();
for (let i = 0; i < CHARS.length; i++) IDX.set(CHARS[i], i);

export function hanjaInfo(ch) {
  const i = IDX.get(ch);
  if (i == null) return null;
  return { char: ch, reading: READS[i], strokes: Number(STROKES.slice(i * 2, i * 2 + 2)), known: KNOWN[i] === "1" };
}

export function elementOfStrokes(n) {
  const last = n % 10;
  if (last === 1 || last === 2) return 0;
  if (last === 3 || last === 4) return 1;
  if (last === 5 || last === 6) return 2;
  if (last === 7 || last === 8) return 3;
  return 4; // 9 또는 0
}

// 성이 두 글자인 복성(널리 쓰이는 것만)
const DOUBLE_SURNAMES = ["남궁", "황보", "제갈", "선우", "서문", "사공", "독고", "동방", "망절"];

export function surnameLen(hangulName) {
  const two = hangulName.slice(0, 2);
  return DOUBLE_SURNAMES.includes(two) ? 2 : 1;
}

// 두음법칙: 이름 맨 앞 글자에서만 ㄹ·ㄴ이 ㅇ·ㄴ으로 바뀌는 것을 대략 반영(참고 표시용)
function leadingSoundRule(syll) {
  const code = syll.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return syll;
  const cho = Math.floor(code / 588); // 초성 순서: ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ
  const jung = Math.floor((code % 588) / 28);
  const jong = code % 28;
  const YEO = [2, 6, 7, 12, 17, 20]; // ㅑㅕㅖㅛㅠㅣ 인덱스(중성표 기준: ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ)
  if (cho === 5) { // ㄹ
    const newCho = YEO.includes(jung) ? 11 : 2; // ㅇ 또는 ㄴ
    return String.fromCharCode(0xac00 + newCho * 588 + jung * 28 + jong);
  }
  if (cho === 2 && YEO.includes(jung)) { // ㄴ + 야여예요유이
    return String.fromCharCode(0xac00 + 11 * 588 + jung * 28 + jong);
  }
  return syll;
}

// 발음오행: 초성 위치(아설순치후)를 오행으로. 학파에 따라 결과가 다를 수 있는 글자는 ㅇㅎ·ㅁㅂㅍ.
const CHO_EL = [0, 0, 1, 1, 1, 1, 4, 4, 4, 3, 3, 2, 3, 3, 3, 0, 1, 4, 2];
export function soundElement(syll) {
  const code = syll.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  return CHO_EL[Math.floor(code / 588)];
}

// 대표 음 말고 이름에 흔히 쓰는 다른 음
const ALT_READ = { "金": "김", "車": "거", "宅": "댁", "復": "부", "更": "갱", "北": "배", "便": "편", "率": "률솔",
  "樂": "락요", "說": "세열", "惡": "오", "參": "삼", "識": "지", "行": "항", "見": "현", "易": "이", "則": "즉",
  "洞": "통", "切": "체", "拓": "탁", "茶": "차", "刺": "척", "度": "탁", "降": "항", "丹": "란", "否": "비" };

// 한글로 적은 음과 한자 음이 맞는지(두음법칙과 다른 음까지 허용)
function readingMatches(typed, ch, reading) {
  if (typed === reading || leadingSoundRule(reading) === typed) return true;
  const alt = ALT_READ[ch] || "";
  return [...alt].some((r) => r === typed || leadingSoundRule(r) === typed);
}

let REVERSE = null;
function buildReverse() {
  if (REVERSE) return REVERSE;
  REVERSE = new Map();
  const add = (syll, ch) => {
    if (!REVERSE.has(syll)) REVERSE.set(syll, []);
    const arr = REVERSE.get(syll);
    if (!arr.includes(ch)) arr.push(ch);
  };
  for (let i = 0; i < CHARS.length; i++) add(READS[i], CHARS[i]);
  for (const [ch, alt] of Object.entries(ALT_READ)) for (const r of alt) add(r, ch);
  // 사전에 뜻풀이가 있는(더 널리 쓰일 가능성이 큰) 글자를 앞에, 그 안에서는 획수가 적은 순으로 둔다.
  for (const arr of REVERSE.values()) {
    arr.sort((a, b) => {
      const ia = hanjaInfo(a), ib = hanjaInfo(b);
      if (ia.known !== ib.known) return ia.known ? -1 : 1;
      return ia.strokes - ib.strokes;
    });
  }
  return REVERSE;
}

// 한글 음(예: "민")으로 후보 한자를 찾는다. 획수 적은 순으로 정렬해 돌려준다.
// 두음법칙이 적용된 음(예: "이")으로 찾을 때는 본래 음(리 등)의 후보도 함께 더한다.
// 부수 변형 글자(氵忄扌艹辶阝礻衤耂)는 낱자로는 실제 이름에 쓰이지 않으므로 후보에서 뺀다.
const RADICAL_ONLY = new Set([..."氵忄扌艹辶阝礻衤耂"]);

export function candidatesFor(syll) {
  const set = new Map();
  const put = (ch) => { if (!RADICAL_ONLY.has(ch) && !set.has(ch)) set.set(ch, hanjaInfo(ch)); };
  (buildReverse().get(syll) || []).forEach(put);
  const code = syll.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) {
    const jung = Math.floor((code % 588) / 28), jong = code % 28;
    const cho = Math.floor(code / 588);
    if (cho === 11) { // ㅇ으로 시작 → 두음법칙 전 ㄹ·ㄴ 음도 찾아본다
      (buildReverse().get(String.fromCharCode(0xac00 + 5 * 588 + jung * 28 + jong)) || []).forEach(put);
      (buildReverse().get(String.fromCharCode(0xac00 + 2 * 588 + jung * 28 + jong)) || []).forEach(put);
    } else if (cho === 2) { // ㄴ으로 시작 → 두음법칙 전 ㄹ 음도 찾아본다
      (buildReverse().get(String.fromCharCode(0xac00 + 5 * 588 + jung * 28 + jong)) || []).forEach(put);
    }
  }
  return [...set.values()].sort((a, b) => (a.known !== b.known ? (a.known ? -1 : 1) : a.strokes - b.strokes));
}

const GEN = [1, 2, 3, 4, 0]; // 목생화 화생토 토생금 금생수 수생목
const CTRL = [2, 3, 4, 0, 1]; // 목극토 화극금 토극수 금극목 수극화

// 이름(한글 전체) + 한자 배열로 성명학 정보를 계산한다.
// hanjaChars: 한글 이름과 같은 길이의 한자 배열
export function analyzeName(hangulName, hanjaChars) {
  if (hanjaChars.length !== hangulName.length) return { error: "한자와 한글의 글자 수가 다릅니다." };
  const chars = [];
  for (let i = 0; i < hanjaChars.length; i++) {
    const info = hanjaInfo(hanjaChars[i]);
    if (!info) return { error: `‘${hanjaChars[i]}’ 글자의 획수 정보를 찾지 못했습니다.` };
    chars.push({ ...info, hangul: hangulName[i], el: elementOfStrokes(info.strokes),
      match: readingMatches(hangulName[i], info.char, info.reading) });
  }
  const sLen = surnameLen(hangulName);
  const surname = chars.slice(0, sLen);
  const given = chars.slice(sLen);
  const sum = (arr) => arr.reduce((a, c) => a + c.strokes, 0);
  const mod81 = (n) => ((n - 1) % 81) + 1;
  const sagyeok = given.length
    ? {
        won: { label: "원격(元格)", period: "초년운", n: mod81(sum(given)) },
        hyeong: { label: "형격(亨格)", period: "청년·장년운", n: mod81(sum(surname) + given[0].strokes) },
        i: { label: "이격(利格)", period: "중년운", n: mod81(sum(surname) + given[given.length - 1].strokes) },
        jeong: { label: "정격(貞格)", period: "노년·총운", n: mod81(sum(surname) + sum(given)) },
      }
    : null;

  const elCount = [0, 0, 0, 0, 0];
  chars.forEach((c) => elCount[c.el]++);

  const soundEls = [...hangulName].map(soundElement).filter((e) => e != null);
  let soundFlow = null;
  if (soundEls.length >= 2) {
    // 앞뒤 어느 쪽에서 살려 주든 상생, 어느 쪽이 누르든 상극, 같은 오행이면 비화로 센다.
    let gen = 0, ctrl = 0, same = 0;
    for (let i = 0; i < soundEls.length - 1; i++) {
      const a = soundEls[i], b = soundEls[i + 1];
      if (a === b) same++;
      else if (GEN[a] === b || GEN[b] === a) gen++;
      else ctrl++;
    }
    soundFlow = { els: soundEls, gen, ctrl, same, steps: soundEls.length - 1 };
  }

  const mismatch = chars.filter((c) => !c.match);
  return { chars, surname, given, sagyeok, elCount, soundFlow, sLen, mismatch };
}
