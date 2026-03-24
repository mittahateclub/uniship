'use server';

import { groq } from '@/lib/groq';
import { wrapCode } from '@/lib/code-wrapper';
import { runCode } from '@/lib/judge0';

interface ParsedQuestion {
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  sampleTestCases: Array<{ input: string; output: string; explanation?: string }>;
  hints: string[];
}

export async function parsePracticeQuestion(rawText: string) {
  try {
    const trimmed = (rawText || '').trim();
    if (!trimmed) {
      return { success: false as const, error: 'Question text is required.' };
    }

    const systemPrompt = `You are a coding question parser. Given raw text (possibly messy, from an image OCR, spreadsheet paste, or typed text), extract and structure it into a clean coding question.

Rules:
1. Output valid JSON only.
2. Return: {"title":"...","description":"...","inputFormat":"...","outputFormat":"...","constraints":["..."],"sampleTestCases":[{"input":"...","output":"...","explanation":"..."}],"hints":["..."]}
3. If the text is incomplete, infer reasonable defaults.
4. Clean up any OCR artifacts, fix typos, and format properly.
5. If no test cases are found in the text, generate 1-2 reasonable sample test cases.
6. If no constraints are mentioned, leave constraints as empty array.
7. The description should be clear, well-formatted, and include the problem statement.
8. Title should be concise (3-8 words).
9. No markdown, no explanation outside JSON.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Parse this into a structured coding question:\n\n${trimmed}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw) as ParsedQuestion;

    if (!parsed.title || !parsed.description) {
      return { success: false as const, error: 'AI could not extract a valid question from the provided text.' };
    }

    return { success: true as const, question: parsed };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to parse question.';
    return { success: false as const, error: message };
  }
}

export async function generateTestCasesForQuestion(questionText: string, count: number = 4) {
  try {
    const trimmed = (questionText || '').trim();
    if (!trimmed) {
      return { success: false as const, error: 'Question text is required.' };
    }

    const requestedCount = Math.min(Math.max(count, 2), 8);

    // Ask Groq for a reference solution + test inputs, then run the solution to get outputs
    const systemPrompt = `You generate test data for coding problems by providing a correct Python reference solution and test inputs.

Rules:
1. Output valid JSON only.
2. Return: {"referenceSolution": "def func_name(...):\\n    ...", "testInputs": ["input1", "input2", ...]}
3. "referenceSolution" must be a complete, correct Python function definition(s).
   - Just the function definition(s), NO if __name__ block, NO input() calls.
   - The function name and parameters MUST match what the question describes.
   - If the question says to print output, the function should use print(). If it says to return, it should return.
   - The solution MUST be correct — it will be executed to compute expected outputs.
4. Generate exactly ${requestedCount} diverse test inputs in "testInputs".
5. Each test input must contain one function argument per line, using Python literal syntax:
   - For f(arr, queries): line 1 = [1, 2, 3]\\nline 2 = [[0, 2], [1, 4]]
   - For f(arr): single line = [1, 4, 3, 2, 6, 5]
   - For f(n): single line = 5
   - NEVER include variable names like "arr = ". Just raw values, one per line.
6. Include basic cases, edge cases (single element, small inputs), and normal cases.
7. No markdown, no explanation.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate test data for this coding question:\n\n${trimmed}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw) as {
      referenceSolution?: string;
      testInputs?: string[];
    };

    const refSolution = (parsed.referenceSolution || '').trim();
    const testInputs = (parsed.testInputs || [])
      .map((s) => (s || '').trim())
      .filter((s) => s.length > 0)
      .slice(0, requestedCount);

    if (!refSolution || testInputs.length === 0) {
      return await fallbackGenerateTestCases(trimmed, requestedCount);
    }

    const wrappedCode = wrapCode(refSolution, 71);

    const cases: Array<{ input: string; output: string }> = [];
    for (const input of testInputs) {
      try {
        const result = await runCode(wrappedCode, 71, input);
        if (result.ok && result.stdout.length > 0) {
          cases.push({ input, output: result.stdout });
        }
      } catch {
        // Skip failed executions
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    if (cases.length === 0) {
      return await fallbackGenerateTestCases(trimmed, requestedCount);
    }

    return { success: true as const, cases };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate test cases.';
    return { success: false as const, error: message };
  }
}

async function fallbackGenerateTestCases(questionText: string, count: number) {
  const systemPrompt = `You generate test cases for coding problems.

Rules:
1. Output valid JSON only.
2. Return: {"testCases": [{"input": "...", "output": "..."}]}
3. Generate exactly ${count} diverse test cases.
4. Include edge cases and normal cases.
5. The "input" field must contain one function argument per line, using Python literal syntax.
   - NEVER include variable names like "arr = ". Just raw values, one per line.
6. The "output" must exactly match what a correct program would print to stdout.
   - For lists/arrays: space-separated values on one line (e.g. "5 4 3 2 1"), NOT Python list syntax.
   - For a single value: just the value.
   - For multiple lines of output: separate with newlines.
7. No markdown, no explanation.`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate test cases for this coding question:\n\n${questionText}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw) as { testCases?: Array<{ input: string; output: string }> };

  const cases = (parsed.testCases || [])
    .map((c) => ({ input: (c?.input || '').trim(), output: (c?.output || '').trim() }))
    .filter((c) => c.output.length > 0)
    .slice(0, count);

  if (cases.length === 0) {
    return { success: false as const, error: 'AI could not generate usable test cases.' };
  }

  return { success: true as const, cases };
}
