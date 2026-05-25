"""
ObjectOS icon generator.

Design concept: three stacked, slightly perspective-offset rounded plates
sitting on top of a deep gradient — reads as "stack of objects" at any
size, scales down cleanly to a 16x16 tray icon.

Output: 1024x1024 PNG, suitable for `tauri icon` to fan out to all
platform formats.
"""
from PIL import Image, ImageDraw, ImageFilter

SCALE = 4
SIZE = 1024
S = SIZE * SCALE

bg = Image.new("RGB", (S, S))
top = (29, 16, 84)
mid = (76, 29, 149)
bot = (37, 99, 235)
px = bg.load()
for y in range(S):
    t = y / (S - 1)
    if t < 0.55:
        u = t / 0.55
        r = int(top[0] + (mid[0] - top[0]) * u)
        g = int(top[1] + (mid[1] - top[1]) * u)
        b = int(top[2] + (mid[2] - top[2]) * u)
    else:
        u = (t - 0.55) / 0.45
        r = int(mid[0] + (bot[0] - mid[0]) * u)
        g = int(mid[1] + (bot[1] - mid[1]) * u)
        b = int(mid[2] + (bot[2] - mid[2]) * u)
    for x in range(S):
        px[x, y] = (r, g, b)

RADIUS = int(S * 0.225)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), RADIUS, fill=255)

canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
canvas.paste(bg, (0, 0), mask)

gloss = Image.new("L", (S, S), 0)
ImageDraw.Draw(gloss).ellipse(
    (-int(S * 0.3), -int(S * 0.4), int(S * 0.85), int(S * 0.5)), fill=70
)
gloss = gloss.filter(ImageFilter.GaussianBlur(S * 0.08))
gloss_layer = Image.new("RGBA", (S, S), (255, 255, 255, 0))
gloss_layer.putalpha(gloss)
gloss_layer = Image.composite(gloss_layer, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask)
canvas = Image.alpha_composite(canvas, gloss_layer)

cx, cy = S // 2, int(S * 0.54)
plate_w = int(S * 0.62)
plate_h = int(S * 0.14)
gap = int(S * 0.025)
offset_x = int(S * 0.018)

plates = [
    (-(plate_h + gap), 0.78, 235),
    (0,                0.92, 250),
    ((plate_h + gap),  1.00, 255),
]

def draw_plate(target, dy, scale, alpha, stagger):
    w = int(plate_w * scale)
    h = int(plate_h * scale)
    r = h // 2
    x0 = cx - w // 2 + stagger
    y0 = cy + dy - h // 2
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        (x0, y0 + int(S * 0.012), x0 + w, y0 + h + int(S * 0.012)),
        r, fill=(0, 0, 0, 110),
    )
    sh = sh.filter(ImageFilter.GaussianBlur(S * 0.012))
    target.alpha_composite(sh)
    pl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(pl).rounded_rectangle(
        (x0, y0, x0 + w, y0 + h),
        r, fill=(255, 255, 255, alpha),
    )
    target.alpha_composite(pl)

for i, (dy, scale, alpha) in enumerate(plates):
    stagger = (i - 1) * offset_x
    draw_plate(canvas, dy, scale, alpha, stagger)

clipped = Image.new("RGBA", (S, S), (0, 0, 0, 0))
clipped.paste(canvas, (0, 0), mask)

out = clipped.resize((SIZE, SIZE), Image.LANCZOS)
import os
here = os.path.dirname(__file__)
out_path = os.path.join(here, "icon-1024.png")
out.save(out_path, optimize=True)
print(f"✓ wrote {out_path}")
