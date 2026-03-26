import ast

def _parse_arg(_line):
    _line = _line.strip()
    if not _line:
        return None
    _eq = _line.find('=')
    if _eq > 0 and _line[_eq+1:_eq+2] != '=' and _line[:_eq].strip().isidentifier():
        _line = _line[_eq+1:].strip()
    try:
        return ast.literal_eval(_line)
    except Exception:
        pass
    _tks = _line.split()
    if len(_tks) > 1:
        try:
            return list(map(int, _tks))
        except Exception:
            pass
    try:
        return int(_line)
    except Exception:
        pass
    try:
        return float(_line)
    except Exception:
        pass
    return _line

tests = [
    ('arr = [1, 2, 3, 4, 5]', [1, 2, 3, 4, 5]),
    ('queries = [[0, 2], [1, 4]]', [[0, 2], [1, 4]]),
    ('[1, 2, 3, 4, 5]', [1, 2, 3, 4, 5]),
    ('5', 5),
    ('n = 5', 5),
    ('[1, 4, 3, 2, 6, 5]', [1, 4, 3, 2, 6, 5]),
]

for inp, expected in tests:
    result = _parse_arg(inp)
    ok = 'PASS' if result == expected else 'FAIL'
    print(f'{ok}: _parse_arg({inp!r}) = {result!r}')
