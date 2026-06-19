/**
 * Universal code wrapper — auto-detects function name, parameter count,
 * and parses STDIN to call the student's function.
 *
 * Input contract: one function argument per line, as a Python literal.
 * Python 3 only; other languages pass through unchanged.
 * JavaScript/TypeScript: reads stdin, JSON-parses each line, calls function.
 */

const PYTHON3_ID = 71;
const JS_ID = 93;
const TS_ID = 74;
const JAVA_ID = 62;
const CPP_ID = 54;
const C_ID = 50;

export function extractFunctionName(code: string, languageId: number): string | null {
  if (languageId === PYTHON3_ID) {
    // Match both top-level and indented (class method) defs
    const matches = [...code.matchAll(/^[ \t]*def\s+(\w+)\s*\(/gm)];
    if (matches.length === 0) return null;
    const publicFns = matches.filter(m => !m[1].startsWith('_'));
    if (publicFns.length > 0) return publicFns[publicFns.length - 1][1];
    return matches[matches.length - 1][1];
  }

  if (languageId === JS_ID || languageId === TS_ID) {
    return extractJsFunctionName(code);
  }

  if (languageId === JAVA_ID) {
    return extractJavaMethodName(code);
  }

  if (languageId === CPP_ID || languageId === C_ID) {
    return extractCppFunctionName(code);
  }

  return null;
}

export function extractPythonParamCount(code: string, functionName: string): number {
  if (!functionName) return 0;
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = code.match(new RegExp(`^[ \\t]*def\\s+${escaped}\\s*\\(([^)]*)\\)`, 'm'));
  if (!match) return 0;
  const raw = match[1].trim();
  if (!raw) return 0;
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('*') && p !== 'self')
    .length;
}

/* ── Python driver injected before student code ── */
const UNIVERSAL_DRIVER = `
from __future__ import annotations
import sys as _sys
import ast as _ast
import io as _io
import copy as _copy
from contextlib import redirect_stdout as _redirect_stdout

_PERR = '__PLATFORM_PARSE_ERROR__'
_orig_print = print

def _quiet_print(*_a, **_k):
  return None

# Suppress top-level student demo output while loading student code.
print = _quiet_print

def _parse_arg(_line):
    _line = _line.strip()
    if not _line:
        return None
    # Strip variable assignment prefix: "arr = [1,2,3]" -> "[1,2,3]"
    _eq = _line.find('=')
    if _eq > 0 and _line[_eq+1:_eq+2] != '=' and _line[:_eq].strip().isidentifier():
        _line = _line[_eq+1:].strip()
    # Try ast.literal_eval (lists, tuples, dicts, strings, numbers, bools, None)
    try:
        return _ast.literal_eval(_line)
    except Exception:
        pass
    # Space-separated numbers: "1 2 3" -> [1,2,3]
    _tks = _line.split()
    if len(_tks) > 1:
        try:
            return list(map(int, _tks))
        except Exception:
            try:
                return list(map(float, _tks))
            except Exception:
                pass
    # Single number
    try:
        return int(_line)
    except Exception:
        pass
    try:
        return float(_line)
    except Exception:
        pass
    return _line

def _smart_parse(_text, _pc):
    _text = _text.strip()
    if not _text or _pc <= 0:
        return []
    _lns = [_l for _l in _text.split(chr(10)) if _l.strip()]

    # Strategy 1: exactly one line per argument
    if len(_lns) == _pc:
        return [_parse_arg(_l) for _l in _lns]

    # Strategy 2: more lines than params — skip size-prefix lines, combine extras
    if len(_lns) > _pc:
        _fl = []
        _i = 0
        while _i < len(_lns):
            _v = _parse_arg(_lns[_i])
            # Size-prefix check: integer N followed by a list/tuple of length N
            if isinstance(_v, int) and _v >= 0 and _i + 1 < len(_lns):
                _nxt = _parse_arg(_lns[_i + 1])
                if isinstance(_nxt, (list, tuple)) and len(_nxt) == _v:
                    _i += 1
                    continue
            _fl.append(_v)
            _i += 1

        # Common DSA shape for 2-arg functions:
        # arg1 on one line, then integer N, then N lines for arg2 rows/items.
        if _pc == 2 and len(_fl) >= 3 and isinstance(_fl[1], int) and _fl[1] >= 0:
            _n = _fl[1]
            if _n == 0:
                return [_fl[0], []]
            if len(_fl) >= 2 + _n:
                _rows = _fl[2:2 + _n]
                return [_fl[0], _rows]

        if len(_fl) == _pc:
            return _fl
        # Extra items remain: combine trailing items into last param
        if len(_fl) > _pc and _pc >= 1:
            _first = _fl[:_pc - 1]
            _rest = _fl[_pc - 1:]
            # All lists → 2D matrix or list-of-lists
            if all(isinstance(_x, (list, tuple)) for _x in _rest):
                return _first + [list(_rest)]
            # All scalars → flat list
            if all(isinstance(_x, (int, float)) for _x in _rest):
                return _first + [_rest]
            return _fl[:_pc]

    # Strategy 3: single line, multiple params
    if len(_lns) == 1 and _pc > 1:
        # Try as comma-separated tuple
        try:
            _v = _ast.literal_eval(chr(40) + _text + chr(41))
            if isinstance(_v, tuple) and len(_v) == _pc:
                return list(_v)
        except Exception:
            pass
        # Try whitespace-separated tokens
        _tks = _text.split()
        if len(_tks) == _pc:
            return [_parse_arg(_t) for _t in _tks]

    # Strategy 4: fewer lines — single param collects everything
    if _pc == 1:
        if len(_lns) == 1:
            return [_parse_arg(_lns[0])]
        _parsed_lines = [_parse_arg(_l) for _l in _lns]
        # If all parsed as lists → 2D matrix
        if all(isinstance(_p, (list, tuple)) for _p in _parsed_lines):
            return [_parsed_lines]
        return [_parsed_lines]

    # Fallback: parse each line, take first _pc
    _parsed = [_parse_arg(_l) for _l in _lns]
    if len(_parsed) >= _pc:
        return _parsed[:_pc]
    # Not enough args — report clearly
    _sys.stderr.write(f'{_PERR}: expected {_pc} args, parsed {len(_parsed)} from {len(_lns)} lines\\n')
    return _parsed

def _fmt(_r):
    if _r is None:
        return
    if isinstance(_r, bool):
        print(str(_r).lower())
    elif isinstance(_r, str):
        print(_r)
    elif isinstance(_r, dict):
        print(_r)
    elif isinstance(_r, (list, tuple)):
        if _r and isinstance(_r[0], (list, tuple)):
            for _row in _r:
                print(' '.join(str(_x) for _x in _row))
        else:
            print(' '.join(str(_x) for _x in _r))
    else:
        print(_r)

def _run_fn(_fn, _args, _pc):
    if not _args:
        _sys.stderr.write(f'{_PERR}: no arguments parsed from stdin\\n')
        return
    _saved = _copy.deepcopy(_args)
    _cap = _io.StringIO()
    _res = None
    with _redirect_stdout(_cap):
        try:
            _res = _fn(*_args)
        except TypeError as _te:
            if len(_args) == 1 and isinstance(_args[0], (list, tuple)) and _pc > 1:
                _res = _fn(*_args[0])
            else:
                raise
    _co = _cap.getvalue().strip()
    if _co:
        print(_co)
        return
    if _res is not None:
        _fmt(_res)
        return
    for _k in range(len(_saved)):
        if _args[_k] != _saved[_k]:
            _fmt(_args[_k])
            return
    for _k in range(len(_args)):
        if isinstance(_args[_k], (list, dict)):
            _fmt(_args[_k])
            return
`.trim();

