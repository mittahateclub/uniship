'use server';

import { groq } from '@/lib/groq';
import { wrapCode } from '@/lib/code-wrapper';
import { runCode } from '@/lib/judge0';

interface GeneratedCase {
  input: string;
  output: string;
}

export async function generateHiddenTestCases(questionText: string, count: number = 3) {
  try {
    const trimmed = (questionText || '').trim();
    if (!trimmed) {
      return { success: false, error: 'Question text is required.' };
    }

    const requestedCount = Math.min(Math.max(count, 2), 6);

    // Step 1: Ask Groq for a reference solution + test inputs (NOT outputs)
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
6. Include edge cases (single element, small inputs) and normal cases.
7. No markdown, no explanation.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Question:\n${trimmed}` },
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
      return await fallbackGenerate(trimmed, requestedCount);
    }

    // Step 2: Wrap the reference solution through the same wrapper students use
    const wrappedCode = wrapCode(refSolution, 71);

    // Step 3: Run each input through Judge0 and collect actual outputs
    const cases: GeneratedCase[] = [];
    for (const input of testInputs) {
      try {
        const result = await runCode(wrappedCode, 71, input);
        if (result.ok && result.stdout.length > 0) {
          cases.push({ input, output: result.stdout });
        }
      } catch {
        // Skip if execution fails for this input
      }
      // Small delay to respect Judge0 rate limits
      await new Promise((r) => setTimeout(r, 600));
    }

    if (cases.length === 0) {
      return await fallbackGenerate(trimmed, requestedCount);
    }

    return { success: true, cases };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate hidden test cases.';
    return { success: false, error: message };
  }
}

async function fallbackGenerate(questionText: string, count: number) {
  const systemPrompt = `You generate hidden coding test cases with expected outputs.

Rules:
1. Output valid JSON only.
2. Return: {"hiddenTestCases": [{"input": "...", "output": "..."}]}
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
      { role: 'user', content: `Question:\n${questionText}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw) as { hiddenTestCases?: Array<{ input: string; output: string }> };

  const cases = (parsed.hiddenTestCases || [])
    .map((c) => ({ input: (c?.input || '').trim(), output: (c?.output || '').trim() }))
    .filter((c) => c.input.length > 0 && c.output.length > 0)
    .slice(0, count);

  if (cases.length === 0) {
    return { success: false, error: 'Could not generate usable test cases.' };
  }

  return { success: true, cases };
}
