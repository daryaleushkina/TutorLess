#!/usr/bin/env python3
"""Договор для установленного интерфейса: поля новые, enum заданий — только реализованные типы."""
import json
from pathlib import Path
import re
import sys

source, destination, platform = sys.argv[1:]
spec = Path(source)
types = json.loads((spec.parent / "native-question-types.json").read_text())[platform]
text = spec.read_text()
pattern = r"(    QuestionType:\n      type: string\n      enum: )\[[^\n]+\]"
text, count = re.subn(pattern, lambda m: m[1] + "[" + ", ".join(types) + "]", text)
if count != 1:
    raise SystemExit("QuestionType must have exactly one enum declaration")
# Нативный интерфейс пока не объявляет новые формы; сохраняем сигнатуры API для существующих вызовов.
text = text.replace("        - $ref: '#/components/parameters/TrainingCapabilities'\n", "")
text = text.replace("      parameters:\n      requestBody:", "      requestBody:")
text = text.replace("- name: types\n          in: query\n          required: false", "- name: types\n          in: query\n          required: true")
Path(destination).parent.mkdir(parents=True, exist_ok=True)
Path(destination).write_text(text)
