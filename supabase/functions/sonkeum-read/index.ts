// supabase/functions/sonkeum-read/index.ts
//
// 브라우저가 손바닥 사진(과 이름 등 몇 가지 정보)을 보내면, 그 사진을 AI에게 보여 주고
// 손금 풀이 '글'만 받아서 돌려준다. 사진은 이 함수 안에서만 잠깐 쓰이고 어디에도
// 저장하지 않는다(디스크에 쓰지 않고, 데이터베이스에도 넣지 않는다) — 요청 처리가
// 끝나면 메모리에서도 그냥 사라진다.
//
// 두 가지 AI 중 하나를 골라 쓸 수 있다(둘 다 사진을 보고 글을 쓸 수 있는 모델).
//   - Gemini(구글) : 무료 등급이 있다. 개인 카드 등록 없이 바로 키를 받을 수 있다.
//                    다만 무료 등급은 분당·일일 호출 횟수가 정해져 있고, 성능이 낮은
//                    모델일수록 한도가 넉넉하다. 방문자가 많은 사이트라면 금방 한도에
//                    닿을 수 있다.
//   - Anthropic(클로드) : 무료 등급이 없고 쓴 만큼 요금이 나오지만, 첫 결제 전에도
//                    한도 걱정 없이 안정적으로 쓸 수 있다.
// GEMINI_API_KEY와 ANTHROPIC_API_KEY 가운데 설정된 것을 자동으로 쓴다(Gemini 우선).
// 둘 다 설정돼 있으면 AI_PROVIDER=anthropic 시크릿으로 Anthropic을 강제할 수 있다.
//
// 배포:  supabase functions deploy sonkeum-read --no-verify-jwt
// 키 설정(둘 중 하나만 하면 됨):
//   supabase secrets set GEMINI_API_KEY=여기에-키       (무료로 시작하려면 이쪽)
//   supabase secrets set ANTHROPIC_API_KEY=여기에-키
// (SUPABASE_URL, SUPABASE_ANON_KEY는 Supabase가 함수에 자동으로 넣어 준다.)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// data URL(예: "data:image/jpeg;base64,/9j/...")을 미디어 타입과 base64 본문으로 나눈다.
function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || "");
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

function buildPrompt(name: string, handedness: "right" | "left", handCount: number, sajuNote: string | null) {
  const domName = handedness === "right" ? "오른손" : "왼손";
  const otherName = handedness === "right" ? "왼손" : "오른손";
  const lines = [
    `아래 사진은 '${name}'님의 손바닥 사진입니다. ${name}님은 평소 ${domName}을 주로 씁니다.`,
    handCount === 2
      ? `사진이 두 장입니다. 첫 번째는 주로 쓰는 손(${domName}), 두 번째는 반대쪽 손(${otherName})입니다.`
      : `사진은 주로 쓰는 손(${domName}) 한 장뿐입니다.`,
    "당신은 서양 손금(카이로맨시)과 동양 수상학을 함께 아는 손금 풀이 도우미입니다.",
    "사진 속 손금을 보고, 쉬운 한국어로, 아래 형식 그대로 답해 주세요. 한자·전문용어를 쓰면 그 옆에 괄호로 뜻을 풀어 주세요.",
    "",
    "## 한눈에 보기",
    "전체적인 인상과 눈에 띄는 특징을 2~3문장으로.",
    "## 생명선",
    "생명선(엄지 쪽을 감싸듯 내려가는 줄. 체력·건강 성향을 본다고 알려져 있음)의 길이·깊이·굴곡을 보고 설명.",
    "## 두뇌선",
    "두뇌선(손바닥을 가로지르는 줄. 사고방식·집중력을 본다고 알려져 있음)을 보고 설명.",
    "## 감정선",
    "감정선(손가락 쪽 윗부분을 가로지르는 줄. 감정 표현·애정 성향을 본다고 알려져 있음)을 보고 설명.",
    "## 운명선·기타",
    "운명선(손목에서 가운뎃손가락 쪽으로 세로로 올라가는 줄이 있다면. 직업·인생의 방향을 본다고 알려져 있음)이나 그 밖에 눈에 띄는 줄·무늬가 있으면 설명. 뚜렷하지 않으면 '뚜렷한 운명선은 보이지 않습니다'처럼 솔직히 말해 주세요.",
    handCount === 2
      ? "## 두 손을 견주어 보면\n한쪽은 타고난 기질, 다른 한쪽은 살아오며 다듬어진 모습으로 보는 전통적인 방식에 따라, 두 손에서 다르게 보이는 점을 짚어 주세요."
      : "",
    "## 정리",
    "전체를 두세 문장으로 정리. 손금은 재미로 보는 참고 자료일 뿐, 건강·중요한 결정의 근거가 아니라는 점을 마지막에 한 줄 덧붙여 주세요.",
    "",
    "사진에서 선이 잘 안 보이거나 각도·조명 때문에 판단하기 어려운 부분은 추측해서 지어내지 말고 '이 사진에서는 잘 보이지 않습니다'라고 솔직히 말해 주세요.",
    "의학적 진단이나 미래를 단정하는 말은 하지 마세요.",
  ];
  if (sajuNote) {
    lines.push("", `참고로 이 사람의 사주를 간단히 보면 ${sajuNote}. 손금에서 자연스럽게 통하는 부분이 있으면 '정리' 앞에 짧게 한 문단만 덧붙여 주세요. 억지로 끼워 맞추지는 마세요.`);
  }
  return lines.filter(Boolean).join("\n");
}

