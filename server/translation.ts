import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface TranslationResult {
  detectedLanguage: string;
  translations: Record<string, string>;
  confidence: number;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese (Simplified)",
  ar: "Arabic",
  hi: "Hindi",
  tr: "Turkish",
  nl: "Dutch",
  pl: "Polish",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  fi: "Finnish",
  th: "Thai",
  vi: "Vietnamese",
  id: "Indonesian",
  ms: "Malay",
  tl: "Filipino",
  uk: "Ukrainian",
  cs: "Czech",
  ro: "Romanian",
  hu: "Hungarian",
  el: "Greek",
  he: "Hebrew",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  ur: "Urdu",
  fa: "Persian",
  sw: "Swahili",
};

export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code;
}

export function getSupportedLanguages(): { code: string; name: string }[] {
  return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({ code, name }));
}

export async function translateMessage(
  text: string,
  targetLanguages: string[]
): Promise<TranslationResult> {
  if (targetLanguages.length === 0) {
    return { detectedLanguage: "en", translations: {}, confidence: 1.0 };
  }

  const languageList = targetLanguages
    .map((code) => `"${code}" (${getLanguageName(code)})`)
    .join(", ");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: `You are a translation engine. Detect the source language and translate the given text into the requested target languages. Respond ONLY with valid JSON in this exact format:
{"detectedLanguage":"<iso-code>","translations":{"<lang-code>":"<translated text>"},"confidence":<0.0-1.0>}
Do not add any explanation. Keep the translation natural and context-aware.`,
        },
        {
          role: "user",
          content: `Translate the following text into these languages: ${languageList}\n\nText: "${text}"`,
        },
      ],
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON in response");
    }

    const result = JSON.parse(jsonMatch[0]) as TranslationResult;
    return {
      detectedLanguage: result.detectedLanguage || "en",
      translations: result.translations || {},
      confidence: result.confidence || 0.8,
    };
  } catch (error) {
    console.error("Translation error:", error);
    const fallback: Record<string, string> = {};
    for (const lang of targetLanguages) {
      fallback[lang] = text;
    }
    return { detectedLanguage: "unknown", translations: fallback, confidence: 0 };
  }
}

export async function detectLanguage(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: "Detect the language of the given text. Respond with only the ISO 639-1 language code (e.g., en, es, fr). Nothing else.",
        },
        { role: "user", content: text },
      ],
      max_completion_tokens: 10,
    });

    const code = response.choices[0]?.message?.content?.trim().toLowerCase() || "en";
    return code.length === 2 ? code : "en";
  } catch {
    return "en";
  }
}
