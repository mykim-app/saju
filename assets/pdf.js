/* ── PDF 저장 ──────────────────────────────────────────────
   MBTI 사이트와 같은 방식: 화면을 직접 그림으로 떠서 A4 PDF 파일로 만든다.
   인쇄 창을 거치지 않으므로 휴대폰·카카오톡 안 화면에서도 바로 내려받아진다.

   - 폭을 760px로 고정해 떠서, 휴대폰으로 받아도 PC와 같은 모양이 된다.
   - 풀이를 덩어리(머리말, 각 절)별로 따로 뜬다. 한 번에 뜨면 휴대폰에서
     그림 크기 한도를 넘어 실패하기 때문이다.
   - 덩어리 안에서도 문단·표의 줄·카드 단위로만 쪽을 나눈다.
     그래서 글줄이나 표 한 줄이 쪽 경계에서 반으로 잘리지 않는다.
   - 제목만 쪽 끝에 홀로 남지 않도록, 제목 바로 다음 줄에서는 나누지 않는다. */

const LIBS = [
  ["html2canvas", "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"],
  ["jspdf", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"],
];
/* 카카오톡·인스타그램 등 앱 안 브라우저(웹뷰)는 자동 다운로드를 막는 경우가 있다.
   이런 곳에서는 (1) 미리 안내를 보여 주고 (2) 자동 저장 시도와 별개로,
   사람이 직접 누르는 실제 링크를 남겨 둔다. 스크립트가 대신 눌러 주는 동작은
   막혀도, 사람이 직접 누르는 링크는 되는 경우가 많기 때문이다. */
export function isAppWebview() {
  const ua = navigator.userAgent || "";
  return /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|MicroMessenger|BAND\/|; ?wv\)/i.test(ua);
}
const WIDTH = 760;          // 뜨는 폭(px)
const MARGIN = 12;          // 쪽 여백(mm)
const FOOT = 6;             // 쪽 번호 자리(mm)
const SCALE = 2;            // 선명도

// 쪽을 나눠도 되는 자리(이 요소들의 윗선)
const BREAK_SEL = [
  ".rsec > *", ".rhead > *", "dl > div", "ul > li", "ol > li",
  "tbody > tr", ".wonguk-wrap", ".now-box > *", ".today-box > *", ".tglegend",
].join(",");

function loadScript(src) {
  return new Promise((ok, no) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = ok;
    el.onerror = () => no(new Error("PDF 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요."));
    document.head.appendChild(el);
  });
}

async function ensureLibs() {
  for (const [name, src] of LIBS) if (!window[name]) await loadScript(src);
}

// 쪽을 나눌 기준 요소: 제목 바로 다음이면 제목 위에서, 표 첫 줄이면 표 위에서 나눈다.
function anchorOf(el) {
  let n = el;
  if (n.tagName === "TR" && !n.previousElementSibling) n = n.closest(".tscroll") || n.closest("table") || n;
  const prev = n.previousElementSibling;
  if (prev && /^H[1-3]$/.test(prev.tagName)) n = prev;
  return n;
}

// 덩어리 하나를 떠서 그림과 나눌 자리를 돌려준다.
async function capture(block, index) {
  let breaks = [], bw = WIDTH;
  const canvas = await window.html2canvas(block, {
    scale: SCALE,
    backgroundColor: "#ffffff",
    useCORS: true,
    scrollX: 0,
    scrollY: 0,
    windowWidth: 1000,
    onclone: (doc) => {
      doc.documentElement.classList.add("pdf-mode");
      const root = doc.querySelector("[data-pdf-root]");
      if (root) root.style.width = `${WIDTH}px`;
      const el = doc.querySelector(`[data-pdf-block="${index}"]`);
      if (!el) return;
      const r0 = el.getBoundingClientRect();
      const top = r0.top;
      bw = r0.width;
      const seen = new Set();
      el.querySelectorAll(BREAK_SEL).forEach((n) => {
        const a = anchorOf(n);
        const y = Math.round(a.getBoundingClientRect().top - top);
        if (y > 0 && !seen.has(y)) { seen.add(y); breaks.push(y); }
      });
      breaks.sort((x, y) => x - y);
    },
  });
  const k = canvas.width / bw;   // CSS 1px이 그림 몇 px인지
  return { canvas, breaks: breaks.map((b) => b * k) };
}

function slice(canvas, fromPx, toPx) {
  const c = document.createElement("canvas");
  c.width = canvas.width;
  c.height = Math.max(1, toPx - fromPx);
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(canvas, 0, fromPx, canvas.width, c.height, 0, 0, canvas.width, c.height);
  return c;
}

