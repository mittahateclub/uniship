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
): Promise<{
  success: boolean;
  cases?: GeneratedCase[];
  correctedSamples?: Array<{ input: string; output: string }>;
  error?: string;
}> {
  try {
    const trimmed = (questionText || '').trim();
    if (!trimmed) {
      return { success: false, error: 'Question text is required.' };
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

    // Try up to 3 times with increasing temperature
    const temperatures = [0.2, 0.4, 0.7];
    for (let attempt = 0; attempt < temperatures.length; attempt++) {
      const result = await tryGenerateWithDualValidation(
        userContent, requestedCount, trimmed,
        sampleTestCases, temperatures[attempt],
      );
      if (result) return { success: true, ...result };
      await new Promise((r) => setTimeout(r, 500));
    }

    // All attempts failed — fall back to Groq-only generation
    return await fallbackGenerate(trimmed, requestedCount, sampleTestCases);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate hidden test cases.';
    return { success: false, error: message };
  }
}

/**
 * Generate hidden test cases with dual-solution validation.
 *
 * Strategy:
 * 1. Generate ref solution A → extract inputs → run against sample inputs
 * 2. Generate ref solution B (independent) → run against same sample inputs
 * 3. If A and B AGREE on sample inputs → they're both correct
 *    (even if stored sample outputs are wrong — auto-correct them)
 * 4. Generate hidden outputs using validated ref solution
 * 5. Cross-validate hidden outputs with second solution
 */
async function tryGenerateWithDualValidation(
  userContent: string,
  requestedCount: number,
  questionText: string,
  sampleTestCases: Array<{ input: string; output: string }> | undefined,
  temperature: number,
): Promise<{ cases: GeneratedCase[]; correctedSamples?: Array<{ input: string; output: string }> } | null> {
  try {
    // ── Step 1: Generate primary ref solution + test inputs ──
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

    // Fix test inputs format
    testInputs = repairTestInputs(refSolution, testInputs);
    testInputs = testInputs.slice(0, requestedCount);

    const wrappedA = wrapCode(refSolution, 71);

    // ── Step 2: Run primary ref against sample inputs ──
    const sampleOutputsA: string[] = [];
    if (sampleTestCases && sampleTestCases.length > 0) {
      for (const sample of sampleTestCases) {
        try {
          const sr = await runCode(wrappedA, 71, sample.input);
          if (!sr.ok) return null; // runtime error → solution is broken
          sampleOutputsA.push(normalizeTokens(sr.stdout));
        } catch {
          return null;
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    // ── Step 3: Generate SECOND independent ref solution ──
    const crossPrompt = `You are a coding expert. Write a CORRECT Python function that solves this problem.

RULES:
1. Output valid JSON ONLY. No markdown.
2. Return: {"referenceSolution": "def func_name(...):\\n    ..."}
3. The function MUST be correct. Double-check edge cases.
4. ONLY function definitions. NO if __name__ block, NO input() calls.
5. The function name and parameter names MUST exactly match the question.
6. Use the SIMPLEST correct approach (brute force is fine for validation).
7. For range queries (sum, min, max, count), use simple iteration: for i in range(L, R+1).
   Do NOT implement MO's Algorithm, segment trees, or any approach that reorders queries.
8. The function MUST return/print results in the ORIGINAL input order.`;

    const crossCompletion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: crossPrompt },
        { role: 'user', content: `Question:\n${questionText}` },
      ],
    });

    const crossRaw = crossCompletion.choices[0]?.message?.content || '{}';
    const crossParsed = JSON.parse(crossRaw) as { referenceSolution?: string };
    const crossSolution = (crossParsed.referenceSolution || '').trim();
    if (!crossSolution) return null;

    const wrappedB = wrapCode(crossSolution, 71);

    // ── Step 4: Run second ref against same sample inputs ──
    let solutionsAgreeOnSamples = true;
    let correctedSamples: Array<{ input: string; output: string }> | undefined;

    if (sampleTestCases && sampleTestCases.length > 0) {
      const sampleOutputsB: string[] = [];
      for (const sample of sampleTestCases) {
        try {
          const sr = await runCode(wrappedB, 71, sample.input);
          if (!sr.ok) { solutionsAgreeOnSamples = false; break; }
          sampleOutputsB.push(normalizeTokens(sr.stdout));
        } catch {
          solutionsAgreeOnSamples = false;
          break;
        }
        await new Promise((r) => setTimeout(r, 600));
      }

      if (solutionsAgreeOnSamples && sampleOutputsA.length === sampleOutputsB.length) {
        // Check if both solutions agree with each other
        for (let i = 0; i < sampleOutputsA.length; i++) {
          if (sampleOutputsA[i] !== sampleOutputsB[i]) {
            solutionsAgreeOnSamples = false;
            break;
          }
        }
      } else {
        solutionsAgreeOnSamples = false;
      }

      if (!solutionsAgreeOnSamples) return null; // solutions disagree → can't trust either

      // Both solutions agree — check if stored samples need correction
      let samplesNeedCorrection = false;
      for (let i = 0; i < sampleTestCases.length; i++) {
        const storedTokens = normalizeTokens(sampleTestCases[i].output);
        if (storedTokens !== sampleOutputsA[i]) {
          samplesNeedCorrection = true;
          break;
        }
      }

      if (samplesNeedCorrection) {
        correctedSamples = sampleTestCases.map((tc, i) => ({
          input: tc.input,
          output: sampleOutputsA[i],
        }));
      }
    }

    // ── Step 5: Generate hidden case outputs using primary ref ──
    const cases: GeneratedCase[] = [];

    for (const input of testInputs) {
      try {
        const resultA = await runCode(wrappedA, 71, input);
        if (!resultA.ok || !resultA.stdout.length) continue;

        // Cross-validate with second solution
        const resultB = await runCode(wrappedB, 71, input);
        if (!resultB.ok) continue;

        const outputA = normalizeTokens(resultA.stdout);
        const outputB = normalizeTokens(resultB.stdout);

        // Only include test case if both solutions agree
        if (outputA === outputB) {
          cases.push({ input, output: outputA });
        }
      } catch {
        // Skip
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    if (cases.length === 0) return null;

    return { cases, correctedSamples };
  } catch {
    return null;
  }
}

/** Fix common AI issues with test inputs */
function repairTestInputs(refSolution: string, testInputs: string[]): string[] {
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

  if (paramCount > 0) {
    testInputs = testInputs.map((inp) => {
      const lines = inp.split('\n').filter((l) => l.trim());
      if (lines.length > paramCount) {
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

  return testInputs;
}

async function fallbackGenerate(
  questionText: string,
  count: number,
  sampleTestCases?: Array<{ input: string; output: string }>,
): Promise<{
  success: boolean;
  cases?: GeneratedCase[];
  correctedSamples?: Array<{ input: string; output: string }>;
  error?: string;
}> {
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
