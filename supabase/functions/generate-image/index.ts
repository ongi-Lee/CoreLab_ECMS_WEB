// Supabase Edge Function: generate-image
// Deno + TypeScript 환경에서 실행됩니다.
// 완성된 영어 프롬프트를 받아
// Google Imagen 3 API로 동화 화풍의 이미지를 생성합니다.

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
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "prompt가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Supabase Secrets에서 이미지 생성 전용 API 키를 안전하게 가져옵니다
    const geminiApiKey = Deno.env.get("GEMINI_IMAGE_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "서버에 GEMINI_IMAGE_API_KEY가 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 동화 화풍 + 안전 키워드를 백엔드에서 추가
    // (프론트엔드에서 전송되는 프롬프트에 항상 이 내용이 붙습니다)
    const safeStoryPrompt = [
      prompt,
      "children's storybook illustration style,",
      "soft watercolor and pastel color palette,",
      "cute and friendly character design,",
      "warm gentle lighting, whimsical fairytale atmosphere,",
      "safe for children, no violence, no adult content,",
      "high quality digital illustration",
    ].join(" ");

    // Gemini 3.1 flash lite image 모델 호출 (API 키는 Supabase Secret에 안전하게 보관)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: safeStoryPrompt }] }],
          generationConfig: {
            responseMimeType: "image/png",
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: "16:9"
            }
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API 오류: ${errText}`);
    }

    const geminiData = await geminiRes.json();
    // Expected blob format from Gemini response
    const generatedImage = (geminiData.candidates?.[0]?.content?.parts?.[0]?.blob) || {};

    if (!generatedImage.content) {
      throw new Error("이미지 데이터가 반환되지 않았습니다. 프롬프트를 확인해주세요.");
    }

    return new Response(
      JSON.stringify({
        imageBytes: generatedImage.content,
        mimeType:   generatedImage.mimeType || "image/png",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("generate-image error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "알 수 없는 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
