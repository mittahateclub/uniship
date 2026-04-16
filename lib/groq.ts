import Groq from "groq-sdk";

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing from .env.local");
  }
  return new Groq({ apiKey });
}

// Lazy singleton — only initializes when first accessed, avoids crashing
// pages that don't use Groq
let _groq: Groq | null = null;
export const groq = new Proxy({} as Groq, {
  get(_, prop) {
    if (!_groq) _groq = getClient();
    return (_groq as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * Helper to call Groq with a standard configuration.
 * llama-3.3-70b-versatile is a strong choice for structured data extraction.
 */
export const getGroqChatCompletion = async (content: string) => {
  return groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: content,
      },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.1, // Low temperature for consistent JSON formatting
    response_format: { type: "json_object" },
  });
};