export async function saveReportPdf(root, filename, onProgress = () => {}) {
  await ensureLibs();
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  // 사진(예: 손금 참고 그림) 같은 <img>가 아직 안 불러와진 채로 캡처되면 빈 칸으로
  // 찍히므로, 다 불러오거나 실패할 때까지 잠깐 기다린다.
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((res) => {
    img.addEventListener("load", res, { once: true });
    img.addEventListener("error", res, { once: true });
  })));
  const prevScroll = window.scrollY;
  window.scrollTo(0, 0);

  const blocks = Array.from(root.querySelectorAll("[data-pdf-block]")).filter((el) => el.offsetHeight > 0);
  blocks.forEach((el, i) => { el.dataset.pdfBlock = String(i); });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const bottom = pageH - MARGIN - FOOT;
  let y = MARGIN;
  let pageHasContent = false;

  try {
    for (let i = 0; i < blocks.length; i++) {
      onProgress(i + 1, blocks.length);
      const { canvas, breaks: bPx } = await capture(blocks[i], i);
      const mmPerPx = contentW / canvas.width;          // 그림 1px이 몇 mm인지
      const H = canvas.height;
      let pos = 0;
      while (pos < H - 1) {
        const availPx = (bottom - y) / mmPerPx;
        if (H - pos <= availPx) {
          const part = slice(canvas, pos, H);
          pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, y, contentW, (H - pos) * mmPerPx);
          y += (H - pos) * mmPerPx + 2;
          pageHasContent = true;
          break;
        }
        // 남은 자리 안에서 가장 아래쪽의 나눌 자리를 찾는다
        const cands = bPx.filter((b) => b > pos + 8 && b <= pos + availPx);
        const cut = cands.length ? cands[cands.length - 1] : null;
        if (cut !== null && (cut - pos) * mmPerPx > 12) {
          const part = slice(canvas, pos, cut);
          pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, y, contentW, (cut - pos) * mmPerPx);
          pdf.addPage(); y = MARGIN; pageHasContent = false;
          pos = cut;
        } else if (pageHasContent) {
          pdf.addPage(); y = MARGIN; pageHasContent = false;   // 새 쪽에서 다시 시도
        } else {
          // 한 쪽보다 큰 한 덩어리(드문 경우): 쪽 높이만큼 잘라 담는다
          const end = pos + availPx;
          const part = slice(canvas, pos, end);
          pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, y, contentW, availPx * mmPerPx);
          pdf.addPage(); y = MARGIN; pageHasContent = false;
          pos = end;
        }
      }
    }
    // 빈 마지막 쪽 지우기
    if (!pageHasContent && pdf.getNumberOfPages() > 1) pdf.deletePage(pdf.getNumberOfPages());
    const n = pdf.getNumberOfPages();
    pdf.setFontSize(9);
    pdf.setTextColor(140);
    for (let p = 1; p <= n; p++) {
      pdf.setPage(p);
      pdf.text(`${p} / ${n}`, pageW / 2, pageH - MARGIN + 2, { align: "center" });
    }
    return pdf;
  } finally {
    window.scrollTo(0, prevScroll);
  }
}

// pdf.save(filename)는 내부에서 숨은 링크를 스크립트로 대신 눌러 준다. 보통 브라우저에서는
// 이것으로 충분하지만, 일부 앱 안 브라우저는 스크립트가 누르는 동작을 막아 조용히 실패한다.
// 그래서 같은 파일로 실제 눈에 보이는 링크도 함께 준비해, 자동 저장이 안 됐을 때 사람이
// 직접 눌러 저장할 수 있게 한다.
function saveWithFallback(pdf, filename, fallbackLink) {
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  if (fallbackLink) {
    fallbackLink.href = url;
    fallbackLink.download = filename;
    fallbackLink.hidden = false;
  }
  try {
    pdf.save(filename);
  } catch {
    // 자동 저장이 막혀도 위에서 준비한 링크로 이어진다.
  }
}

// 결과 화면의 [PDF로 저장] 단추를 연결한다.
export function bindPdfButton(scope, filename) {
  const btn = scope.querySelector('[data-act="pdf"]');
  const hint = scope.querySelector("[data-pdf-hint]");
  const root = scope.querySelector("[data-pdf-root]");
  const warn = scope.querySelector("[data-pdf-webview-warn]");
  const fallback = scope.querySelector('[data-act="pdf-fallback"]');
  if (!btn || !root) return;
  if (warn && isAppWebview()) warn.hidden = false;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "만드는 중…";
    if (fallback) fallback.hidden = true;
    try {
      const pdf = await saveReportPdf(root, filename, (i, n) => { if (hint) hint.textContent = `PDF를 만드는 중입니다(${i}/${n}). 잠시 기다려 주세요.`; });
      saveWithFallback(pdf, filename, fallback);
      if (hint) hint.textContent = fallback
        ? "PDF를 내려받았습니다. 화면에 아무 변화가 없으면 아래 'PDF 파일 눌러서 저장'을 눌러 주세요."
        : "PDF를 내려받았습니다. 다운로드 폴더나 파일 앱에서 확인하세요.";
    } catch (e) {
      if (hint) hint.textContent = `PDF를 만들지 못했습니다. ${e.message || ""} 카카오톡 같은 앱 안에서 열었다면 오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 고른 뒤 다시 시도해 주세요.`;
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
}
