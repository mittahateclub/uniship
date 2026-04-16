// app/(protected)/user/resume/actions.ts
'use server';

import { getGroqChatCompletion } from '@/lib/groq';

// SECURITY: Input size limits to prevent abuse
const MAX_PROFILE_SIZE = 50_000;   // 50 KB JSON stringified
const MAX_COMPANY_NAME = 200;
const MAX_JOB_DESC = 10_000;

/**
 * Sanitize string input — strip control characters, trim, truncate.
 */
function sanitize(input: string, maxLength: number): string {
  return (input || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars (keep \n, \r, \t)
    .trim()
    .slice(0, maxLength);
}

export async function generateTailoredResume(
  profileData: Record<string, unknown>,
  companyName: string,
  jobDescription: string
) {
  // SECURITY: Validate inputs
  if (!profileData || typeof profileData !== 'object' || Array.isArray(profileData)) {
    throw new Error('Invalid profile data.');
  }
  const profileStr = JSON.stringify(profileData);
  if (profileStr.length > MAX_PROFILE_SIZE) {
    throw new Error('Profile data too large.');
  }
  const cleanCompany = sanitize(companyName, MAX_COMPANY_NAME);
  const cleanJobDesc = sanitize(jobDescription, MAX_JOB_DESC);
  if (!cleanCompany) throw new Error('Company name is required.');
  if (!cleanJobDesc) throw new Error('Job description is required.');
  const prompt = `
You are an expert ATS-friendly resume writer. Your task is to tailor the provided user profile data for a specific job application.

Target Company: ${cleanCompany}
Job Description: ${cleanJobDesc}

User's Raw Profile Data (all fields stored in their profile):
${profileStr}

Instructions:
1. Analyze the job description and extract key skills, tools, and requirements.
2. Use ALL available fields from the profile data — name, phone, email, linkedinUrl, githubUrl, education, experience, technicalSkills, projects, achievements, positions, relevantCoursework, extracurriculars — to build the resume.
3. Rewrite experience, projects, and skills to highlight the most relevant overlaps with the job description. Use impactful, concise bullet points.
4. For Education: format as "Institution | Location | Date\\nDegree/Description" with bullet points for notable info, blank lines between entries.
5. For Experience: format as "Role — Title | Date\\nOrg | Location\\n- bullet\\n- bullet" with blank lines between entries.
6. For Projects: format as "Project Name | Tech Stack | Date\\n- bullet\\n- bullet" with blank lines between entries.
7. For Extracurriculars: format as "Title | Organization | Date" one per line.
8. For Achievements: format as "Award Name – Description | Date" one per line. Include positions of responsibility here too.
9. Use **double asterisks** around important words/phrases for bold emphasis in bullets.
10. Keep tone professional and impactful.
11. IMPORTANT: "Technical Skills" and "Relevant Coursework" are SEPARATE sections. Do NOT repeat coursework items in skills or vice versa. Skills = programming languages, frameworks, tools, technologies. Coursework = academic courses/subjects taken.
12. Output the "coursework" field as a simple comma-separated list of course names. Do NOT duplicate any coursework content in the "skills" field.
13. Extract a "keywords" array: list the top 10–20 important keywords, skills, tools, and phrases from the job description that appear (or were woven into) the resume. These will be highlighted in the preview so the student can see which JD terms their resume covers.

Format the output STRICTLY as a JSON object with NO markdown fences, NO extra text — just raw JSON:

{
  "fullName": "Full name from profile",
  "phone": "Phone number",
  "email": "Email address",
  "website": "Personal website if available, else empty string",
  "github": "GitHub URL from githubUrl field",
  "linkedin": "LinkedIn URL from linkedinUrl field",
  "education": "Formatted education block",
  "experience": "Formatted experience block tailored to the job",
  "skills": "Formatted technical skills — Languages: ...\\nFrameworks: ...\\nTools: ...",
  "projects": "Formatted projects block tailored to the job",
  "coursework": "Relevant coursework as comma-separated list",
  "extracurriculars": "Formatted extracurriculars block",
  "achievements": "Formatted achievements block",
  "keywords": ["keyword1", "keyword2", "..."]
}
`;

  try {
    const response = await getGroqChatCompletion(prompt);
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Strip markdown code fences if the model wraps the JSON
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Error generating resume with Groq:', error);
    throw new Error('Failed to generate resume.');
  }
}