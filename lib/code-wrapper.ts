/**
 * Universal code wrapper — auto-detects function name, parameter count,
 * and parses STDIN to call the student's function.
 *
 * Input contract: one function argument per line, as a Python literal.
 * Python 3 only; other languages pass through unchanged.
 */

const PYTHON3_ID = 71;

export function extractFunctionName(code: string, languageId: number): string | null {
  if (languageId !== PYTHON3_ID) return null;
  const matches = [...code.matchAll(/^def\s+(\w+)\s*\(/gm)];
  if (matches.length === 0) return null;
  const publicFns = matches.filter(m => !m[1].startsWith('_'));
  if (publicFns.length > 0) return publicFns[publicFns.length - 1][1];
  return matches[matches.length - 1][1];
}

export function extractPythonParamCount(code: string, functionName: string): number {
  if (!functionName) return 0;
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = code.match(new RegExp(`^def\\s+${escaped}\\s*\\(([^)]*)\\)`, 'm'));
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
import sys as _sys
import ast as _ast
import io as _io
import copy as _copy
from contextlib import redirect_stdout as _redirect_stdout

_PERR = '__PLATFORM_PARSE_ERROR__'

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
  if (languageId !== PYTHON3_ID) return studentCode;

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
    .trimEnd();

  const driver = [
    `_inp = _sys.stdin.read()`,
    `_args = _smart_parse(_inp, ${paramCount})`,
    `_run_fn(${functionName}, _args, ${paramCount})`,
  ].join('\n');

  return [UNIVERSAL_DRIVER, '', '# ---- student code ----', stripped, '', '# ---- driver ----', driver].join('\n');
}
