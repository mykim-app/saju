import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import * as C from "./saju-core.js";
import { bindPdfButton } from "./pdf.js";
import { renderReading, handDiagramSection } from "./sonkeum-report.js";

const app = document.getElementById("app");
const configured = !SUPABASE_URL.includes("여기에") && !SUPABASE_ANON_KEY.includes("여기에");
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const FUNC_URL = configured ? `${SUPABASE_URL}/functions/v1/sonkeum-read` : null;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let last = null; // 마지막 입력값(다시 입력할 때 채워 둠)
let photos = { dominant: null, other: null }; // 화면에 보여 줄 미리보기 + 보낼 데이터

async function loadCount() {
  const el = document.getElementById("count");
  if (!el) return;
  if (!sb) { el.textContent = "-"; return; }
  const { data, error } = await sb.rpc("sonkeum_today_count");
  el.textContent = error ? "-" : Number(data).toLocaleString("ko-KR");
}

// 어떤 이미지 파일이든 최대 1024px, JPEG로 줄여서 data URL로 돌려준다.
// (AI에게 보내는 크기를 줄이고, 형식도 우리 쪽 함수가 받는 jpeg/png/webp 중 하나로 맞춘다)
function resizeImage(file, maxDim = 1024, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("이미지 파일만 올릴 수 있습니다.")); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; } else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("사진을 읽지 못했습니다. 다른 사진으로 시도해 주세요."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function photoField(key, label, required) {
  const has = photos[key];
  return `
  <div class="field">
    <label class="label" for="ph_${key}">${label}${required ? "" : " (선택)"}</label>
    <input class="input" type="file" accept="image/*" id="ph_${key}" data-photo="${key}">
    <div class="photo-preview" id="prev_${key}" ${has ? "" : "hidden"}><img alt="미리보기" src="${has || ""}"><button type="button" class="btn-ghost" data-clear="${key}">지우기</button></div>
  </div>`;
}

function renderForm(msg) {
  const v = last || { name: "", handedness: "right", birth: "" };
  app.innerHTML = `
  <form class="entry" id="f" novalidate>
    <div class="field">
      <label class="label" for="name">이름</label>
      <input class="input" id="name" name="pname" maxlength="20" autocomplete="name" value="${esc(v.name)}" required>
    </div>

    <fieldset class="field" style="border:0;padding:0;margin:0">
      <legend class="label">어느 손을 주로 쓰나요?</legend>
      <div class="seg">
        <label><input type="radio" name="handedness" value="right" ${v.handedness === "right" ? "checked" : ""}><span>오른손잡이</span></label>
        <label><input type="radio" name="handedness" value="left" ${v.handedness === "left" ? "checked" : ""}><span>왼손잡이</span></label>
      </div>
      <p class="help">주로 쓰는 손은 지금까지 살아오며 다듬어진 모습을, 반대쪽 손은 타고난 기질을 더 많이 보여 준다고 봅니다.</p>
    </fieldset>

    ${photoField("dominant", "주로 쓰는 손바닥 사진", true)}
    ${photoField("other", "반대쪽 손바닥 사진 — 넣으면 두 손을 견주어 더 자세히 봐드려요", false)}
    <p class="hint" style="margin-top:-8px">손바닥이 잘 펴진 채로, 밝은 곳에서 정면으로 찍은 사진일수록 잘 보입니다. 사진은 풀이에만 쓰고 저장하지 않습니다.</p>

    <div class="field">
      <label class="label" for="birth">태어난 날 (선택)</label>
      <input class="input" type="date" id="birth" value="${esc(v.birth)}">
      <p class="help">넣으면 이 사람의 사주와 통하는 점이 있는지도 짧게 함께 봐드립니다. 양력 기준이고, 시각·태어난 곳은 묻지 않아 간단히만 참고합니다.</p>
    </div>

    <div id="msg">${msg ? `<div class="err">${esc(msg)}</div>` : ""}</div>
    <button class="btn" type="submit">손금 보기</button>
  </form>`;

  for (const key of ["dominant", "other"]) {
    const input = document.getElementById(`ph_${key}`);
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      const box = document.getElementById(`prev_${key}`);
      try {
        const dataUrl = await resizeImage(file);
        photos[key] = dataUrl;
        box.querySelector("img").src = dataUrl;
        box.hidden = false;
      } catch (err) {
        document.getElementById("msg").innerHTML = `<div class="err">${esc(err.message)}</div>`;
        input.value = "";
      }
    });
  }
  app.querySelectorAll("[data-clear]").forEach((b) => b.addEventListener("click", () => {
    const key = b.dataset.clear;
    photos[key] = null;
    document.getElementById(`ph_${key}`).value = "";
    document.getElementById(`prev_${key}`).hidden = true;
  }));

  document.getElementById("f").addEventListener("submit", onSubmit);
}

