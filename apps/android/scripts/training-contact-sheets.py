"""Листы сравнения B: после записи Roborazzi и снимков макетов через Playwright MCP.

python3 apps/android/scripts/training-contact-sheets.py
Результат — apps/android/build/reports/training-b (Pillow, только служебные изображения).
"""
from pathlib import Path
from html import escape
import argparse
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
REPORT = ROOT / "apps/android/build/reports/training-b"
BASELINES = ROOT / "apps/android/app/src/test/snapshots"
MOCKUPS = REPORT / "mockups"
SCREENS = ["r1", "r2", "r3", "r4", "r4-dk", "r5", "r6", "r9", "r14", "r14-list", "r14-timeout", "r15", "r16", "r17", "r19", "r20"]
parser = argparse.ArgumentParser()
parser.add_argument("--new-types", action="store_true", help="Только новые формы R7–R11b")
args = parser.parse_args()
if args.new_types:
    REPORT = REPORT / "new-types"
    MOCKUPS = REPORT / "mockups"
    SCREENS = ["r7", "r7-text", "r7-review", "r8", "r8-correct", "r8-wrong", "r10", "r10-checked", "r11", "r11-bad", "r11-correct", "r11b"]
MOCKUP_SOURCE = {"r7-review": "r7", "r8-correct": "r8", "r8-wrong": "r8", "r10-checked": "r10", "r11-correct": "r11"}
FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 20)
LABEL_HEIGHT = 36
WIDTH = 300
GAP = 16


def picture(path):
    with Image.open(path) as original:
        img = original.convert("RGB")
        return img.resize((WIDTH, round(WIDTH * img.height / img.width)), Image.Resampling.LANCZOS)


def panels(screen, tablet):
    result = []
    for theme in ("dark", "light"):
        device = "desktop" if tablet else "phone"
        source = MOCKUP_SOURCE.get(screen, screen)
        mock = MOCKUPS / f"mock-{source}-{device}-{theme}.png"
        if not mock.exists():
            mock = MOCKUPS / f"mock-{source}-phone-{theme}.png"
        result.append((f"Макет {source.upper()} · {theme}", mock))
        prefix = "tablet-" if tablet else ""
        result.append((f"Android · {theme}", BASELINES / f"{prefix}b-{screen}-{theme}.png"))
        result.append((f"«Крупнее» · {theme}", BASELINES / f"{prefix}b-{screen}-large-{theme}.png"))
    return result


REPORT.mkdir(parents=True, exist_ok=True)
pages = []
for tablet in (False, True):
    for start in range(0, len(SCREENS), 4):
        rows = []
        for screen in SCREENS[start:start + 4]:
            cells = [(label, picture(path)) for label, path in panels(screen, tablet)]
            rows.append((screen, cells, max(img.height for _, img in cells) + LABEL_HEIGHT * 2))
        sheet = Image.new("RGB", (6 * (WIDTH + GAP) + GAP, sum(row[2] for row in rows) + GAP * (len(rows) + 1)), "#e9e7ee")
        draw = ImageDraw.Draw(sheet)
        y = GAP
        for screen, cells, height in rows:
            draw.text((GAP, y), screen.upper(), font=FONT, fill="#181323")
            for index, (label, img) in enumerate(cells):
                x = GAP + index * (WIDTH + GAP)
                draw.text((x, y + LABEL_HEIGHT), label, font=FONT, fill="#181323")
                sheet.paste(img, (x, y + LABEL_HEIGHT * 2))
            y += height + GAP
        name = f"{'tablet' if tablet else 'phone'}-{start // 4 + 1}.png"
        sheet.save(REPORT / name)
        pages.append(name)

# Исходные снимки остаются без изменения: HTML показывает их рядом с макетами в полном разрешении.
rows = []
for tablet in (False, True):
    for screen in SCREENS:
        cells = []
        for label, path in panels(screen, tablet):
            relative = Path(os.path.relpath(path, REPORT))
            cells.append(f'<figure><figcaption>{escape(label)}</figcaption><a href="{relative}"><img src="{relative}" loading="lazy"></a></figure>')
        rows.append(f'<section><h2>{screen.upper()} · {"планшет" if tablet else "телефон"}</h2><div class="row">{"".join(cells)}</div></section>')
(REPORT / "comparison.html").write_text('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Android B — сверка с макетами</title><style>body{font:16px system-ui;background:#e9e7ee;color:#181323;margin:24px}.row{display:flex;gap:16px;overflow:auto}figure{margin:0;flex:0 0 300px}figcaption{margin-bottom:12px}img{width:300px;height:auto}section{margin-bottom:40px}</style><h1>Android B — сверка с макетами</h1>' + ''.join(rows) + '</html>', encoding="utf-8")
print("\n".join(str(REPORT / name) for name in pages))
print(REPORT / "comparison.html")
