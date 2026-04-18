from __future__ import annotations

import json


def dumps(data) -> str:
    return json.dumps(data, ensure_ascii=True)


def loads(payload: str):
    return json.loads(payload)
