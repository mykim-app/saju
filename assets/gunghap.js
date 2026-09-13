import * as C from "./saju-core.js";
import { renderCompatReport } from "./gunghap-report.js";
import { bindPdfButton } from "./pdf.js";

const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let last = null; // { a: {...}, b: {...} }

function yearOptions(sel) {
  const now = C.todayKST().y;
  let h = "";
  for (let y = now; y >= 1900; y--) h += `<option value="${y}" ${y === sel ? "selected" : ""}>${y}년</option>`;
  return h;
}
const numOptions = (from, to, sel, unit) => { let h = ""; for (let i = from; i <= to; i++) h += `<option value="${i}" ${i === sel ? "selected" : ""}>${i}${unit}</option>`; return h; };

const DEFAULT_PERSON = { name: "", gender: "", calendar: "solar", leap: false, y: 1990, m: 1, d: 1, time: "", timeUnknown: false, region: "seoul", yajasi: false };

// prefix: "a" 또는 "b". id·name 속성이 겹치지 않도록 접두사를 붙인다.
function personFields(prefix, label, v) {
  const id = (n) => `${prefix}_${n}`;
  return `
  <fieldset class="pblock">
    <legend class="pblock-title">${label}</legend>
    <div class="field">
      <label class="label" for="${id("name")}">이름</label>
      <input class="input" id="${id("name")}" name="${id("pname")}" maxlength="20" autocomplete="name" value="${esc(v.name)}" required>
    </div>

    <fieldset class="field" style="border:0;padding:0;margin:0">
      <legend class="label">성별</legend>
      <div class="seg">
        <label><input type="radio" name="${id("gender")}" value="M" ${v.gender === "M" ? "checked" : ""}><span>남성</span></label>
        <label><input type="radio" name="${id("gender")}" value="F" ${v.gender === "F" ? "checked" : ""}><span>여성</span></label>
      </div>
      <p class="help">대운이 흘러가는 방향을 정할 때 씁니다.</p>
    </fieldset>

    <fieldset class="field" style="border:0;padding:0;margin:0">
      <legend class="label">생년월일</legend>
      <div class="seg" style="margin-bottom:8px">
        <label><input type="radio" name="${id("calendar")}" value="solar" ${v.calendar === "solar" ? "checked" : ""}><span>양력</span></label>
        <label><input type="radio" name="${id("calendar")}" value="lunar" ${v.calendar === "lunar" ? "checked" : ""}><span>음력</span></label>
      </div>
      <div class="row">
        <select class="input" name="${id("y")}" aria-label="태어난 해">${yearOptions(v.y)}</select>
        <select class="input" name="${id("m")}" aria-label="태어난 달">${numOptions(1, 12, v.m, "월")}</select>
        <select class="input" name="${id("d")}" aria-label="태어난 날">${numOptions(1, 31, v.d, "일")}</select>
      </div>
      <label class="check" id="${id("leap-wrap")}" ${v.calendar === "lunar" ? "" : "hidden"}><input type="checkbox" name="${id("leap")}" ${v.leap ? "checked" : ""}> 윤달</label>
    </fieldset>

    <div class="field">
      <label class="label" for="${id("time")}">태어난 시각</label>
      <div class="row" style="align-items:center">
        <input class="input" type="time" id="${id("time")}" name="${id("time")}" value="${esc(v.time)}" ${v.timeUnknown ? "disabled" : ""}>
        <label class="check" style="flex:0 0 auto"><input type="checkbox" name="${id("timeUnknown")}" ${v.timeUnknown ? "checked" : ""}> 모름</label>
      </div>
    </div>

    <div class="field">
      <label class="label" for="${id("region")}">태어난 곳</label>
      <select class="input" id="${id("region")}" name="${id("region")}">
        ${C.REGIONS.map((r) => `<option value="${r.id}" ${r.id === v.region ? "selected" : ""}>${r.name}</option>`).join("")}
      </select>
    </div>

    <details class="more">
      <summary>세부 설정</summary>
      <label class="check"><input type="checkbox" name="${id("yajasi")}" ${v.yajasi ? "checked" : ""}> 밤 11시~자정 출생은 날짜를 넘기지 않음(야자시)</label>
    </details>
  </fieldset>`;
}

