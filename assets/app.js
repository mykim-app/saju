import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import * as C from "./saju-core.js";
import { renderReport, pillarsText } from "./saju-report.js";
import { bindPdfButton } from "./pdf.js";
import { candidatesFor } from "./naming.js";

const app = document.getElementById("app");
const configured = !SUPABASE_URL.includes("여기에") && !SUPABASE_ANON_KEY.includes("여기에");
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const pad = (n) => String(n).padStart(2, "0");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let last = null; // 마지막 입력값(다시 입력할 때 채워 둠)

/* 오늘의 간지 */
function renderToday() {
  const t = C.todayPillars();
  const box = document.getElementById("today");
  box.innerHTML = [["year", "년"], ["month", "월"], ["day", "일"]].map(([k, lb]) => {
    const g = t[k];
    return `<figure><span class="col"><b class="el-${C.STEM_EL[g.s]}">${C.STEMS_HJ[g.s]}</b><b class="el-${C.BRANCH_EL[g.b]}">${C.BRANCHES_HJ[g.b]}</b></span><figcaption>${C.STEMS[g.s]}${C.BRANCHES[g.b]}${lb}</figcaption></figure>`;
  }).join("");
  document.getElementById("today-cap").textContent = `오늘 ${t.date.y}년 ${t.date.m}월 ${t.date.d}일`;
}

/* 오늘 인원 */
async function loadCount() {
  const el = document.getElementById("count");
  if (!sb) { el.textContent = "-"; return; }
  const { data, error } = await sb.rpc("saju_today_count");
  el.textContent = error ? "-" : Number(data).toLocaleString("ko-KR");
}

/* 처음 화면: 사주풀이·궁합보기 중 고르기 */
function renderModeSelect() {
  app.innerHTML = `
    <div class="modesel">
      <button class="btn" type="button" data-mode="saju">사주풀이 보기</button>
      <button class="btn-ghost" type="button" data-mode="gunghap">궁합 보기</button>
    </div>`;
  app.querySelector('[data-mode="saju"]').addEventListener("click", () => renderForm());
  app.querySelector('[data-mode="gunghap"]').addEventListener("click", () => { location.href = "./gunghap.html"; });
}

/* 입력 화면 */
function yearOptions(sel) {
  const now = C.todayKST().y;
  let h = "";
  for (let y = now; y >= 1900; y--) h += `<option value="${y}" ${y === sel ? "selected" : ""}>${y}년</option>`;
  return h;
}
const numOptions = (from, to, sel, unit) => { let h = ""; for (let i = from; i <= to; i++) h += `<option value="${i}" ${i === sel ? "selected" : ""}>${i}${unit}</option>`; return h; };

