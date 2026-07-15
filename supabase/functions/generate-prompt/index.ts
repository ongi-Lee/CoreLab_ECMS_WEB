// Supabase Edge Function: generate-prompt
// Deno + TypeScript 환경에서 실행됩니다.
// 학생이 선택한 주인공/배경/행동을 받아
// Gemini 텍스트 API로 안전하고 동화적인 프롬프트를 자동 생성합니다.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // OPTIONS preflight 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { character, background, action } = await req.json();

    if (!character || !background || !action) {
      return new Response(
        JSON.stringify({ error: "character, background, action이 모두 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Supabase Secrets에서 API 키를 안전하게 가져옵니다
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "서버에 GEMINI_API_KEY가 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gemini에게 프롬프트 생성을 요청하는 시스템 메시지
    const systemInstruction = `
당신은 초등학교 미술 선생님입니다.
아이들을 위한 동화책 그림 생성 AI 프롬프트 전문가입니다.

규칙:
1. 절대로 폭력적, 선정적, 무서운 내용을 포함하지 마세요.
2. 항상 밝고, 귀엽고, 따뜻한 동화책 분위기여야 합니다.
3. 응답은 반드시 아래 JSON 형식으로만 답하세요.

{
  "koreanPrompt": "학생이 읽을 한국어 문장 (1~2줄, 동화책 나레이션 스타일)",
  "englishPrompt": "Imagen AI 이미지 생성용 영어 프롬프트 (50~80 단어, 동화책 일러스트 스타일 키워드 포함)"
}
`;

    const userMessage = `주인공: ${character}, 배경: ${background}, 행동: ${action}`;

    // Gemini 2.0 Flash 텍스트 API 호출
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0.9,
            responseMimeType: "application/json",
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_LOW_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_LOW_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" },
          ],
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API 오류: ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("Gemini API에서 프롬프트를 생성하지 못했습니다.");
    }

    // JSON 파싱
    const parsed = JSON.parse(rawText);

    return new Response(
      JSON.stringify({
        koreanPrompt:  parsed.koreanPrompt,
        englishPrompt: parsed.englishPrompt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("generate-prompt error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "알 수 없는 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
