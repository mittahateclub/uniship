'use server';

import { groq } from '@/lib/groq';
import { wrapCode, extractFunctionName, extractPythonParamCount } from '@/lib/code-wrapper';
import { runCode } from '@/lib/judge0';

interface GeneratedCase {
  input: string;
  output: string;
}

// Token-based normalization: strips brackets/commas, splits on whitespace, joins as flat tokens
function normalizeTokens(value: string): string {
  return (value || '')
    .replace(/[\[\],]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
    .join(' ');
}

const REF_SOLUTION_PROMPT = (count: number) => `You generate test data for coding problems by providing a correct Python reference solution and test inputs.

CRITICAL RULES:
1. Output valid JSON ONLY. No markdown.
2. Return: {"referenceSolution": "def func_name(...):\\n    ...", "testInputs": ["input1", "input2", ...]}
3. "referenceSolution" must be a complete, correct Python function (or set of helper functions + main function).
   - ONLY function definitions. NO if __name__ block, NO input() calls, NO imports (standard lib is pre-imported).
   - The LAST public function is the one that will be called.
   - The function name and signature MUST EXACTLY match what the question specifies.
   - If the question says to print output, use print(). If it says to return, use return.
   - The solution MUST be correct — it will be executed to compute expected outputs.
   - VERIFY your solution against the sample test cases provided in the question. If the question shows Input: [1,2,3,4,5] / [[0,2],[1,3],[2,4]] and Output: [6,9,12], your solution must produce exactly those values.
   - IMPORTANT: Use the SIMPLEST correct approach. Prefer brute-force or straightforward iteration.
     Do NOT use algorithms that reorder queries or input (like MO's Algorithm, segment trees with lazy propagation, etc.)
     unless the brute force approach would be incorrect. For range sum queries, use simple iteration or prefix sums.
   - The function MUST return results in the ORIGINAL input order, not sorted or reordered.
4. Generate exactly ${count} diverse test inputs in "testInputs".
5. INPUT FORMAT — STRICT RULES:
   - Each element in "testInputs" is a COMPLETE stdin string for ONE test run.
   - If the function has N parameters, each testInput string must have EXACTLY N lines separated by \\n.
   - Each line must be a valid Python literal (parseable by ast.literal_eval).
   - Examples:
     * f(n): "5"
     * f(arr): "[1, 4, 3, 2, 6, 5]"
     * f(arr, target): "[2, 7, 11, 15]\\n9"  (two lines: arr on line 1, target on line 2)
     * f(arr, queries): "[1, 2, 3, 4, 5]\\n[[0, 2], [1, 3], [2, 4]]"  (two lines: arr on line 1, queries on line 2)
     * f(matrix): "[[1, 2, 3], [4, 5, 6], [7, 8, 9]]"
     * f(n, edges): "5\\n[[0, 1], [1, 2], [2, 3]]"  (two lines)
   - NEVER put each argument as a separate testInput entry. Each testInput = complete stdin for one call.
   - NEVER include variable names, size prefixes, or extra lines.
6. DATA STRUCTURE CONVENTIONS — functions must use these representations:
   - Linked List: use a Python list (e.g., [1, 2, 3, 4, 5]). Function takes/returns a list.
   - Binary Tree: level-order list with None for missing nodes (e.g., [1, 2, 3, None, 4, None, 5]).
   - Graph: take number of nodes and edge list. E.g., def f(n, edges) where edges = [[0,1], [1,2]].
     For weighted graphs: edges = [[0, 1, 5], [1, 2, 3]].
   - Matrix/Grid: list of lists. E.g., [[1, 0, 1], [0, 1, 0]].
   - Stack/Queue problems: represent as a list of operations or just a list.
   - Intervals: list of [start, end] pairs. E.g., [[1, 3], [2, 6], [8, 10]].
   - Strings: just a string literal. E.g., "abcba".
7. Include edge cases (empty inputs, single element, large inputs, boundary values) and normal cases.`;

export async function generateHiddenTestCases(
  questionText: string,
  count: number = 3,
  sampleTestCases?: Array<{ input: string; output: string }>,
) {
  try {
    const trimmed = (questionText || '').trim();
    if (!trimmed) {
      return { success: false as const, error: 'Question text is required.' };
    }

    const requestedCount = Math.min(Math.max(count, 2), 6);

    // Include sample test cases in the prompt so the AI can verify its solution
    let userContent = `Question:\n${trimmed}`;
    if (sampleTestCases && sampleTestCases.length > 0) {
      const samplesStr = sampleTestCases
        .map((tc, i) => `Sample ${i + 1}:\n  Input:\n${tc.input.split('\n').map(l => '    ' + l).join('\n')}\n  Expected Output: ${tc.output}`)
        .join('\n');
      userContent += `\n\nKnown sample test cases (your reference solution MUST produce these exact outputs for these inputs):\n${samplesStr}`;
    }

    // Try up to 3 times with increasing temperature to get a correct ref solution
    const temperatures = [0.2, 0.4, 0.7];
    for (let attempt = 0; attempt < temperatures.length; attempt++) {
      const result = await tryGenerateWithRefSolution(
        userContent, requestedCount, trimmed,
        sampleTestCases, temperatures[attempt],
      );
      if (!result) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      // Cross-validate: generate a SECOND ref solution and verify outputs agree
      const crossResult = await crossValidate(
        trimmed, sampleTestCases, result,
      );
      if (crossResult) return { success: true as const, cases: crossResult };

      // Cross-validation failed — the outputs may be wrong, try again
      await new Promise((r) => setTimeout(r, 500));
    }

    // All attempts failed — fall back to Groq-only generation (with validation)
    return await fallbackGenerate(trimmed, requestedCount, sampleTestCases);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate hidden test cases.';
    return { success: false as const, error: message };
  }
}

async function tryGenerateWithRefSolution(
  userContent: string,
  requestedCount: number,
  questionText: string,
  sampleTestCases: Array<{ input: string; output: string }> | undefined,
  temperature: number,
): Promise<GeneratedCase[] | null> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: REF_SOLUTION_PROMPT(requestedCount) },
        { role: 'user', content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw) as {
      referenceSolution?: string;
      testInputs?: string[];
    };

    const refSolution = (parsed.referenceSolution || '').trim();
    let testInputs = (parsed.testInputs || [])
      .map((s) => (s || '').trim())
      .filter((s) => s.length > 0);

    if (!refSolution || testInputs.length === 0) return null;

    // Detect if Groq split function arguments into separate testInput entries
    const funcName = extractFunctionName(refSolution, 71);
    const paramCount = funcName ? extractPythonParamCount(refSolution, funcName) : 0;
    if (paramCount > 1) {
      const allSingleLine = testInputs.every(
        (inp) => inp.split('\n').filter((l) => l.trim()).length === 1
      );
      if (allSingleLine && testInputs.length >= paramCount) {
        const merged: string[] = [];
        for (let i = 0; i + paramCount - 1 < testInputs.length; i += paramCount) {
          merged.push(testInputs.slice(i, i + paramCount).join('\n'));
        }
        testInputs = merged;
      }
    }
    // Repair: ensure each input has exactly paramCount lines
    if (paramCount > 0) {
      testInputs = testInputs.map((inp) => {
        const lines = inp.split('\n').filter((l) => l.trim());
        if (lines.length > paramCount) {
          // Too many lines — combine extra into last param as nested list
          const firstLines = lines.slice(0, paramCount - 1);
          const restLines = lines.slice(paramCount - 1);
          const allBracketed = restLines.every((l) => l.trim().startsWith('['));
          if (allBracketed) {
            const combined = '[' + restLines.map((l) => l.trim()).join(', ') + ']';
            return [...firstLines, combined].join('\n');
          }
        }
        return inp;
      });
    }
    testInputs = testInputs.slice(0, requestedCount);

    const wrappedCode = wrapCode(refSolution, 71);

    // Validate: run ref solution against ALL sample test cases
    if (sampleTestCases && sampleTestCases.length > 0) {
      for (const sample of sampleTestCases) {
        try {
          const sampleResult = await runCode(wrappedCode, 71, sample.input);
          if (!sampleResult.ok) return null; // runtime error → reject
          const actualTokens = normalizeTokens(sampleResult.stdout);
          const expectedTokens = normalizeTokens(sample.output);
          if (actualTokens !== expectedTokens) return null; // wrong answer → reject
        } catch {
          return null;
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    // Ref solution passed ALL samples — now generate hidden case outputs
    const cases: GeneratedCase[] = [];

    for (const input of testInputs) {
      try {
        const result = await runCode(wrappedCode, 71, input);
        if (result.ok && result.stdout.length > 0) {
          // Normalize output to space-separated tokens (consistent format)
          const normalized = normalizeTokens(result.stdout);
          cases.push({ input, output: normalized });
        }
      } catch {
        // Skip failed executions
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    if (cases.length === 0) return null;

    return cases;
  } catch {
    return null;
  }
}

/**
 * Cross-validate hidden test case outputs by generating a SECOND independent
 * reference solution and verifying both solutions agree on all outputs.
 * Returns the validated cases if they agree, or null if they disagree.
 */
async function crossValidate(
  questionText: string,
  sampleTestCases: Array<{ input: string; output: string }> | undefined,
  primaryCases: GeneratedCase[],
): Promise<GeneratedCase[] | null> {
  try {
    const crossPrompt = `You are a coding expert. Write a CORRECT Python function that solves this problem.

RULES:
1. Output valid JSON ONLY. No markdown.
2. Return: {"referenceSolution": "def func_name(...):\\n    ..."}
3. The function MUST be correct. Double-check edge cases.
4. ONLY function definitions. NO if __name__ block, NO input() calls.
5. The function name and parameter names MUST exactly match the question.
6. Use the SIMPLEST correct approach (brute force is fine for validation).
7. If the problem asks for range sum queries, use prefix sums or simple iteration — do NOT implement MO's Algorithm or any sorting-based approach that reorders queries.`;

    let userContent = `Question:\n${questionText}`;
    if (sampleTestCases && sampleTestCases.length > 0) {
      const samplesStr = sampleTestCases
        .map((tc, i) => `Sample ${i + 1}: Input: ${tc.input} → Output: ${tc.output}`)
        .join('\n');
      userContent += `\n\nSample test cases (your solution MUST produce these):\n${samplesStr}`;
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: crossPrompt },
        { role: 'user', content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw) as { referenceSolution?: string };
    const crossSolution = (parsed.referenceSolution || '').trim();
    if (!crossSolution) return null;

    const wrappedCross = wrapCode(crossSolution, 71);

    // First validate cross-solution against sample test cases
    if (sampleTestCases && sampleTestCases.length > 0) {
      for (const sample of sampleTestCases) {
        try {
          const sr = await runCode(wrappedCross, 71, sample.input);
          if (!sr.ok) return null;
          if (normalizeTokens(sr.stdout) !== normalizeTokens(sample.output)) return null;
        } catch {
          return null;
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    // Cross-solution passes samples — now verify it agrees on all hidden inputs
    const validatedCases: GeneratedCase[] = [];
    for (const tc of primaryCases) {
      try {
        const cr = await runCode(wrappedCross, 71, tc.input);
        if (!cr.ok) continue;
        const crossTokens = normalizeTokens(cr.stdout);
        const primaryTokens = normalizeTokens(tc.output);
        if (crossTokens === primaryTokens) {
          validatedCases.push(tc);
        }
        // If they disagree, skip this test case (output is unreliable)
      } catch {
        continue;
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    // Need at least half the cases to agree
    if (validatedCases.length < Math.ceil(primaryCases.length / 2)) return null;

    return validatedCases;
  } catch {
    // Cross-validation failed — return null to try again
    return null;
  }
}

async function fallbackGenerate(
  questionText: string,
  count: number,
  sampleTestCases?: Array<{ input: string; output: string }>,
) {
  const systemPrompt = `You generate hidden coding test cases with expected outputs.

CRITICAL RULES:
1. Output valid JSON ONLY. No markdown.
2. Return: {"hiddenTestCases": [{"input": "...", "output": "..."}], "referenceSolution": "def func_name(...):\\n    ..."}
3. Generate exactly ${count} diverse test cases with edge cases.
4. Also provide a correct Python reference solution to validate the outputs.
5. INPUT FORMAT: Each "input" string is a COMPLETE stdin for one test run.
   - If the function has N parameters, the input string must have EXACTLY N lines separated by \\n.
   - Each line is one function argument as a valid Python literal (parseable by ast.literal_eval).
   - Examples for f(arr, queries): "[1, 2, 3]\\n[[0, 1], [1, 2]]" (two lines: arr then queries).
   - Examples for f(arr, target): "[2, 7, 11]\\n9" (two lines).
   - NEVER include variable names like "arr = ". Just raw values.
6. OUTPUT FORMAT: exactly what a correct program would print to stdout.
   - Lists/arrays: space-separated on one line (e.g. "5 4 3 2 1"), NOT Python list syntax.
   - Single value: just the value.
   - Multiple output lines: separate with newlines.
7. Use the SIMPLEST correct approach (brute force / direct computation). Do NOT use algorithms that reorder input (like MO's algorithm) — use straightforward iteration or prefix sums.`;

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
  const parsed = JSON.parse(raw) as {
    hiddenTestCases?: Array<{ input: string; output: string }>;
    referenceSolution?: string;
  };

  let cases = (parsed.hiddenTestCases || [])
    .map((c) => ({ input: (c?.input || '').trim(), output: (c?.output || '').trim() }))
    .filter((c) => c.input.length > 0 && c.output.length > 0)
    .slice(0, count);

  if (cases.length === 0) {
    return { success: false as const, error: 'Could not generate usable test cases.' };
  }

  // Validate fallback outputs using ref solution if provided
  const fallbackRef = (parsed.referenceSolution || '').trim();
  if (fallbackRef) {
    const wrappedRef = wrapCode(fallbackRef, 71);

    // Validate ref against samples first
    let refValid = true;
    if (sampleTestCases && sampleTestCases.length > 0) {
      for (const sample of sampleTestCases) {
        try {
          const sr = await runCode(wrappedRef, 71, sample.input);
          if (!sr.ok || normalizeTokens(sr.stdout) !== normalizeTokens(sample.output)) {
            refValid = false;
            break;
          }
        } catch {
          refValid = false;
          break;
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    // If ref is valid, re-compute outputs via execution instead of trusting AI
    if (refValid) {
      const validated: GeneratedCase[] = [];
      for (const tc of cases) {
        try {
          const result = await runCode(wrappedRef, 71, tc.input);
          if (result.ok && result.stdout.length > 0) {
            validated.push({ input: tc.input, output: normalizeTokens(result.stdout) });
          }
        } catch {
          // skip
        }
        await new Promise((r) => setTimeout(r, 600));
      }
      if (validated.length > 0) cases = validated;
    }
  }

  return { success: true as const, cases };
}