function renderForm(msg) {
  const v = last || { name: "", hanja: "", gender: "", calendar: "solar", leap: false, y: 1990, m: 1, d: 1, time: "", timeUnknown: false, region: "seoul", yajasi: false };
  app.innerHTML = `
  <p class="hint" style="margin:-4px 0 16px"><a href="#" id="to-modesel">← 처음으로(사주풀이·궁합 고르기)</a></p>
  <form class="entry" id="f" novalidate>
    <div class="field">
      <label class="label" for="name">이름</label>
      <input class="input" id="name" name="pname" maxlength="20" autocomplete="name" value="${esc(v.name)}" required>
    </div>

    <div class="field">
      <label class="label" for="hanja">한자 이름 <span class="hint">(선택)</span></label>
      <div class="hjinput-row">
        <input class="input" id="hanja" name="hanja" maxlength="20" value="${esc(v.hanja || "")}" placeholder="예: 洪吉童 — 이름과 같은 글자 수로">
        <button class="btn-ghost" type="button" id="hjpick-btn">후보에서 고르기</button>
      </div>
      <p class="help">한자를 넣으면 획수로 이름의 오행을 뽑아 사주와 함께 풀어 드립니다. 성 1자, 이름 1~2자를 이름과 같은 순서·글자 수로 넣어 주세요. 한자를 몰라 입력이 어려우면 옆의 ‘후보에서 고르기’를 눌러 보세요.</p>
      <div id="hjpicker" class="hjpicker" hidden></div>
    </div>

    <fieldset class="field" style="border:0;padding:0;margin:0">
      <legend class="label">성별</legend>
      <div class="seg">
        <label><input type="radio" name="gender" value="M" ${v.gender === "M" ? "checked" : ""}><span>남성</span></label>
        <label><input type="radio" name="gender" value="F" ${v.gender === "F" ? "checked" : ""}><span>여성</span></label>
      </div>
      <p class="help">대운이 흘러가는 방향을 정할 때 씁니다.</p>
    </fieldset>

    <fieldset class="field" style="border:0;padding:0;margin:0">
      <legend class="label">생년월일</legend>
      <div class="seg" style="margin-bottom:8px">
        <label><input type="radio" name="calendar" value="solar" ${v.calendar === "solar" ? "checked" : ""}><span>양력</span></label>
        <label><input type="radio" name="calendar" value="lunar" ${v.calendar === "lunar" ? "checked" : ""}><span>음력</span></label>
      </div>
      <div class="row">
        <select class="input" name="y" aria-label="태어난 해">${yearOptions(v.y)}</select>
        <select class="input" name="m" aria-label="태어난 달">${numOptions(1, 12, v.m, "월")}</select>
        <select class="input" name="d" aria-label="태어난 날">${numOptions(1, 31, v.d, "일")}</select>
      </div>
      <label class="check" id="leap-wrap" ${v.calendar === "lunar" ? "" : "hidden"}><input type="checkbox" name="leap" ${v.leap ? "checked" : ""}> 윤달</label>
    </fieldset>

    <div class="field">
      <label class="label" for="time">태어난 시각</label>
      <div class="row" style="align-items:center">
        <input class="input" type="time" id="time" name="time" value="${esc(v.time)}" ${v.timeUnknown ? "disabled" : ""}>
        <label class="check" style="flex:0 0 auto"><input type="checkbox" name="timeUnknown" ${v.timeUnknown ? "checked" : ""}> 모름</label>
      </div>
      <p class="help">시계에 적힌 시각 그대로 넣으세요. 서머타임과 지역 차이는 자동으로 맞춥니다.</p>
    </div>

    <div class="field">
      <label class="label" for="region">태어난 곳</label>
      <select class="input" id="region" name="region">
        ${C.REGIONS.map((r) => `<option value="${r.id}" ${r.id === v.region ? "selected" : ""}>${r.name}</option>`).join("")}
      </select>
      <p class="help">해외 출생이면 가장 가까운 곳이나 "보정하지 않음"을 고르세요.</p>
    </div>

    <details class="more">
      <summary>세부 설정</summary>
      <label class="check"><input type="checkbox" name="yajasi" ${v.yajasi ? "checked" : ""}> 밤 11시~자정 출생은 날짜를 넘기지 않음(야자시)</label>
      <p class="help">보통은 밤 11시(자시)부터 다음 날로 봅니다. 야자시를 따르는 풀이와 맞춰 보고 싶을 때만 켜세요.</p>
    </details>

    <div id="msg">${msg ? `<div class="err">${esc(msg)}</div>` : ""}</div>
    <button class="btn" type="submit">사주 보기</button>
  </form>`;

  const f = document.getElementById("f");
  const fe = f.elements;
  document.getElementById("to-modesel").addEventListener("click", (e) => { e.preventDefault(); renderModeSelect(); });
  f.addEventListener("change", (e) => {
    if (e.target.name === "calendar") document.getElementById("leap-wrap").hidden = fe.calendar.value !== "lunar";
    if (e.target.name === "timeUnknown") { fe.time.disabled = e.target.checked; if (e.target.checked) fe.time.value = ""; }
  });
  f.addEventListener("submit", onSubmit);
  bindHanjaPicker();
}

const CAND_STEP = 60; // 후보가 많은 글자는 이만큼씩 나눠 보여 준다