// 생년월일만으로 간단히 참고할 사주 한 줄(시각·태어난 곳은 몰라 대략만 본다)
function quickSajuNote(dateStr) {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const chart = C.buildChart({ name: "", gender: "M", calendar: "solar", leap: false, y, m, d, hour: 12, minute: 0, timeUnknown: true, region: "seoul", yajasi: false });
    const ys = C.yongsin(chart);
    const dm = C.STEMS[chart.dm] + C.ELEMENTS[C.STEM_EL[chart.dm]];
    return `일간은 ${dm}이고, 도움이 되는 기운(용신)은 ${C.ELEMENTS[ys.useEl]}, 조심할 기운은 ${C.ELEMENTS[ys.avoidEl]}입니다(시각을 몰라 대략만 봤습니다)`;
  } catch {
    return null;
  }
}

async function onSubmit(e) {
  e.preventDefault();
  const el = e.target.elements;
  const name = el.pname.value.trim();
  const handedness = el.handedness.value;
  const birth = document.getElementById("birth").value;
  if (!name) { renderForm("이름을 넣어 주세요."); return; }
  if (!photos.dominant) { renderForm("주로 쓰는 손바닥 사진을 올려 주세요."); return; }
  if (!FUNC_URL) { renderForm("손금 풀이 기능이 아직 설정되지 않았습니다. 관리자에게 알려 주세요."); return; }

  last = { name, handedness, birth };
  const sajuNote = birth ? quickSajuNote(birth) : null;
  showLoading();
  try {
    const res = await fetch(FUNC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ name, handedness, sajuNote, dominantImage: photos.dominant, otherImage: photos.other }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.text) { renderForm(data.error || "손금을 읽는 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요."); return; }
    const handCount = photos.other ? 2 : 1;
    showResult(name, handedness, data.text);
    save(name, handedness, handCount, birth, sajuNote, data.text);
  } catch (err) {
    renderForm("손금 풀이 서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.");
  }
}

function showLoading() {
  app.innerHTML = `<div class="loading-box"><p>손금을 보고 있습니다…</p><p class="hint">사진을 보고 풀이를 쓰는 중이라 10~20초 정도 걸릴 수 있습니다.</p></div>`;
  window.scrollTo(0, 0);
}

// AI가 "## 제목" 형식으로 준 글을 화면 구성에 맞춰 절로 나눈다. AI가 만든 글이라
// 있는 그대로 믿지 않고 반드시 이스케이프부터 한 뒤에 굵게(**) 표시만 옮긴다.
// (렌더 함수 자체는 sonkeum-report.js에 있음 — admin.js도 같은 함수를 쓴다)

function showResult(name, handedness, text) {
  const html = `<article class="report" data-pdf-root>
    <header class="rhead" data-pdf-block><h1>${esc(name)}님의 손금풀이</h1></header>
    ${handDiagramSection(handedness)}
    ${renderReading(text)}
    <section class="rsec outro" data-pdf-block>
      <p>손금은 재미로 보는 참고 자료입니다. 같은 손이라도 보는 사람과 유파에 따라 풀이가 다를 수 있고, 사진의 각도·조명에 따라서도 결과가 달라질 수 있습니다. 건강·중요한 결정의 근거로 쓰지 마세요.</p>
      <div class="actions no-print">
        <button class="btn" type="button" data-act="pdf">PDF로 저장</button>
        <button class="btn-ghost" type="button" data-act="print">인쇄</button>
      </div>
      <p class="hint no-print" data-pdf-hint>PDF 파일이 바로 내려받아집니다.</p>
      <p class="hint no-print" data-pdf-webview-warn hidden>지금 보고 계신 앱 안 화면에서는 파일 저장이 막힐 때가 있습니다. 오른쪽 위 메뉴(⋮ 또는 …)에서 <b>'다른 브라우저로 열기'</b>를 고른 뒤 다시 눌러 보세요.</p>
      <a class="btn no-print" data-act="pdf-fallback" hidden download style="text-decoration:none">PDF 파일 눌러서 저장</a>
    </section>
  </article>
  <p class="hint no-print" style="margin-top:16px"><a href="#" id="again">← 다시 보기</a></p>
  <div id="save-msg" class="no-print" style="margin-top:12px"></div>`;
  app.innerHTML = html;
  photos = { dominant: null, other: null };
  document.getElementById("again").addEventListener("click", (e) => { e.preventDefault(); renderForm(); window.scrollTo(0, 0); });
  app.querySelector('[data-act="print"]')?.addEventListener("click", () => window.print());
  bindPdfButton(app, `손금풀이_${String(name).replace(/[\\/:*?"<>|]/g, "")}.pdf`);
  window.scrollTo(0, 0);
}

async function save(name, handedness, handCount, birth, sajuNote, text) {
  if (!sb) return;
  const row = { name, handedness, hand_count: handCount, birth_date: birth || null, saju_note: sajuNote, reading_text: text };
  const { error } = await sb.from("sonkeum_results").insert(row);
  const box = document.getElementById("save-msg");
  if (error && box) box.innerHTML = `<div class="err">손금 기록을 저장하지 못했습니다. 관리자에게 알려 주세요. <span class="hint">${esc(error.message)}</span></div>`;
  loadCount();
}

renderForm();
loadCount();