function renderForm(msg) {
  const va = (last && last.a) || DEFAULT_PERSON;
  const vb = (last && last.b) || DEFAULT_PERSON;
  app.innerHTML = `
  <form class="entry" id="f" novalidate>
    ${personFields("a", "사람 1", va)}
    ${personFields("b", "사람 2", vb)}
    <div id="msg">${msg ? `<div class="err">${esc(msg)}</div>` : ""}</div>
    <button class="btn" type="submit">궁합 보기</button>
  </form>`;

  const f = document.getElementById("f");
  f.addEventListener("change", (e) => {
    for (const p of ["a", "b"]) {
      if (e.target.name === `${p}_calendar`) document.getElementById(`${p}_leap-wrap`).hidden = f.elements[`${p}_calendar`].value !== "lunar";
      if (e.target.name === `${p}_timeUnknown`) { f.elements[`${p}_time`].disabled = e.target.checked; if (e.target.checked) f.elements[`${p}_time`].value = ""; }
    }
  });
  f.addEventListener("submit", onSubmit);
}

function readPerson(el, prefix) {
  const g = (n) => el[`${prefix}_${n}`];
  return {
    name: g("pname").value.trim(),
    gender: g("gender").value,
    calendar: g("calendar").value,
    leap: g("leap") ? g("leap").checked : false,
    y: Number(g("y").value), m: Number(g("m").value), d: Number(g("d").value),
    time: g("time").value,
    timeUnknown: g("timeUnknown").checked,
    region: g("region").value,
    yajasi: g("yajasi") ? g("yajasi").checked : false,
  };
}

function validatePerson(v, who) {
  if (!v.name) return `${who}의 이름을 넣어 주세요.`;
  if (!v.gender) return `${who}의 성별을 골라 주세요.`;
  if (!v.timeUnknown && !/^\d{2}:\d{2}$/.test(v.time)) return `${who}의 태어난 시각을 넣거나 '모름'에 표시해 주세요.`;
  if (v.calendar === "lunar" && v.y > 2050) return `${who}는 음력은 2050년까지만 넣을 수 있습니다.`;
  return null;
}

function toChartInput(v) {
  const [hh, mm] = v.timeUnknown ? [12, 0] : v.time.split(":").map(Number);
  return { name: v.name, gender: v.gender, calendar: v.calendar, leap: v.leap, y: v.y, m: v.m, d: v.d,
    hour: hh, minute: mm, timeUnknown: v.timeUnknown, region: v.region, yajasi: v.yajasi };
}

function pdfName(chartA, chartB) {
  const clean = (s) => String(s || "궁합").replace(/[\\/:*?"<>|]/g, "");
  return `궁합풀이_${clean(chartA.input.name)}_${clean(chartB.input.name)}.pdf`;
}

function showResult(chartA, chartB) {
  const html = renderCompatReport(chartA.input.name, chartA, chartB.input.name, chartB);
  app.innerHTML = `${html}<p class="hint no-print" style="margin-top:16px"><a href="#" id="again">← 다시 입력하기</a></p>`;
  document.getElementById("again").addEventListener("click", (e) => { e.preventDefault(); renderForm(); window.scrollTo(0, 0); });
  app.querySelector('[data-act="print"]')?.addEventListener("click", () => window.print());
  bindPdfButton(app, pdfName(chartA, chartB));
  window.scrollTo(0, 0);
}

function onSubmit(e) {
  e.preventDefault();
  const el = e.target.elements;
  const va = readPerson(el, "a"), vb = readPerson(el, "b");
  const msg = validatePerson(va, "사람 1") || validatePerson(vb, "사람 2");
  if (msg) { renderForm(msg); return; }
  last = { a: va, b: vb };
  try {
    const chartA = C.buildChart(toChartInput(va));
    const chartB = C.buildChart(toChartInput(vb));
    showResult(chartA, chartB);
  } catch (err) {
    renderForm(`계산 중 문제가 생겼습니다: ${err.message || err}`);
  }
}

renderForm();
