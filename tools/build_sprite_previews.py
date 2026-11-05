"""Validate generated sheet cells and build GIFs from the actual drawn frames."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageChops

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'img/characters/sprites'
roster = json.loads((ROOT / 'img/characters/roster.json').read_text(encoding='utf-8'))
manifest = json.loads((BASE / 'manifest.json').read_text(encoding='utf-8'))
font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 19)
sheets = [Image.open(ROOT / c['sheet']).convert('RGBA') for c in roster]


def frame(sheet, col, row):
    return sheet.crop((col * 256, row * 256, (col + 1) * 256, (row + 1) * 256))


for character, sheet, meta in zip(roster, sheets, manifest):
    assert sheet.size == (1024, 1536), character['name']
    assert character['sheet'] == meta['sheet']
    assert sheet.getchannel('A').getextrema()[0] == 0
    for row in range(6):
        for col in range(4):
            alpha = frame(sheet, col, row).getchannel('A')
            assert alpha.point(lambda v: 255 if v > 128 else 0).getbbox(), (character['name'], col, row)
    for row in (1, 3, 5):
        # Composite before comparison so invisible RGB never counts as a pose change.
        poses = []
        for col in (0, 2):
            pose = Image.new('RGBA', (256, 256), '#29243b')
            pose.alpha_composite(frame(sheet, col, row))
            poses.append(pose.convert('RGB'))
        assert ImageChops.difference(*poses).getbbox(), (character['name'], row)

for state, row in [('idle', 0), ('attack', 1), ('hit', 2), ('guard', 3), ('heal', 4), ('down', 5)]:
    frames = []
    for col in range(4):
        grid = Image.new('RGB', (960, 1040), '#141321')
        draw = ImageDraw.Draw(grid)
        for i, (character, sheet) in enumerate(zip(roster, sheets)):
            x, y = (i % 4) * 240, (i // 4) * 260
            draw.rounded_rectangle((x + 5, y + 5, x + 235, y + 255), radius=10, fill='#29243b')
            sprite = ImageOps.contain(frame(sheet, col, row), (220, 220))
            grid.paste(sprite, (x + 10, y + 12), sprite)
            label = f"{i + 1}. {character['name']}"
            width = draw.textbbox((0, 0), label, font=font)[2]
            draw.text((x + (240 - width) / 2, y + 230), label, font=font, fill='white')
        frames.append(grid)
    durations = [450, 450, 140, 560] if state == 'idle' else [140, 120, 140, 350]
    frames[0].save(BASE / f'preview-{state}.gif', save_all=True, append_images=frames[1:],
                   duration=durations, loop=0, disposal=2)

print('Validated 16 sheets / 384 visible frames and distinct attack, guard and KO drawings.')
print('Built animated GIF previews for all six actions from the actual sheet pixels.')