function bindHanjaPicker() {
  const btn = document.getElementById("hjpick-btn");
  const box = document.getElementById("hjpicker");
  btn.addEventListener("click", () => {
    const nm = document.getElementById("name").value.trim();
    box.hidden = false;
    if (!nm) { box.innerHTML = '<p class="hint">먼저 위에서 이름(한글)을 입력해 주세요.</p>'; return; }
    const syls = [...nm];
    const lists = syls.map((s) => candidatesFor(s));
    if (lists.some((l) => l.length === 0)) {
      box.innerHTML = '<p class="hint">이름 가운데 한자로 찾을 수 없는 글자가 있습니다(순 우리말 이름일 수 있어요). 아는 한자가 있으면 위 칸에 직접 넣어 주시고, 모르면 비워 두셔도 사주 풀이에는 지장이 없습니다.</p>';
      return;
    }
    const picks = new Array(syls.length).fill(null);
    const shown = lists.map(() => CAND_STEP);
    const cur = [...document.getElementById("hanja").value];
    if (cur.length === syls.length) cur.forEach((c, i) => { if (lists[i].some((x) => x.char === c)) picks[i] = c; });

    const draw = () => {
      box.innerHTML = `
        <div class="hjpick-rows">${syls.map((s, i) => `
          <div class="hjpick-row">
            <p class="hjpick-label">${i + 1}번째 글자 · <b>${esc(s)}</b> ${picks[i] ? `→ 고름: <b class="pickedch">${picks[i]}</b>` : ""}</p>
            <div class="hjpick-grid">
              ${lists[i].slice(0, shown[i]).map((c) => `<button type="button" class="hjcand ${picks[i] === c.char ? "sel" : ""}" data-i="${i}" data-ch="${esc(c.char)}">${c.char}<small>${c.strokes}획</small></button>`).join("")}
            </div>
            ${lists[i].length > shown[i] ? `<button type="button" class="hjmore" data-more="${i}">후보 더 보기(${lists[i].length - shown[i]}자 더)</button>` : ""}
          </div>`).join("")}
        </div>
        <div class="row" style="margin-top:12px">
          <button type="button" class="btn" id="hjpick-apply" ${picks.some((p) => !p) ? "disabled" : ""}>이 한자로 채우기</button>
          <button type="button" class="btn-ghost" id="hjpick-cancel">닫기</button>
        </div>`;
      box.querySelectorAll(".hjcand").forEach((b) => b.addEventListener("click", () => { picks[Number(b.dataset.i)] = b.dataset.ch; draw(); }));
      box.querySelectorAll(".hjmore").forEach((b) => b.addEventListener("click", () => { shown[Number(b.dataset.more)] += CAND_STEP; draw(); }));
      box.querySelector("#hjpick-apply")?.addEventListener("click", () => {
        document.getElementById("hanja").value = picks.join("");
        box.hidden = true;
      });
      box.querySelector("#hjpick-cancel").addEventListener("click", () => { box.hidden = true; });
    };
    draw();
  });
}

function readForm(f) {
  const el = f.elements;
  return {
    name: el.pname.value.trim(),
    hanja: el.hanja.value.replace(/\s+/g, "").normalize("NFC"), // 호환 한자(인명용 異體字)도 같은 글자로 맞춘다
    gender: el.gender.value,
    calendar: el.calendar.value,
    leap: el.calendar.value === "lunar" && el.leap.checked,
    y: +el.y.value, m: +el.m.value, d: +el.d.value,
    time: el.time.value,
    timeUnknown: el.timeUnknown.checked,
    region: el.region.value,
    yajasi: el.yajasi.checked,
  };
}

function validate(v) {
  if (!v.name) return "이름을 넣어 주세요.";
  if (!v.gender) return "성별을 골라 주세요.";
  if (!v.timeUnknown && !/^\d{2}:\d{2}$/.test(v.time)) return "태어난 시각을 넣거나 '모름'에 표시해 주세요.";
  if (v.calendar === "lunar" && v.y > 2050) return "음력은 2050년까지만 넣을 수 있습니다.";
  if (v.hanja && [...v.hanja].some((c) => !/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(c))) return "한자 이름에는 한자만 넣어 주세요.";
  return null;
}

