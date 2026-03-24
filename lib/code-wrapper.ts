/**
 * Universal code wrapper — auto-detects function name, parameter count,
 * and intelligently parses STDIN to call the student's function.
 * No manual configuration needed. Python 3 supported; other languages pass through.
 */

const PYTHON3_ID = 71;

// ── Auto-detect function name from student code ──

export function extractFunctionName(code: string, languageId: number): string | null {
  if (languageId === PYTHON3_ID) {
    const matches = [...code.matchAll(/^def\s+(\w+)\s*\(/gm)];
    if (matches.length === 0) return null;
    // Prefer the LAST non-underscore-prefixed function (solution is usually defined last)
    const publicFns = matches.filter(m => !m[1].startsWith('_'));
    if (publicFns.length > 0) return publicFns[publicFns.length - 1][1];
    return matches[matches.length - 1][1];
  }
  if (languageId === 62) {
    const m = code.match(/public\s+\S+\s+(\w+)\s*\(/);
    return m ? m[1] : null;
  }
  if ([50, 54].includes(languageId)) {
    const lines = code.split('\n').filter(l => !l.trim().startsWith('#') && !l.trim().startsWith('//'));
    let last: string | null = null;
    for (const l of lines) {
      const m = l.match(/^\s*\w[\w\s\*&]*?\s+(\w+)\s*\(/);
      if (m && !['if', 'while', 'for', 'switch', 'return', 'main'].includes(m[1])) last = m[1];
    }
    return last;
  }
  return null;
}

function extractPythonParamCount(code: string, functionName: string): number {
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

const UNIVERSAL_DRIVER = `
import sys as _sys
import ast as _ast
import io as _io
import re as _re
import copy as _copy
from contextlib import redirect_stdout as _redirect_stdout

def _extract_brackets(_text):
    _vals = []
    _dp = 0
    _st = None
    _iq = None
    _es = False
    for _i, _ch in enumerate(_text):
        if _iq is not None:
            if _es:
                _es = False
            elif _ch == chr(92):
                _es = True
            elif _ch == _iq:
                _iq = None
            continue
        if _ch in (chr(34), chr(39)):
            _iq = _ch
            continue
        if _ch in chr(91) + chr(40) + chr(123):
            if _dp == 0:
                _st = _i
            _dp += 1
        elif _ch in chr(93) + chr(41) + chr(125):
            _dp -= 1
            if _dp == 0 and _st is not None:
                _vals.append((_st, _text[_st:_i+1]))
                _st = None
    return _vals

def _parse_token(_tk):
    _tk = _tk.strip()
    if not _tk:
        return None
    try:
        return _ast.literal_eval(_tk)
    except Exception:
        pass
    try:
        return int(_tk)
    except Exception:
        pass
    try:
        return float(_tk)
    except Exception:
        pass
    return None

def _parse_line(_l):
    _l = _l.strip()
    if not _l:
        return None
    try:
        return _ast.literal_eval(_l)
    except Exception:
        pass
    _tks = _re.sub(r'[\\x5b\\x5d,]', ' ', _l).split()
    if not _tks:
        return _l
    try:
        return list(map(int, _tks)) if len(_tks) > 1 else int(_tks[0])
    except Exception:
        pass
    try:
        return list(map(float, _tks)) if len(_tks) > 1 else float(_tks[0])
    except Exception:
        pass
    return _l

def _smart_parse(_text, _pc):
    _text = _text.strip()
    if not _text:
        return []

    _lns = [_l.strip() for _l in _text.split(chr(10)) if _l.strip()]

    # Strategy 1: exactly _pc non-empty lines → one arg per line
    if len(_lns) == _pc:
        _parsed_lines = []
        _ok = True
        for _l in _lns:
            _v = _parse_line(_l)
            if _v is None:
                _ok = False
                break
            _parsed_lines.append(_v)
        if _ok and len(_parsed_lines) == _pc:
            return _parsed_lines

    # Strategy 2: multi-line with size-prefix skipping (before bracket extraction)
    if len(_lns) > _pc:
        _pl = []
        for _l in _lns:
            _v = _parse_line(_l)
            if _v is not None:
                _pl.append(_v)
        _fl = []
        _si = 0
        while _si < len(_pl):
            _v = _pl[_si]
            if isinstance(_v, int) and _si + 1 < len(_pl):
                _nxt = _pl[_si + 1]
                if isinstance(_nxt, list) and len(_nxt) == _v:
                    _si += 1
                    continue
                _gc = 0
                for _gj in range(_si + 1, len(_pl)):
                    if isinstance(_pl[_gj], list):
                        _gc += 1
                    else:
                        break
                if _gc == _v and _gc > 0:
                    _si += 1
                    continue
            _fl.append(_v)
            _si += 1
        if not _fl:
            _fl = _pl
        if len(_fl) == _pc:
            return _fl
        if len(_fl) > _pc and _pc > 1:
            _fa = _fl[:_pc - 1]
            _fa.append(_fl[_pc - 1:])
            return _fa
        if len(_fl) > _pc and _pc == 1:
            return [_fl]

    # Strategy 3: bracket extraction
    _bk_raw = _extract_brackets(_text)
    if _bk_raw:
        _all = []
        _pos = 0
        for _bi, _bs in _bk_raw:
            _bef = _text[_pos:_bi]
            for _tk in _re.sub(r'[,=\\s]+', ' ', _bef).split():
                _v = _parse_token(_tk)
                if _v is not None:
                    _all.append(_v)
            try:
                _all.append(_ast.literal_eval(_bs))
            except Exception:
                _all.append(_bs)
            _pos = _bi + len(_bs)
        _aft = _text[_pos:]
        for _tk in _re.sub(r'[,=\\s]+', ' ', _aft).split():
            _v = _parse_token(_tk)
            if _v is not None:
                _all.append(_v)
        if len(_all) == _pc:
            return _all
        if len(_all) > _pc:
            # Filter out scalars that look like size-prefixes before lists
            _flt = []
            for _j in range(len(_all)):
                if isinstance(_all[_j], int) and _j + 1 < len(_all) and isinstance(_all[_j + 1], (list, tuple)):
                    if len(_all[_j + 1]) == _all[_j]:
                        continue
                _flt.append(_all[_j])
            if len(_flt) == _pc:
                return _flt
            if len(_flt) >= _pc:
                return _flt[:_pc]
            return _all[:_pc]
        if _all:
            return _all

    # Strategy 4: wrap as tuple
    try:
        _wrapped = chr(40) + _text + chr(41)
        _v = _ast.literal_eval(_wrapped)
        if isinstance(_v, tuple):
            if len(_v) == _pc:
                return list(_v)
            if len(_v) > _pc and _pc > 1:
                _fa = list(_v[:_pc - 1])
                _fa.append(list(_v[_pc - 1:]))
                return _fa
    except Exception:
        pass

    # Strategy 5: single literal_eval
    try:
        _v = _ast.literal_eval(_text)
        if _pc == 1:
            return [_v]
        if isinstance(_v, (list, tuple)) and len(_v) == _pc:
            return list(_v)
        return [_v]
    except Exception:
        pass

    # Strategy 6: single line, split by spaces
    if _pc <= 1:
        _cl = _re.sub(r'[\\x5b\\x5d,]', ' ', _text).split()
        try:
            return [list(map(int, _cl))] if len(_cl) > 1 else [int(_cl[0])]
        except Exception:
            try:
                return [list(map(float, _cl))] if len(_cl) > 1 else [float(_cl[0])]
            except Exception:
                return [_text]
    return [_text]

def _fmt(_r):
    if _r is None:
        return
    if isinstance(_r, bool):
        print(str(_r).lower())
    elif isinstance(_r, str):
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
    _saved = _copy.deepcopy(_args) if _args else []
    _cap = _io.StringIO()
    _res = None
    with _redirect_stdout(_cap):
        try:
            _res = _fn(*_args)
        except TypeError as _te:
            if len(_args) == 1 and isinstance(_args[0], (list, tuple)):
                if _pc == 1 or len(_args[0]) == _pc:
                    try:
                        _res = _fn(*_args[0])
                    except Exception:
                        raise _te
                else:
                    raise _te
            else:
                raise _te
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

export function wrapCode(studentCode: string, languageId: number): string {
  if (languageId !== PYTHON3_ID) return studentCode;

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
