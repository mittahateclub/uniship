'use server';

import { groq } from '@/lib/groq';

const SYSTEM_PROMPT = `You are a Test Generation AI. Generate a complete test paper with exactly three sections. Output ONLY valid JSON.

SECTION 1: Aptitude Questions
- Topics: percentages, profit and loss, time and work, speed and distance, number series, ratios, averages, basic logical reasoning, data interpretation.
- Questions should start easy and gradually increase in difficulty.

SECTION 2: Coding MCQs
- Topics: Python/Java/C++ output prediction, data structures, time complexity, algorithms, OOP concepts, basic programming logic.
- Each question has exactly 4 options (A, B, C, D).

SECTION 3: Live Coding Questions
- Full coding problems with test cases.
- Each must include problem statement, input/output format, sample cases, hidden cases, and a correct reference solution.
- Start from easy and increase difficulty.
- Hidden test cases MUST be different from sample test cases.
- The reference solution must pass ALL hidden test cases.

Return JSON in this EXACT structure:
{
  "sections": [
    {
      "type": "aptitude",
      "title": "Section 1: Aptitude",
      "questions": [
        {
          "questionText": "Full question text",
          "correctAnswer": "The correct answer (e.g. '25%' or '42' or 'Option B')",
          "explanation": "Brief explanation of the solution"
        }
      ]
    },
    {
      "type": "mcq",
      "title": "Section 2: Coding MCQs",
      "questions": [
        {
          "questionText": "What is the output of the following code?\\ndef f(x):\\n    return x * 2\\nprint(f(3))",
          "options": ["A. 3", "B. 6", "C. 9", "D. Error"],
          "correctAnswer": "B",
          "explanation": "f(3) returns 3*2 = 6"
        }
      ]
    },
    {
      "type": "coding",
      "title": "Section 3: Live Coding",
      "questions": [
        {
          "title": "Problem Name",
          "questionDescription": "Full problem statement in HTML. Use <p>, <code>, <strong> tags.",
          "difficulty": "Easy",
          "functionName": "camelCaseName",
          "constraints": ["1 <= n <= 10^5"],
          "inputFormat": "Description of input format",
          "outputFormat": "Description of output format",
          "sampleTestCases": [
            { "input": "5\\n1 2 3 4 5", "output": "15", "explanation": "Sum of all elements" }
          ],
          "hiddenTestCases": [
            { "input": "3\\n10 20 30", "output": "60" }
          ],
          "referenceSolution": "import sys\\ndata = sys.stdin.read().split()\\nn = int(data[0])\\narr = list(map(int, data[1:n+1]))\\nprint(sum(arr))",
          "starterCode": {
            "Python3": "class Solution:\\n    def solve(self):\\n        pass",
            "JavaScript": "var solve = function() {\\n    \\n};",
            "Java": "class Solution {\\n    public void solve() {\\n        \\n    }\\n}",
            "C++": "class Solution {\\npublic:\\n    void solve() {\\n        \\n    }\\n};"
          }
        }
      ]
    }
  ]
}

CRITICAL RULES:
- Output ONLY valid JSON. No markdown, no explanations outside JSON.
- Hidden test cases must be different from sample test cases and should cover edge cases.
- Reference solutions must be complete, self-contained Python 3 scripts using sys.stdin.read().
- All code in questionText should use \\n for newlines (escaped).
- Ensure correctAnswer for MCQs is just the letter (A, B, C, or D).
- Questions should progress from easy to hard within each section.`;

export interface GeneratedTest {
  sections: Array<{
    type: 'aptitude' | 'mcq' | 'coding';
    title: string;
    questions: Array<Record<string, unknown>>;
  }>;
}

export async function generateTest(
  topic: string,
  aptitudeCount: number,
  mcqCount: number,
  codingCount: number,
): Promise<{ success: true; data: GeneratedTest } | { success: false; error: string }> {
  try {
    const userPrompt = `Generate a test paper on the topic: "${topic}"

Number of questions per section:
- Section 1 (Aptitude): ${aptitudeCount} questions
- Section 2 (Coding MCQs): ${mcqCount} questions  
- Section 3 (Live Coding): ${codingCount} questions

Generate all questions now. Follow the JSON structure exactly.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content || '{}';
    const parsed = JSON.parse(content) as GeneratedTest;

    if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length !== 3) {
      return { success: false, error: 'AI returned invalid structure — expected 3 sections.' };
    }

    return { success: true, data: parsed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error generating test';
    return { success: false, error: message };
  }
}