function toChartInput(v) {
  const [hh, mm] = v.timeUnknown ? [12, 0] : v.time.split(":").map(Number);
  return { name: v.name, hanja: v.hanja, gender: v.gender, calendar: v.calendar, leap: v.leap, y: v.y, m: v.m, d: v.d,
    hour: hh, minute: mm, timeUnknown: v.timeUnknown, region: v.region, yajasi: v.yajasi };
}

async function onSubmit(e) {
  e.preventDefault();
  const v = readForm(e.target);
  last = v;
  const bad = validate(v);
  if (bad) { document.getElementById("msg").innerHTML = `<div class="err">${esc(bad)}</div>`; return; }
  let chart;
  try {
    chart = C.buildChart(toChartInput(v));
    const t = C.todayKST();
    const s = chart.solar;
    if (s.y * 10000 + s.m * 100 + s.d > t.y * 10000 + t.m * 100 + t.d) throw new Error("아직 오지 않은 날짜입니다. 날짜를 확인해 주세요.");
  } catch (err) {
    document.getElementById("msg").innerHTML = `<div class="err">${esc(err.message)}</div>`;
    return;
  }
  showResult(chart);
  save(v, chart);
}

function pdfName(chart) {
  const s = chart.solar;
  const nm = String(chart.input.name || "사주").replace(/[\\/:*?"<>|]/g, "");
  return `사주풀이_${nm}_${s.y}${pad(s.m)}${pad(s.d)}.pdf`;
}

function showResult(chart) {
  app.innerHTML = `${renderReport(chart)}
    <div class="actions no-print"><button class="btn-ghost" type="button" id="again">다른 사람 사주 보기</button><button class="btn-ghost" type="button" id="edit">입력값 고치기</button></div>
    <div id="save-msg" class="no-print" style="margin-top:12px"></div>`;
  window.scrollTo({ top: document.getElementById("app").offsetTop - 12 });
  document.getElementById("again").addEventListener("click", () => { last = null; renderForm(); });
  document.getElementById("edit").addEventListener("click", () => renderForm());
  app.querySelector('[data-act="print"]')?.addEventListener("click", () => window.print());
  bindPdfButton(app, pdfName(chart));
}

async function save(v, chart) {
  if (!sb) return;
  const s = chart.solar;
  const row = {
    name: v.name, hanja_name: v.hanja || null, gender: v.gender, calendar: v.calendar, is_leap: v.leap,
    birth_date: `${v.y}-${pad(v.m)}-${pad(v.d)}`,
    solar_date: `${s.y}-${pad(s.m)}-${pad(s.d)}`,
    birth_time: v.timeUnknown ? null : v.time,
    region: v.region, yajasi: v.yajasi,
    pillars: pillarsText(chart),
    day_master: C.STEMS[chart.dm] + C.ELEMENTS[C.STEM_EL[chart.dm]],
  };
  let { error } = await sb.from("saju_results").insert(row);
  // 데이터베이스에 한자 이름 칸을 아직 만들지 않았으면(schema.sql 재실행 전) 한자 없이 다시 저장한다.
  if (error && /hanja_name/.test(error.message || "")) {
    delete row.hanja_name;
    ({ error } = await sb.from("saju_results").insert(row));
  }
  const box = document.getElementById("save-msg");
  if (error && box) box.innerHTML = `<div class="err">풀이 기록을 저장하지 못했습니다. 관리자에게 알려 주세요. <span class="hint">${esc(error.message)}</span></div>`;
  loadCount();
}

try {
  renderToday();
  renderModeSelect();
} catch (err) {
  app.innerHTML = `<div class="err">화면을 준비하지 못했습니다. ${esc(err.message)}</div>`;
}
loadCount();
