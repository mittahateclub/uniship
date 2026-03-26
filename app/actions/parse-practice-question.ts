'use server';

import { groq } from '@/lib/groq';
import { wrapCode, extractFunctionName, extractPythonParamCount } from '@/lib/code-wrapper';
import { runCode } from '@/lib/judge0';

function normalizeTokens(value: string): string {
  return (value || '')
    .replace(/[\[\],]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
    .join(' ');
}

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
   - Clearly state the function signature: function name, parameter names and types, return type.
   - Describe the input/output format for sample test cases.
8. Title should be concise (3-8 words).
9. DATA STRUCTURE CONVENTIONS for test case inputs/outputs:
   - Linked lists → represent as arrays: [1, 2, 3, 4, 5]
   - Binary trees → level-order array with null: [1, 2, 3, null, 4]
   - Graphs → number of nodes + edge list: n on line 1, edges as [[0,1],[1,2]] on line 2
   - Matrix/Grid → list of lists: [[1,0],[0,1]]
   - Intervals → list of [start, end]: [[1,3],[2,6]]
   - Strings → quoted string: "abcba"
   - Arrays → Python list: [1, 2, 3, 4, 5]
10. For test case inputs: each "input" is a COMPLETE stdin for one test run.
    - If the function has N parameters, the input must have EXACTLY N lines separated by \n.
    - Each line is one function argument as a valid Python literal (parseable by ast.literal_eval).
    - Examples for f(arr, queries): "[1, 2, 3]\n[[0, 1], [1, 2]]" (two lines).
    - Examples for f(arr, target): "[2, 7, 11]\n9" (two lines).
    - NEVER include variable names like "arr = ". Just raw values.
11. For test case outputs: use SPACE-SEPARATED VALUES on one line, NOT Python list syntax.
    - Correct: "6 15 18"
    - Wrong: "[6, 15, 18]"
    - Single value: just the value, e.g. "42"
    - Multiple output lines: separate with newlines.
12. No markdown, no explanation outside JSON.`;

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

    // Clean up sample test case inputs: strip variable prefixes like "arr = "
    if (parsed.sampleTestCases) {
      parsed.sampleTestCases = parsed.sampleTestCases.map((tc) => ({
        ...tc,
        input: tc.input
          .split('\n')
          .map((line) => {
            const trimmed2 = line.trim();
            const eq = trimmed2.indexOf('=');
            if (eq > 0 && trimmed2[eq + 1] !== '=' && /^[a-zA-Z_]\w*$/.test(trimmed2.slice(0, eq).trim())) {
              return trimmed2.slice(eq + 1).trim();
            }
            return trimmed2;
          })
          .join('\n'),
        output: tc.output
          .replace(/^\[/, '').replace(/\]$/, '')
          .replace(/,\s*/g, ' ')
          .trim(),
      }));
    }

    return { success: true as const, question: parsed };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to parse question.';
    return { success: false as const, error: message };
  }
}

const REF_SOLUTION_PROMPT = (count: number) => `You generate test data for coding problems by providing a correct Python reference solution and test inputs.

CRITICAL RULES:
1. Output valid JSON ONLY. No markdown.
2. Return: {"referenceSolution": "def func_name(...):\\n    ...", "testInputs": ["input1", "input2", ...]}
3. "referenceSolution" must be a complete, correct Python function (or set of helper functions + main function).
   - ONLY function definitions. NO if __name__ block, NO input() calls, NO imports (standard lib is pre-imported).
   - The LAST public function is the one that will be called.
   - If the question says to print output, use print(). If it says to return, use return.
   - The solution MUST be correct — it will be executed to compute expected outputs.
   - VERIFY your solution against the sample test cases provided in the question. If the question shows Input: [1,2,3,4,5] / [[0,2],[1,3],[2,4]] and Output: [6,9,12], your solution must produce exactly those values.
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

export async function generateTestCasesForQuestion(
  questionText: string,
  count: number = 4,
  sampleTestCases?: Array<{ input: string; output: string }>,
) {
  try {
    const trimmed = (questionText || '').trim();
    if (!trimmed) {
      return { success: false as const, error: 'Question text is required.' };
    }

    const requestedCount = Math.min(Math.max(count, 2), 8);

    let userContent = `Generate test data for this coding question:\n\n${trimmed}`;
    if (sampleTestCases && sampleTestCases.length > 0) {
      const samplesStr = sampleTestCases
        .map((tc, i) => `Sample ${i + 1}:\n  Input:\n${tc.input.split('\n').map(l => '    ' + l).join('\n')}\n  Expected Output: ${tc.output}`)
        .join('\n');
      userContent += `\n\nKnown sample test cases (your reference solution MUST produce these exact outputs for these inputs):\n${samplesStr}`;
    }

    // Try up to 3 times with increasing temperature to get a correct ref solution
    const temperatures = [0.2, 0.4, 0.7];
    for (let attempt = 0; attempt < temperatures.length; attempt++) {
      const result = await tryGenerateWithRef(
        userContent, requestedCount, sampleTestCases, temperatures[attempt],
      );
      if (result) return { success: true as const, cases: result };
      await new Promise((r) => setTimeout(r, 500));
    }

    // All attempts failed — fall back to Groq-only generation
    return await fallbackGenerateTestCases(trimmed, requestedCount);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate test cases.';
    return { success: false as const, error: message };
  }
}

async function tryGenerateWithRef(
  userContent: string,
  requestedCount: number,
  sampleTestCases: Array<{ input: string; output: string }> | undefined,
  temperature: number,
): Promise<Array<{ input: string; output: string }> | null> {
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

    // Validate: run ref solution against sample test cases first
    if (sampleTestCases && sampleTestCases.length > 0) {
      let samplesPassed = 0;
      for (const sample of sampleTestCases) {
        try {
          const sampleResult = await runCode(wrappedCode, 71, sample.input);
          if (sampleResult.ok) {
            const actualTokens = normalizeTokens(sampleResult.stdout);
            const expectedTokens = normalizeTokens(sample.output);
            if (actualTokens === expectedTokens) {
              samplesPassed += 1;
            }
          }
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 600));
      }
      // If ref solution fails ALL samples, this attempt failed
      if (samplesPassed === 0) return null;
    }

    // Ref solution validated — now generate hidden case outputs
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

    if (cases.length === 0) return null;

    return cases;
  } catch {
    return null;
  }
}

async function fallbackGenerateTestCases(questionText: string, count: number) {
  const systemPrompt = `You generate test cases for coding problems.

CRITICAL RULES:
1. Output valid JSON ONLY. No markdown.
2. Return: {"testCases": [{"input": "...", "output": "..."}]}
3. Generate exactly ${count} diverse test cases with edge cases.
4. INPUT FORMAT: Each "input" string is a COMPLETE stdin for one test run.
   - If the function has N parameters, the input string must have EXACTLY N lines separated by \n.
   - Each line is one function argument as a valid Python literal (parseable by ast.literal_eval).
   - Examples for f(arr, queries): "[1, 2, 3]\n[[0, 1], [1, 2]]" (two lines: arr then queries).
   - Examples for f(arr, target): "[2, 7, 11]\n9" (two lines).
   - NEVER include variable names like "arr = ". Just raw values.
5. OUTPUT FORMAT: exactly what a correct program would print to stdout.
   - Lists/arrays: space-separated on one line (e.g. "5 4 3 2 1"), NOT Python list syntax.
   - Single value: just the value.
   - Multiple output lines: separate with newlines.`;

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
