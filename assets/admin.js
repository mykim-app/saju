import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, OTP_LENGTH, OTP_WINDOW_SECONDS, IDLE_MINUTES, PER_PAGE } from "./config.js";
import * as C from "./saju-core.js";
import { renderReport } from "./saju-report.js";
import { bindPdfButton } from "./pdf.js";

const app = document.getElementById("app");
const configured = !SUPABASE_URL.includes("여기에") && !SUPABASE_ANON_KEY.includes("여기에");
// 로그인 상태를 브라우저에 남기지 않는다: 새로고침하거나 창을 닫으면 다시 인증해야 한다.
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
}) : null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const REGION_NAME = Object.fromEntries(C.REGIONS.map((r) => [r.id, r.name]));

let email = "";
let otpTimer = null;
let idleTimer = null;
let loggedIn = false;
let page = 1;
let query = "";

const stopOtpTimer = () => { if (otpTimer) { clearInterval(otpTimer); otpTimer = null; } };

/* ── 자동 로그아웃 ─────────────────────────────── */
function bumpIdle() {
  if (!loggedIn) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => logout(`${IDLE_MINUTES}분 동안 움직임이 없어 로그아웃했습니다.`), IDLE_MINUTES * 60000);
}
["click", "keydown", "pointermove", "scroll", "touchstart"].forEach((ev) => window.addEventListener(ev, bumpIdle, { passive: true }));

async function logout(msg) {
  loggedIn = false;
  clearTimeout(idleTimer);
  if (sb) await sb.auth.signOut().catch(() => {});
  history.replaceState(null, "", location.pathname);
  renderRequest(msg, false);
}
// 뒤로 가기로 캐시된 화면이 다시 보이지 않도록
window.addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });

/* ── 1단계: 인증번호 요청 ─────────────────────── */
function renderRequest(msg, isError) {
  stopOtpTimer();
  app.innerHTML = `
    <div class="admin-head"><h1>관리자 확인</h1><a href="./">사주풀이로 돌아가기</a></div>
    <p style="margin-top:20px">관리자 주소를 넣으면 메일로 인증번호를 보냅니다. 번호는 발송 후 ${OTP_WINDOW_SECONDS}초 안에 입력해야 합니다.</p>
    ${configured ? "" : `<div class="err">Supabase 접속 정보가 설정되지 않았습니다. <code>assets/config.js</code>를 먼저 채워 주세요.</div>`}
    <form id="req" class="entry" novalidate>
      <div class="field">
        <label class="label" for="email">관리자 주소</label>
        <input class="input" type="email" id="email" autocomplete="username" value="${esc(email)}" required>
      </div>
      ${msg ? `<div class="${isError ? "err" : "ok"}">${esc(msg)}</div>` : ""}
      <button class="btn" type="submit" ${configured ? "" : "disabled"}>인증번호 받기</button>
    </form>`;
  document.getElementById("req").addEventListener("submit", async (e) => {
    e.preventDefault();
    email = document.getElementById("email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { renderRequest("메일 주소 형식을 확인해 주세요.", true); return; }
    const btn = e.target.querySelector("button"); btn.disabled = true; btn.textContent = "보내는 중입니다";
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) { renderRequest(`인증번호를 보내지 못했습니다. 등록된 관리자 주소인지 확인해 주세요. (${error.message})`, true); return; }
    renderVerify();
  });
}

/* ── 2단계: 인증번호 입력 ─────────────────────── */
function renderVerify(msg) {
  stopOtpTimer();
  let left = OTP_WINDOW_SECONDS;
  app.innerHTML = `
    <div class="admin-head"><h1>인증번호 입력</h1></div>
    <p style="margin-top:20px">${esc(email)} 주소로 보낸 ${OTP_LENGTH}자리 숫자를 입력하세요.</p>
    <form id="ver" class="entry" novalidate>
      <div class="field">
        <label class="label" for="code">인증번호 <span class="hint" id="left">${left}초 남음</span></label>
        <input class="input otp" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="${OTP_LENGTH}" required>
      </div>
      ${msg ? `<div class="err">${esc(msg)}</div>` : ""}
      <button class="btn" type="submit">확인</button>
      <button class="btn-ghost" type="button" id="back">주소 다시 넣기</button>
    </form>`;
  const code = document.getElementById("code");
  code.focus();
  code.addEventListener("input", () => { code.value = code.value.replace(/\D/g, "").slice(0, OTP_LENGTH); });
  otpTimer = setInterval(() => {
    left--;
    const el = document.getElementById("left");
    if (el) el.textContent = `${Math.max(left, 0)}초 남음`;
    if (left <= 0) renderRequest("입력 시간이 지났습니다. 인증번호를 다시 받아 주세요.", true);
  }, 1000);
  document.getElementById("back").addEventListener("click", () => renderRequest());
  document.getElementById("ver").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (code.value.length !== OTP_LENGTH) { code.focus(); return; }
    stopOtpTimer();
    const { error } = await sb.auth.verifyOtp({ email, token: code.value, type: "email" });
    if (error) { renderVerify(`인증번호가 맞지 않거나 시간이 지났습니다. (${error.message})`); return; }
    const { data: ok, error: e2 } = await sb.rpc("is_admin");
    if (e2 || ok !== true) { await sb.auth.signOut(); renderRequest("관리자로 등록된 주소가 아닙니다.", true); return; }
    loggedIn = true;
    bumpIdle();
    history.replaceState(null, "", location.pathname);
    page = 1; query = "";
    renderList();
  });
}

