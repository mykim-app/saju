/* 자미두수(紫微斗數) 명반 계산.
   실제 별자리 배치 계산은 오픈소스 라이브러리 iztro(MIT 라이선스)가 한다.
   이 파일은 그 결과를 우리 사이트 형식에 맞게 정리하고, 밝기 코드를
   한글 용어로 바꾸는 정도의 얇은 래퍼다. assets/jami-data.js에 풀이 문구가 있다.

   출처: iztro — https://github.com/SylarLong/iztro (MIT License)
   assets/vendor/iztro.min.js 로 내려받아 그대로 씀. */
import { BRIGHTNESS_MEANING } from "./jami-data.js";

function lib() {
  const iztro = globalThis.iztro;
  if (!iztro) throw new Error("자미두수 계산 파일(assets/vendor/iztro.min.js)을 불러오지 못했습니다.");
  return iztro;
}

// 시(0~23시)를 iztro가 쓰는 시진 번호(0~12, 0=조자시 00시대, 12=야자시 23시대)로 바꾼다.
export function timeIndexOf(hour) {
  return Math.floor((hour + 1) / 2);
}

// {name, gender, calendar, leap, y, m, d, hour} 형태(사주 입력과 같은 모양)를 받아
// iztro 명반 객체를 돌려준다. 자미두수는 태어난 시각이 명궁·신궁부터 갈라지므로
// 시간을 모르면 애초에 계산할 수 없다 — 호출하는 쪽에서 시간을 반드시 받아야 한다.
export function buildChart({ gender, calendar, leap, y, m, d, hour }) {
  const iztro = lib();
  const dateStr = `${y}-${m}-${d}`;
  const genderStr = gender === "M" ? "男" : "女";
  const ti = timeIndexOf(hour);
  const astrolabe = calendar === "lunar"
    ? iztro.astro.byLunar(dateStr, ti, genderStr, !!leap, true, "ko-KR")
    : iztro.astro.bySolar(dateStr, ti, genderStr, true, "ko-KR");
  return astrolabe;
}

export function soulPalace(astrolabe) {
  return astrolabe.palaces.find((p) => p.name === "명궁");
}
export function bodyPalace(astrolabe) {
  return astrolabe.palaces.find((p) => p.isBodyPalace);
}

// [+2] 같은 밝기 코드를 { label: "왕", desc: "..." } 형태로 바꾼다. 모르는 코드가
// 오면(라이브러리가 나중에 바뀔 경우 대비) 원래 코드를 그대로 보여 준다.
export function brightnessOf(code) {
  if (!code) return null;
  return BRIGHTNESS_MEANING[code] || { label: code, desc: "" };
}

// 한 궁에 놓인 별을 전부 한 배열로(주성 → 보조성 → 잡성 순서) 모은다.
export function allStarsOf(palace) {
  return [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
}
