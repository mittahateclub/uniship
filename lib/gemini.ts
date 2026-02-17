import { GoogleGenerativeAI } from "@google/generative-ai";

// Access the key from the environment variable
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing from .env.local");
}

export const genAI = new GoogleGenerativeAI(apiKey);

export const getGeminiModel = () => {
  // Using 1.5 Flash for faster, cost-effective test generation
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
};