/* ── 기록 목록 ───────────────────────────────── */
async function renderList(msg) {
  if (!loggedIn) return renderRequest();
  app.innerHTML = `<div class="admin-head"><h1>사주 기록</h1><div class="row" style="flex:0 0 auto"><a class="btn-ghost" href="./" style="text-decoration:none">사주풀이</a><button class="btn-ghost" id="out">로그아웃</button></div></div><p>불러오는 중입니다.</p>`;
  document.getElementById("out").addEventListener("click", () => logout("로그아웃했습니다."));

  const from = (page - 1) * PER_PAGE;
  let q = sb.from("saju_results").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + PER_PAGE - 1);
  if (query) q = q.ilike("name", `%${query.replace(/[%_]/g, "")}%`);
  const [{ data: rows, count, error }, { data: today }] = await Promise.all([q, sb.rpc("saju_today_count")]);
  if (!loggedIn) return;
  if (error) {
    app.querySelector("p").outerHTML = `<div class="err">기록을 불러오지 못했습니다. ${esc(error.message)}</div>`;
    return;
  }
  const pages = Math.max(1, Math.ceil((count || 0) / PER_PAGE));
  const fmt = (t) => new Date(t).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const cards = rows.map((r) => `
    <li class="card">
      <button class="open" data-id="${r.id}" type="button">
        <span class="nm">${esc(r.name)}</span>
        <span class="pz">${esc(String(r.pillars || "").replace("--", "(시 모름)"))}</span>
        <span class="meta">${r.calendar === "lunar" ? `음력${r.is_leap ? "(윤)" : ""}` : "양력"} ${esc(r.birth_date)} ${r.birth_time ? esc(r.birth_time) : "시각 모름"} · ${r.gender === "M" ? "남" : "여"}</span>
        <span class="meta">${esc(REGION_NAME[r.region] || r.region)} · 등록 ${fmt(r.created_at)}</span>
      </button>
      <button class="btn-ghost btn-danger del" data-del="${r.id}" data-name="${esc(r.name)}" type="button">지우기</button>
    </li>`).join("");

  app.innerHTML = `
    <div class="admin-head"><h1>사주 기록</h1><div class="row" style="flex:0 0 auto"><a class="btn-ghost" href="./" style="text-decoration:none">사주풀이</a><button class="btn-ghost" id="out">로그아웃</button></div></div>
    <dl class="stats"><div><dt>오늘</dt><dd>${today ?? "-"}명</dd></div><div><dt>${query ? "찾은 기록" : "전체"}</dt><dd>${count ?? 0}건</dd></div></dl>
    <form id="sf" class="row" style="margin-bottom:8px">
      <input class="input" id="sq" placeholder="이름으로 찾기" value="${esc(query)}" aria-label="이름으로 찾기">
      <button class="btn-ghost" style="flex:0 0 auto" type="submit">찾기</button>
      ${query ? '<button class="btn-ghost" style="flex:0 0 auto" type="button" id="clr">전체 보기</button>' : ""}
    </form>
    ${msg ? `<div class="ok">${esc(msg)}</div>` : ""}
    ${rows.length ? `<ul class="cards">${cards}</ul>` : `<p style="margin:24px 0">${query ? "이름이 맞는 기록이 없습니다. 다른 이름으로 찾아보세요." : "아직 등록된 기록이 없습니다."}</p>`}
    <div class="pager">
      <button class="btn-ghost" id="prev" ${page <= 1 ? "disabled" : ""}>이전</button>
      <span>${page} / ${pages}</span>
      <button class="btn-ghost" id="next" ${page >= pages ? "disabled" : ""}>다음</button>
    </div>`;

  document.getElementById("out").addEventListener("click", () => logout("로그아웃했습니다."));
  document.getElementById("sf").addEventListener("submit", (e) => { e.preventDefault(); query = document.getElementById("sq").value.trim(); page = 1; renderList(); });
  document.getElementById("clr")?.addEventListener("click", () => { query = ""; page = 1; renderList(); });
  document.getElementById("prev").addEventListener("click", () => { page--; renderList(); });
  document.getElementById("next").addEventListener("click", () => { page++; renderList(); });
  app.querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () => openRecord(rows.find((r) => r.id === b.dataset.id))));
  app.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm(`${b.dataset.name}님의 기록을 지웁니다. 되돌릴 수 없습니다.`)) return;
    const { error: de } = await sb.from("saju_results").delete().eq("id", b.dataset.del);
    if (de) { alert(`지우지 못했습니다. ${de.message}`); return; }
    if (rows.length === 1 && page > 1) page--;
    renderList("기록을 지웠습니다.");
  }));
}

/* ── 기록 한 건 풀이 보기 ─────────────────────── */
function openRecord(r) {
  if (!r) return;
  const [y, m, d] = r.birth_date.split("-").map(Number);
  const [hh, mm] = r.birth_time ? r.birth_time.split(":").map(Number) : [12, 0];
  let html;
  try {
    const chart = C.buildChart({ name: r.name, hanja: r.hanja_name || "", gender: r.gender, calendar: r.calendar, leap: r.is_leap, y, m, d,
      hour: hh, minute: mm, timeUnknown: !r.birth_time, region: r.region, yajasi: r.yajasi });
    html = renderReport(chart, { hidePrint: false });
  } catch (err) {
    html = `<div class="err">풀이를 다시 만들지 못했습니다. ${esc(err.message)}</div>`;
  }
  app.innerHTML = `
    <div class="admin-head no-print"><h1>기록 보기</h1><button class="btn-ghost" id="back">목록으로</button></div>
    ${html}`;
  window.scrollTo({ top: 0 });
  document.getElementById("back").addEventListener("click", () => renderList());
  app.querySelector('[data-act="print"]')?.addEventListener("click", () => window.print());
  bindPdfButton(app, `사주풀이_${(r.name || "기록").replace(/[\\/:*?"<>|]/g, "")}_${r.birth_date.replaceAll("-", "")}.pdf`);
}

renderRequest();