// ── Main entry point ──

const HAS_MAIN_BLOCK = /^if\s+__name__\s*==\s*["']__main__["']\s*:/m;

export function wrapCode(
  studentCode: string,
  languageId: number,
  mode: 'run' | 'submit' = 'submit',
): string {
  if (languageId === PYTHON3_ID) {
    // In "run" mode, if the student already has an if __name__ block,
    // respect their own test harness and don't wrap.
    if (mode === 'run' && HAS_MAIN_BLOCK.test(studentCode)) {
      return studentCode;
    }
    const functionName = extractFunctionName(studentCode, languageId);
    if (!functionName) return studentCode;
    const paramCount = extractPythonParamCount(studentCode, functionName);
    if (paramCount === 0) return studentCode;
    return buildPythonWrapper(studentCode, functionName, paramCount);
  }

  if (languageId === JS_ID || languageId === TS_ID) {
    const functionName = extractJsFunctionName(studentCode);
    if (!functionName) return studentCode;
    const paramCount = extractJsParamCount(studentCode, functionName);
    return buildJsWrapper(studentCode, functionName, paramCount);
  }

  if (languageId === JAVA_ID) {
    const methodName = extractJavaMethodName(studentCode);
    if (!methodName) return studentCode;
    return buildJavaWrapper(studentCode, methodName);
  }

  if (languageId === CPP_ID || languageId === C_ID) {
    const functionName = extractCppFunctionName(studentCode);
    if (!functionName) return studentCode;
    return buildCppWrapper(studentCode, functionName, languageId);
  }

  return studentCode;
}

function buildPythonWrapper(
  studentCode: string,
  functionName: string,
  paramCount: number,
): string {
  // Strip any existing if __name__ == "__main__": block
  const stripped = studentCode
    .replace(
      /^if\s+__name__\s*==\s*["']__main__["']\s*:.*(?:\n(?:[ \t]+.*|\s*))*$/m,
      '',
    )
    // Strip top-level print-based demo lines; they pollute judged stdout.
    .replace(/^print\s*\(.*\)\s*$/gm, '')
    .trimEnd();

  // Detect if function is inside a class (indented def with self param)
  const classMatch = studentCode.match(/^class\s+(\w+)/m);
  const isSelfMethod = new RegExp(`def\\s+${functionName}\\s*\\(\\s*self\\b`).test(studentCode);
  const fnRef = (classMatch && isSelfMethod)
    ? `${classMatch[1]}().${functionName}`
    : functionName;

  const driver = [
    `print = _orig_print`,
    `_inp = _sys.stdin.read()`,
    `_args = _smart_parse(_inp, ${paramCount})`,
    `_run_fn(${fnRef}, _args, ${paramCount})`,
  ].join('\n');

  return [UNIVERSAL_DRIVER, '', '# ---- student code ----', stripped, '', '# ---- driver ----', driver].join('\n');
}


/* ═══════════════════════════════════════════════
 * JavaScript / TypeScript wrapper
 * ═══════════════════════════════════════════════ */

function extractJsFunctionName(code: string): string | null {
  // Match: function name(
  const fnDecl = [...code.matchAll(/^function\s+(\w+)\s*\(/gm)];
  // Match: var/let/const name = function(  OR  var/let/const name = (
  const fnExpr = [...code.matchAll(/^(?:var|let|const)\s+(\w+)\s*=\s*(?:function\s*)?\(/gm)];
  const all = [...fnDecl, ...fnExpr];
  if (all.length === 0) return null;
  // Filter out obvious internal names
  const publicFns = all.filter(m => !m[1].startsWith('_'));
  if (publicFns.length > 0) return publicFns[publicFns.length - 1][1];
  return all[all.length - 1][1];
}

function extractJsParamCount(code: string, functionName: string): number {
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // function name(a, b, c)
  const fnDecl = code.match(new RegExp(`function\\s+${escaped}\\s*\\(([^)]*)\\)`));
  if (fnDecl) {
    const raw = fnDecl[1].trim();
    if (!raw) return 0;
    return raw.split(',').map(p => p.trim()).filter(p => p && !p.startsWith('...')).length;
  }
  // var/let/const name = function(a, b) OR (a, b) =>
  const fnExpr = code.match(new RegExp(`(?:var|let|const)\\s+${escaped}\\s*=\\s*(?:function\\s*)?\\(([^)]*)\\)`));
  if (fnExpr) {
    const raw = fnExpr[1].trim();
    if (!raw) return 0;
    return raw.split(',').map(p => p.trim()).filter(p => p && !p.startsWith('...')).length;
  }
  return 0;
}

function buildJsWrapper(studentCode: string, functionName: string, paramCount: number): string {
  // Suppress student's console.log/error, include code, then driver
  return `
// ---- suppress student output ----
const _origLog = console.log;
const _origErr = console.error;
console.log = function(){};
console.error = function(){};

// ---- student code ----
${studentCode}

// ---- driver ----
console.log = _origLog;
console.error = _origErr;
const _inp = require('fs').readFileSync(0, 'utf8').trim();
const _lines = _inp.split('\\n').filter(l => l.trim());

function _parseLine(_l) {
  _l = _l.trim();
  try { return JSON.parse(_l); } catch(_e) {}
  if (_l === 'True') return true;
  if (_l === 'False') return false;
  if (_l === 'None') return null;
  const _n = Number(_l);
  if (!isNaN(_n) && _l !== '') return _n;
  return _l;
}

function _smartParse(_lines, _pc) {
  const _parsed = _lines.map(_parseLine);
  // Exact match: one line per arg
  if (_parsed.length === _pc) return _parsed;

  if (_parsed.length > _pc) {
    // Filter out size-prefix lines (integer N followed by array of length N)
    const _filtered = [];
    for (let _i = 0; _i < _parsed.length; _i++) {
      const _v = _parsed[_i];
      if (typeof _v === 'number' && Number.isInteger(_v) && _v >= 0 && _i + 1 < _parsed.length) {
        const _nxt = _parsed[_i + 1];
        if (Array.isArray(_nxt) && _nxt.length === _v) {
          continue; // skip size prefix
        }
      }
      _filtered.push(_v);
    }
    // 2-arg function: arg1 + count N + N rows
    if (_pc === 2 && _filtered.length >= 3 && typeof _filtered[1] === 'number' && Number.isInteger(_filtered[1])) {
      const _n = _filtered[1];
      if (_n === 0) return [_filtered[0], []];
      if (_filtered.length >= 2 + _n) {
        return [_filtered[0], _filtered.slice(2, 2 + _n)];
      }
    }
    if (_filtered.length === _pc) return _filtered;
    // Extra items: combine trailing into last arg
    if (_filtered.length > _pc && _pc >= 1) {
      const _first = _filtered.slice(0, _pc - 1);
      const _rest = _filtered.slice(_pc - 1);
      if (_rest.every(x => Array.isArray(x))) return [..._first, _rest];
      if (_rest.every(x => typeof x === 'number')) return [..._first, _rest];
      return _filtered.slice(0, _pc);
    }
  }

  // Single line, multiple params: try space-separated
  if (_parsed.length === 1 && _pc > 1) {
    const _tks = _lines[0].trim().split(/\\s+/);
    if (_tks.length === _pc) return _tks.map(_parseLine);
  }

  // Fewer lines, single param: collect all
  if (_pc === 1) {
    if (_parsed.length === 1) return [_parsed[0]];
    if (_parsed.every(p => Array.isArray(p))) return [_parsed];
    return [_parsed];
  }

  return _parsed.slice(0, _pc);
}

const _pc = ${paramCount};
const _args = (_pc > 0) ? _smartParse(_lines, _pc) : _lines.map(_parseLine);
const _res = ${functionName}(..._args);
if (_res !== undefined && _res !== null) {
  if (typeof _res === 'boolean') _origLog(_res.toString());
  else if (Array.isArray(_res) || typeof _res === 'object') _origLog(JSON.stringify(_res));
  else _origLog(_res);
}
`.trim();
}


/* ═══════════════════════════════════════════════
 * Java wrapper
 * ═══════════════════════════════════════════════ */

function extractJavaMethodName(code: string): string | null {
  // Match public methods that are not "main"
  const matches = [...code.matchAll(/public\s+(?:static\s+)?(?:\w+(?:<[^>]*>)?(?:\[\])*)\s+(\w+)\s*\(/gm)];
  const filtered = matches.filter(m => m[1] !== 'main' && m[1] !== 'Main');
  if (filtered.length === 0) return null;
  return filtered[filtered.length - 1][1];
}

function extractJavaParamTypes(code: string, methodName: string): string[] {
  const escaped = methodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = code.match(new RegExp(`public\\s+(?:static\\s+)?(?:\\w+(?:<[^>]*>)?(?:\\[\\])*)\\s+${escaped}\\s*\\(([^)]*)\\)`));
  if (!match || !match[1].trim()) return [];
  return match[1].split(',').map(p => {
    const parts = p.trim().split(/\s+/);
    return parts.length >= 2 ? parts[0] : 'String';
  });
}

function extractJavaReturnType(code: string, methodName: string): string {
  const escaped = methodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = code.match(new RegExp(`public\\s+(?:static\\s+)?(\\w+(?:<[^>]*>)?(?:\\[\\])*)\\s+${escaped}\\s*\\(`));
  return match ? match[1] : 'void';
}

function javaFormatExpr(type: string, varName: string): string {
  const t = type.replace(/\s/g, '');
  if (t === 'int[]' || t === 'Integer[]') return `java.util.Arrays.toString(${varName})`;
  if (t === 'int[][]') return `java.util.Arrays.deepToString(${varName})`;
  if (t === 'boolean' || t === 'Boolean') return `String.valueOf(${varName}).toLowerCase()`;
  if (t.startsWith('List') || t.startsWith('ArrayList')) return `${varName}.toString()`;
  return `String.valueOf(${varName})`;
}

function buildJavaWrapper(studentCode: string, methodName: string): string {
  const paramTypes = extractJavaParamTypes(studentCode, methodName);
  const returnType = extractJavaReturnType(studentCode, methodName);

  const argList = paramTypes.map((_, i) => `_a${i}`).join(', ');
  const isStatic = studentCode.includes(`public static`) && studentCode.includes(methodName);
  const callExpr = isStatic
    ? `Solution.${methodName}(${argList})`
    : `new Solution().${methodName}(${argList})`;

  const printResult = returnType === 'void'
    ? `        ${callExpr};`
    : `        ${returnType} _res = ${callExpr};\n        System.out.println(${javaFormatExpr(returnType, '_res')});`;

  // Strip existing main method from student code
  const strippedCode = studentCode.replace(
    /public\s+static\s+void\s+main\s*\([^)]*\)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g,
    ''
  );

  // Build arg parsing using a cursor (_idx) instead of static indices
  const argParsing = paramTypes.map((type, i) => {
    const t = type.replace(/\s/g, '');
    if (t === 'int' || t === 'Integer') return `        int _a${i} = Integer.parseInt(_lines.get(_idx++).trim());`;
    if (t === 'long' || t === 'Long') return `        long _a${i} = Long.parseLong(_lines.get(_idx++).trim());`;
    if (t === 'double' || t === 'Double') return `        double _a${i} = Double.parseDouble(_lines.get(_idx++).trim());`;
    if (t === 'boolean' || t === 'Boolean') return `        boolean _a${i} = _lines.get(_idx++).trim().equalsIgnoreCase("true");`;
    if (t === 'String') return `        String _a${i} = _lines.get(_idx++).trim().replaceAll("^\\"|\\"$","");`;
    if (t === 'int[]' || t === 'Integer[]') return `        int[] _a${i} = _parseIntArr(_lines.get(_idx++));`;
    if (t === 'int[][]') return `        int[][] _a${i} = _parseMultiLine2D(_lines, _idx); _idx += _a${i}.length + 1;`;
    if (t === 'String[]') return `        String[] _a${i} = _parseStrArr(_lines.get(_idx++));`;
    if (t.includes('List<Integer>') && !t.includes('List<List')) return `        List<Integer> _a${i} = _parseIntList(_lines.get(_idx++));`;
    if (t.includes('List<List<Integer>>')) return `        List<List<Integer>> _a${i} = _parseMultiLineList(_lines, _idx); _idx += _a${i}.size() + 1;`;
    if (t.includes('List<String>')) return `        List<String> _a${i} = _parseStrList(_lines.get(_idx++));`;
    return `        String _a${i} = _lines.get(_idx++).trim();`;
  }).join('\n');

  return `
import java.util.*;
import java.util.stream.*;

${strippedCode}

class Main {
    static int[] _parseIntArr(String s) {
        s = s.trim().replaceAll("[\\\\[\\\\]()]", "");
        if (s.isEmpty()) return new int[0];
        return Arrays.stream(s.split(",")).map(String::trim).mapToInt(Integer::parseInt).toArray();
    }
    static List<Integer> _parseIntList(String s) {
        int[] a = _parseIntArr(s); List<Integer> r = new ArrayList<>();
        for (int v : a) r.add(v); return r;
    }
    static String[] _parseStrArr(String s) {
        s = s.trim().replaceAll("[\\\\[\\\\]()]", "");
        if (s.isEmpty()) return new String[0];
        return Arrays.stream(s.split(",")).map(x -> x.trim().replaceAll("^\\"|\\"$","")).toArray(String[]::new);
    }
    static List<String> _parseStrList(String s) { return Arrays.asList(_parseStrArr(s)); }
    static int[][] _parseInt2D(String s) {
        s = s.trim();
        if (s.startsWith("[")) s = s.substring(1);
        if (s.endsWith("]")) s = s.substring(0, s.length()-1);
        List<int[]> rows = new ArrayList<>();
        int depth = 0; StringBuilder cur = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (c == '[') { depth++; cur.append(c); }
            else if (c == ']') { depth--; cur.append(c); if (depth == 0) { rows.add(_parseIntArr(cur.toString())); cur = new StringBuilder(); } }
            else if (c == ',' && depth == 0) { continue; }
            else { cur.append(c); }
        }
        return rows.toArray(new int[0][]);
    }
    static List<List<Integer>> _parseInt2DList(String s) {
        int[][] a = _parseInt2D(s); List<List<Integer>> r = new ArrayList<>();
        for (int[] row : a) { List<Integer> lr = new ArrayList<>(); for (int v : row) lr.add(v); r.add(lr); }
        return r;
    }
    // Multi-line: integer count N, then N lines each containing an array
    static int[][] _parseMultiLine2D(List<String> lines, int idx) {
        int n = Integer.parseInt(lines.get(idx).trim());
        int[][] r = new int[n][];
        for (int i = 0; i < n; i++) r[i] = _parseIntArr(lines.get(idx + 1 + i));
        return r;
    }
    static List<List<Integer>> _parseMultiLineList(List<String> lines, int idx) {
        int n = Integer.parseInt(lines.get(idx).trim());
        List<List<Integer>> r = new ArrayList<>();
        for (int i = 0; i < n; i++) r.add(_parseIntList(lines.get(idx + 1 + i)));
        return r;
    }
    // Smart line allocation: skip size-prefix integers
    static List<String> _smartLines(List<String> raw, int paramCount) {
        if (raw.size() == paramCount) return raw;
        // Try skipping size prefixes
        List<String> filtered = new ArrayList<>();
        for (int i = 0; i < raw.size(); i++) {
            String s = raw.get(i).trim();
            try {
                int n = Integer.parseInt(s);
                if (n >= 0 && i + 1 < raw.size()) {
                    String nxt = raw.get(i + 1).trim();
                    if (nxt.startsWith("[") || nxt.startsWith("(")) {
                        try {
                            int[] arr = _parseIntArr(nxt);
                            if (arr.length == n) continue;
                        } catch (Exception e) {}
                    }
                }
            } catch (Exception e) {}
            filtered.add(raw.get(i));
        }
        return filtered;
    }
    public static void main(String[] args) throws Exception {
        Scanner _sc = new Scanner(System.in);
        List<String> _rawLines = new ArrayList<>();
        while (_sc.hasNextLine()) { String _l = _sc.nextLine().trim(); if (!_l.isEmpty()) _rawLines.add(_l); }
        List<String> _lines = _smartLines(_rawLines, ${paramTypes.length});
        int _idx = 0;
${argParsing}
${printResult}
    }
}
`.trim();
}


/* ═══════════════════════════════════════════════
 * C++ wrapper
 * ═══════════════════════════════════════════════ */

function extractCppFunctionName(code: string): string | null {
  // Match free functions or methods inside class Solution
  // [\w:]+ handles std::vector etc, (?:const\s+)? handles const qualifiers
  const CPP_KEYWORDS = new Set([
    'if','else','for','while','do','switch','case','return','break','continue',
    'try','catch','throw','new','delete','sizeof','typeof','alignof','decltype',
    'static_cast','dynamic_cast','reinterpret_cast','const_cast','typedef',
    'struct','class','enum','namespace','template','operator','public','private',
    'protected','virtual','override','final','explicit','inline','extern',
    'register','volatile','mutable','constexpr','consteval','constinit',
  ]);
  const matches = [...code.matchAll(/(?:^|\s)(?:(?:const\s+)?[\w:]+(?:<[^>]*>)?(?:\s*[*&])?)\s+(\w+)\s*\([^)]*\)\s*\{/gm)];
  const filtered = matches.filter(m => m[1] !== 'main' && m[1] !== 'Main' && !CPP_KEYWORDS.has(m[1]));
  if (filtered.length === 0) return null;
  return filtered[filtered.length - 1][1];
}

function extractCppParamTypes(code: string, fn: string): string[] {
  const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = code.match(new RegExp(`(?:(?:const\\s+)?[\\w:]+(?:<[^>]*>)?(?:\\s*[*&])?)\\s+${escaped}\\s*\\(([^)]*)\\)`));
  if (!match || !match[1].trim()) return [];
  return match[1].split(',').map(p => {
    const parts = p.trim().split(/\s+/);
    // type might be multi-word like "const vector<int>&"
    const type = parts.length >= 2 ? parts.slice(0, -1).join(' ') : 'int';
    const varName = parts[parts.length - 1];
    // int arr[] or int* arr → treat as pointer
    if (varName.includes('[]') || varName.startsWith('*')) return type + '*';
    return type;
  });
}

function extractCppReturnType(code: string, fn: string): string {
  const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = code.match(new RegExp(`((?:const\\s+)?[\\w:]+(?:<[^>]*>)?(?:\\s*[*&])?)\\s+${escaped}\\s*\\(`));
  return match ? match[1].trim() : 'void';
}

function buildCppWrapper(studentCode: string, functionName: string, languageId: number = CPP_ID): string {
  const isC = languageId === C_ID;
  const paramTypes = extractCppParamTypes(studentCode, functionName);
  const returnType = extractCppReturnType(studentCode, functionName);
  const isInClass = !isC && /class\s+Solution\s*\{/.test(studentCode);
  const paramCount = paramTypes.length;

  // Strip existing includes, using namespace, and main()
  const strippedCode = studentCode
    .replace(/^#include\s+.*$/gm, '')
    .replace(/^using\s+namespace\s+.*$/gm, '')
    .replace(/int\s+main\s*\([^)]*\)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g, '')
    .trim();

  const argList = paramTypes.map((_, i) => `_a${i}`).join(', ');
  const callExpr = isInClass
    ? `Solution().${functionName}(${argList})`
    : `${functionName}(${argList})`;

  if (isC) {
    return buildCWrapper(strippedCode, functionName, paramTypes, returnType);
  }

  // Generate parsing code for each param using _lines[_idx++]
  const argDecls = paramTypes.map((type, i) => {
    const t = type.replace(/\s/g, '').replace(/&/g, '').replace(/std::/g, '').replace(/^const/, '');
    if (t === 'int') return `    int _a${i} = stoi(_lines[_idx++]);`;
    if (t === 'long' || t === 'longlong') return `    long long _a${i} = stoll(_lines[_idx++]);`;
    if (t === 'double') return `    double _a${i} = stod(_lines[_idx++]);`;
    if (t === 'string') return `    string _a${i} = _lines[_idx++]; while(!_a${i}.empty()&&(_a${i}.front()==\'"\'||_a${i}.front()==\' \'))_a${i}.erase(0,1); while(!_a${i}.empty()&&(_a${i}.back()==\'"\'||_a${i}.back()==\' \'))_a${i}.pop_back();`;
    if (t === 'bool') return `    string _bl${i}=_lines[_idx++]; for(auto&c:_bl${i})c=tolower(c); bool _a${i}=(_bl${i}.find("true")!=string::npos||_bl${i}=="1");`;
    if (t === 'vector<int>') return `    vector<int> _a${i} = _parseVecInt(_lines[_idx++]);`;
    if (t === 'vector<string>') return `    vector<string> _a${i} = _parseVecStr(_lines[_idx++]);`;
    if (t === 'vector<vector<int>>') return `    vector<vector<int>> _a${i} = _parseVec2D(_lines[_idx++]);`;
    if (t === 'vector<long>' || t === 'vector<longlong>') return `    vector<long long> _a${i} = _parseVecLong(_lines[_idx++]);`;
    return `    string _a${i} = _lines[_idx++];`;
  }).join('\n');

  const outputCode = returnType === 'void'
    ? `    ${callExpr};`
    : `    auto _res = ${callExpr};\n    _printResult(_res);`;

  return `
#include <bits/stdc++.h>
using namespace std;

// ---- helpers ----
vector<int> _parseVecInt(const string& _l) {
    vector<int> _r; string _t;
    for (char c : _l) { if (isdigit(c) || c == '-') _t += c; else if (!_t.empty()) { _r.push_back(stoi(_t)); _t.clear(); } }
    if (!_t.empty()) _r.push_back(stoi(_t));
    return _r;
}
vector<long long> _parseVecLong(const string& _l) {
    vector<long long> _r; string _t;
    for (char c : _l) { if (isdigit(c) || c == '-') _t += c; else if (!_t.empty()) { _r.push_back(stoll(_t)); _t.clear(); } }
    if (!_t.empty()) _r.push_back(stoll(_t));
    return _r;
}
vector<string> _parseVecStr(const string& _l) {
    vector<string> _r; string _t; bool inStr = false;
    for (char c : _l) { if (c == '"') { if (inStr) { _r.push_back(_t); _t.clear(); } inStr = !inStr; } else if (inStr) _t += c; }
    return _r;
}
vector<vector<int>> _parseVec2D(const string& _l) {
    vector<vector<int>> _r; int depth = 0; string _t;
    for (char c : _l) {
        if (c == '[') { depth++; if (depth == 2) _t.clear(); }
        else if (c == ']') { depth--; if (depth == 1) { if(!_t.empty()){_r.push_back(_parseVecInt(_t));} else {_r.push_back({});} _t.clear(); } }
        else if (depth >= 2) _t += c;
    }
    return _r;
}
// Smart line filter: skip size-prefix integers
vector<string> _smartLines(const vector<string>& raw, int paramCount) {
    if ((int)raw.size() == paramCount) return raw;
    vector<string> filtered;
    for (int i = 0; i < (int)raw.size(); i++) {
        string s = raw[i]; // already trimmed
        bool skip = false;
        try {
            int n = stoi(s);
            if (n >= 0 && i + 1 < (int)raw.size()) {
                string nxt = raw[i+1];
                if (!nxt.empty() && (nxt[0] == '[' || nxt[0] == '(')) {
                    vector<int> arr = _parseVecInt(nxt);
                    if ((int)arr.size() == n) skip = true;
                }
            }
        } catch (...) {}
        if (!skip) filtered.push_back(raw[i]);
    }
    return filtered;
}
template<typename T> void _printResult(const vector<T>& v) { cout << "["; for (int i=0;i<(int)v.size();i++){if(i)cout<<", ";cout<<v[i];}cout<<"]"<<endl; }
template<typename T> void _printResult(const vector<vector<T>>& v) { cout << "["; for(int i=0;i<(int)v.size();i++){if(i)cout<<", ";cout<<"[";for(int j=0;j<(int)v[i].size();j++){if(j)cout<<", ";cout<<v[i][j];}cout<<"]";}cout<<"]"<<endl; }
void _printResult(bool v) { cout << (v ? "true" : "false") << endl; }
void _printResult(const string& v) { cout << v << endl; }
template<typename T> void _printResult(T v) { cout << v << endl; }

// ---- student code ----
${strippedCode}

// ---- driver ----
int main() {
    vector<string> _rawLines;
    string _tmpLine;
    while (getline(cin, _tmpLine)) {
        // trim
        size_t s = _tmpLine.find_first_not_of(" \\t\\r\\n");
        size_t e = _tmpLine.find_last_not_of(" \\t\\r\\n");
        if (s != string::npos) _rawLines.push_back(_tmpLine.substr(s, e - s + 1));
    }
    vector<string> _lines = _smartLines(_rawLines, ${paramCount});
    int _idx = 0;
${argDecls}
${outputCode}
    return 0;
}
`.trim();
}

/* ═══════════════════════════════════════════════
 * C wrapper (plain C - no classes, no templates, no vectors)
 * ═══════════════════════════════════════════════ */
function buildCWrapper(
  strippedCode: string,
  functionName: string,
  paramTypes: string[],
  returnType: string
): string {
  // Normalize types
  const normTypes = paramTypes.map(t =>
    t.replace(/\s/g, '').replace(/&/g, '').replace(/std::/g, '').replace(/^const/, '')
  );

  // Detect which int params are array-size params (int following int*)
  // e.g. (int* nums, int numsSize) → numsSize is size of nums
  const isSizeOf: (number | null)[] = normTypes.map(() => null);
  for (let i = 1; i < normTypes.length; i++) {
    if (normTypes[i] === 'int' && (normTypes[i - 1] === 'int*' || normTypes[i - 1] === 'vector<int>')) {
      isSizeOf[i] = i - 1; // param i is the size of param i-1
    }
  }

  // Build arg declarations — size params get assigned from parsed array size
  const argDecls = normTypes.map((t, i) => {
    if (isSizeOf[i] !== null) {
      return `    int _a${i} = _sz${isSizeOf[i]};`;
    }
    if (t === 'int') return `    int _a${i} = atoi(_lines[_idx++]);`;
    if (t === 'long' || t === 'longlong') return `    long long _a${i} = atoll(_lines[_idx++]);`;
    if (t === 'double') return `    double _a${i} = atof(_lines[_idx++]);`;
    if (t === 'bool') return `    int _a${i} = (strstr(_lines[_idx], "true") != NULL || _lines[_idx][0] == '1'); _idx++;`;
    if (t === 'int*' || t === 'vector<int>') return `    int _sz${i} = 0; int* _a${i} = _parseIntArr(_lines[_idx++], &_sz${i});`;
    return `    char* _a${i} = _lines[_idx++];`;
  }).join('\n');

  // Build call — just pass all _a{i} in order, no extra size injection
  const cCallExpr = `${functionName}(${normTypes.map((_, i) => `_a${i}`).join(', ')})`;

  // Count how many actual input lines we need (exclude size-of params)
  const inputParamCount = normTypes.filter((_, i) => isSizeOf[i] === null).length;

  const rt = returnType.replace(/\s/g, '').replace(/&/g, '').replace(/std::/g, '').replace(/^const/, '');
  let outputCode: string;
  if (rt === 'void') {
    outputCode = `    ${cCallExpr};`;
  } else if (rt === 'int') {
    outputCode = `    printf("%d\\n", ${cCallExpr});`;
  } else if (rt === 'long' || rt === 'longlong') {
    outputCode = `    printf("%lld\\n", ${cCallExpr});`;
  } else if (rt === 'double') {
    outputCode = `    printf("%f\\n", ${cCallExpr});`;
  } else if (rt === 'bool') {
    outputCode = `    printf("%s\\n", ${cCallExpr} ? "true" : "false");`;
  } else if (rt === 'char*' || rt === 'string') {
    outputCode = `    printf("%s\\n", ${cCallExpr});`;
  } else {
    outputCode = `    printf("%d\\n", ${cCallExpr});`;
  }

  return `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <limits.h>
#include <math.h>

// ---- helpers ----
int* _parseIntArr(const char* s, int* outSize) {
    int cap = 64, sz = 0;
    int* arr = (int*)malloc(cap * sizeof(int));
    const char* p = s;
    while (*p) {
        if (isdigit(*p) || (*p == '-' && isdigit(*(p+1)))) {
            if (sz >= cap) { cap *= 2; arr = (int*)realloc(arr, cap * sizeof(int)); }
            arr[sz++] = (int)strtol(p, (char**)&p, 10);
        } else p++;
    }
    *outSize = sz;
    return arr;
}
char* _trimLine(char* s) {
    while (*s == ' ' || *s == '\\t' || *s == '\\r' || *s == '\\n') s++;
    int len = strlen(s);
    while (len > 0 && (s[len-1] == ' ' || s[len-1] == '\\t' || s[len-1] == '\\r' || s[len-1] == '\\n')) s[--len] = 0;
    return s;
}

// ---- student code ----
${strippedCode}

// ---- driver ----
int main() {
    char _buf[65536];
    char* _allLines[1024];
    int _numLines = 0;
    while (fgets(_buf, sizeof(_buf), stdin)) {
        char* tr = _trimLine(_buf);
        if (strlen(tr) > 0) {
            _allLines[_numLines] = (char*)malloc(strlen(tr) + 1);
            strcpy(_allLines[_numLines], tr);
            _numLines++;
        }
    }
    // Smart filter: skip size-prefix integers
    char* _lines[1024];
    int _lineCount = 0;
    if (_numLines == ${inputParamCount}) {
        for (int i = 0; i < _numLines; i++) _lines[i] = _allLines[i];
        _lineCount = _numLines;
    } else {
        for (int i = 0; i < _numLines; i++) {
            int skip = 0;
            char* endp;
            long val = strtol(_allLines[i], &endp, 10);
            if (*endp == 0 && val >= 0 && i + 1 < _numLines) {
                if (_allLines[i+1][0] == '[' || _allLines[i+1][0] == '(') {
                    int sz = 0; int* tmp = _parseIntArr(_allLines[i+1], &sz);
                    if (sz == (int)val) skip = 1;
                    free(tmp);
                }
            }
            if (!skip) _lines[_lineCount++] = _allLines[i];
        }
    }
    int _idx = 0;
${argDecls}
${outputCode}
    return 0;
}
`.trim();
}