type Img = { mediaType: string; data: string };

// Gemini(구글)에게 물어본다. 무료 등급이 있는 쪽.
async function callGemini(apiKey: string, model: string, prompt: string, images: Img[]): Promise<{ text?: string; error?: string }> {
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  for (const img of images) parts.push({ inline_data: { mime_type: img.mediaType, data: img.data } });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { maxOutputTokens: 1500 } }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.error("gemini error", res.status, errBody);
    if (res.status === 429) return { error: "지금 무료 이용 한도가 다 찼습니다(구글 쪽 한도). 잠시 뒤 다시 시도해 주세요." };
    return { error: "손금을 읽는 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요." };
  }
  const data = await res.json();
  const cand = data.candidates?.[0];
  if (cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT") {
    return { error: "이 사진은 분석할 수 없습니다. 손바닥이 잘 보이는 다른 사진으로 시도해 주세요." };
  }
  const text = (cand?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("").trim();
  return { text };
}

// Anthropic(클로드)에게 물어본다. 무료 등급은 없지만 한도 걱정이 적은 쪽.
async function callAnthropic(apiKey: string, model: string, prompt: string, images: Img[]): Promise<{ text?: string; error?: string }> {
  const content: Record<string, unknown>[] = [{ type: "text", text: prompt }];
  for (const img of images) content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.error("anthropic error", res.status, errBody);
    return { error: "손금을 읽는 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요." };
  }
  const data = await res.json();
  const text = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n").trim();
  return { text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "허용되지 않은 방식입니다." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "요청 내용을 읽지 못했습니다." }, 400);
  }

  const name = String(body.name || "").slice(0, 20).trim();
  const handedness = body.handedness === "left" ? "left" : "right";
  const sajuNote = body.sajuNote ? String(body.sajuNote).slice(0, 200) : null;
  const dom = parseDataUrl(String(body.dominantImage || ""));
  const other = body.otherImage ? parseDataUrl(String(body.otherImage)) : null;

  if (!name) return json({ error: "이름을 넣어 주세요." }, 400);
  if (!dom) return json({ error: "주로 쓰는 손 사진을 다시 확인해 주세요." }, 400);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const DAILY_CAP = Number(Deno.env.get("SONKEUM_DAILY_CAP") || "30");

  // 어떤 AI를 쓸지: AI_PROVIDER를 정해 뒀으면 그대로, 아니면 설정된 키를 보고 자동으로 고른다(Gemini 우선).
  const provider = (Deno.env.get("AI_PROVIDER") || (GEMINI_API_KEY ? "gemini" : ANTHROPIC_API_KEY ? "anthropic" : ""));

  if (provider === "gemini" && !GEMINI_API_KEY) return json({ error: "손금 풀이 기능이 아직 설정되지 않았습니다(관리자: GEMINI_API_KEY 시크릿을 등록해 주세요)." }, 500);
  if (provider === "anthropic" && !ANTHROPIC_API_KEY) return json({ error: "손금 풀이 기능이 아직 설정되지 않았습니다(관리자: ANTHROPIC_API_KEY 시크릿을 등록해 주세요)." }, 500);
  if (!provider) return json({ error: "손금 풀이 기능이 아직 설정되지 않았습니다(관리자: GEMINI_API_KEY 또는 ANTHROPIC_API_KEY 시크릿을 등록해 주세요)." }, 500);

  // 하루 이용 한도 확인 — AI 호출은 비용·한도가 있기 때문에, 넘으면 호출 전에 멈춘다.
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const cntRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sonkeum_today_count`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const cnt = await cntRes.json();
      if (typeof cnt === "number" && cnt >= DAILY_CAP) {
        return json({ error: "오늘 손금 보기 이용 횟수가 다 찼습니다. 내일 다시 시도해 주세요." }, 429);
      }
    } catch {
      // 한도 확인 자체가 실패해도 손금 풀이는 계속 진행한다(한도 확인은 비용 보호용 부가 기능이라).
    }
  }

  const prompt = buildPrompt(name, handedness, other ? 2 : 1, sajuNote);
  const images: Img[] = [dom, ...(other ? [other] : [])];

  try {
    const result = provider === "gemini"
      ? await callGemini(GEMINI_API_KEY!, Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash", prompt, images)
      : await callAnthropic(ANTHROPIC_API_KEY!, Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5", prompt, images);
    if (result.error || !result.text) return json({ error: result.error || "손금 풀이 결과를 받지 못했습니다. 다시 시도해 주세요." }, 502);
    return json({ text: result.text });
  } catch (e) {
    console.error("sonkeum-read error", e);
    return json({ error: "손금을 읽는 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
});
