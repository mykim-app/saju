import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import * as C from "./saju-core.js";
import { buildChart } from "./jami-core.js";
import { renderJamiReport } from "./jami-report.js";
import { bindPdfButton } from "./pdf.js";

const app = document.getElementById("app");
const configured = !SUPABASE_URL.includes("여기에") && !SUPABASE_ANON_KEY.includes("여기에");
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let last = null;

async function loadCount() {
  const el = document.getElementById("count");
  if (!el) return;
  if (!sb) { el.textContent = "-"; return; }
  const { data, error } = await sb.rpc("jami_today_count");
  el.textContent = error ? "-" : Number(data).toLocaleString("ko-KR");
}

function yearOptions(sel) {
  const now = C.todayKST().y;
  let h = "";
  for (let y = now; y >= 1900; y--) h += `<option value="${y}" ${y === sel ? "selected" : ""}>${y}년</option>`;
  return h;
}
const numOptions = (from, to, sel, unit) => { let h = ""; for (let i = from; i <= to; i++) h += `<option value="${i}" ${i === sel ? "selected" : ""}>${i}${unit}</option>`; return h; };

function renderForm(msg) {
  const v = last || { name: "", gender: "", calendar: "solar", leap: false, y: 1990, m: 1, d: 1, time: "" };
  app.innerHTML = `
  <form class="entry" id="f" novalidate>
    <div class="field">
      <label class="label" for="name">이름</label>
      <input class="input" id="name" name="pname" maxlength="20" autocomplete="name" value="${esc(v.name)}" required>
    </div>

    <fieldset class="field" style="border:0;padding:0;margin:0">
      <legend class="label">성별</legend>
      <div class="seg">
        <label><input type="radio" name="gender" value="M" ${v.gender === "M" ? "checked" : ""}><span>남성</span></label>
        <label><input type="radio" name="gender" value="F" ${v.gender === "F" ? "checked" : ""}><span>여성</span></label>
      </div>
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
      <input class="input" type="time" id="time" name="time" value="${esc(v.time)}" required>
      <p class="help">자미두수는 태어난 시각에 따라 명궁 자리부터 갈라져서, 시각을 모르면 명반을 만들 수 없습니다. 시계에 적힌 시각 그대로 넣어 주세요.</p>
    </div>

    <div id="msg">${msg ? `<div class="err">${esc(msg)}</div>` : ""}</div>
    <button class="btn" type="submit">명반 보기</button>
  </form>`;

  document.querySelectorAll('input[name="calendar"]').forEach((r) => r.addEventListener("change", () => {
    document.getElementById("leap-wrap").hidden = document.querySelector('input[name="calendar"]:checked').value !== "lunar";
  }));
  document.getElementById("f").addEventListener("submit", onSubmit);
}

function onSubmit(e) {
  e.preventDefault();
  const el = e.target.elements;
  const name = el.pname.value.trim();
  const gender = el.gender.value;
  const calendar = el.calendar.value;
  const leap = el.leap ? el.leap.checked : false;
  const y = Number(el.y.value), m = Number(el.m.value), d = Number(el.d.value);
  const time = document.getElementById("time").value;

  if (!name) { renderForm("이름을 넣어 주세요."); return; }
  if (!gender) { renderForm("성별을 골라 주세요."); return; }
  if (!time) { renderForm("태어난 시각을 넣어 주세요."); return; }
  const [hour, minute] = time.split(":").map(Number);

  last = { name, gender, calendar, leap, y, m, d, time };
  try {
    const astrolabe = buildChart({ gender, calendar, leap, y, m, d, hour });
    showResult(name, astrolabe, { gender, calendar, leap, y, m, d, hour, minute });
  } catch (err) {
    renderForm(err.message || "명반을 만드는 중 문제가 생겼습니다. 입력값을 확인해 주세요.");
  }
}

function showResult(name, astrolabe, input) {
  app.innerHTML = renderJamiReport(name, astrolabe);
  document.getElementById("again")?.remove();
  app.insertAdjacentHTML("afterend", `<p class="hint no-print" style="margin-top:16px"><a href="#" id="again">← 다시 입력하기</a></p><div id="save-msg" class="no-print" style="margin-top:12px"></div>`);
  document.getElementById("again").addEventListener("click", (e) => { e.preventDefault(); renderForm(); window.scrollTo(0, 0); });
  app.querySelector('[data-act="print"]')?.addEventListener("click", () => window.print());
  bindPdfButton(app, `자미두수_${String(name).replace(/[\\/:*?"<>|]/g, "")}.pdf`);
  window.scrollTo(0, 0);
  save(name, astrolabe, input);
}

async function save(name, astrolabe, input) {
  if (!sb) return;
  const row = {
    name, gender: input.gender, calendar: input.calendar, is_leap: !!input.leap,
    birth_date: `${input.y}-${String(input.m).padStart(2, "0")}-${String(input.d).padStart(2, "0")}`,
    birth_time: `${String(input.hour).padStart(2, "0")}:${String(input.minute).padStart(2, "0")}`,
    five_elements_class: astrolabe.fiveElementsClass,
    soul_palace: `${astrolabe.palaces.find((p) => p.name === "명궁").heavenlyStem}${astrolabe.palaces.find((p) => p.name === "명궁").earthlyBranch}`,
  };
  const { error } = await sb.from("jami_results").insert(row);
  const box = document.getElementById("save-msg");
  if (error && box) box.innerHTML = `<div class="err">명반 기록을 저장하지 못했습니다. 관리자에게 알려 주세요. <span class="hint">${esc(error.message)}</span></div>`;
  loadCount();
}

renderForm();
loadCount();
