// app/(protected)/user/resume/actions.ts
'use server';

import { getGroqChatCompletion } from '@/lib/groq';

export async function generateTailoredResume(
  profileData: any, 
  companyName: string, 
  jobDescription: string
) {
  const prompt = `
    You are an expert ATS-friendly resume writer. Your task is to tailor the provided user profile data for a specific job application.
    
    Target Company: ${companyName}
    Job Description: ${jobDescription}
    
    User's Raw Profile Data:
    ${JSON.stringify(profileData, null, 2)}
    
    Instructions:
    1. Analyze the job description and extract key skills and requirements.
    2. Rewrite the user's experience, projects, and skills to highlight overlaps with the job description.
    3. Keep the tone professional, impactful, and concise.
    4. Format the output strictly as a JSON object matching the following structure exactly (use strings for all fields, utilizing bullet points like '-' or bullet characters where appropriate for readability):
    
    {
      "fullName": "Extracted or inferred name",
      "phone": "Extracted phone or leave blank",
      "github": "Extracted github url",
      "linkedin": "Extracted linkedin url",
      "education": "Tailored education details",
      "experience": "Tailored work experience focusing on relevant achievements",
      "skills": "Comma separated list of tailored skills relevant to the job",
      "projects": "Tailored project descriptions highlighting relevant tech/outcomes"
    }
  `;

  try {
    const response = await getGroqChatCompletion(prompt);
    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("Error generating resume with Groq:", error);
    throw new Error("Failed to generate resume.");
  }
}