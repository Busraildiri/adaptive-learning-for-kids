from pathlib import Path
import sys

from PIL import Image, ImageDraw


SOURCE = Path(sys.argv[1])
OUTPUT = Path(sys.argv[2])
NAMES = [
    "bear",
    "rabbit",
    "fox",
    "cat",
    "red-balloon",
    "ice-cream",
    "spinning-top",
    "picnic-basket",
    "toothbrush",
    "soap",
    "bed",
    "pajamas",
]

image = Image.open(SOURCE).convert("RGBA")
if image.width != 1024:
    raise ValueError(f"Expected a 1024px-wide sprite sheet, received {image.size}")

OUTPUT.mkdir(parents=True, exist_ok=True)
for index, name in enumerate(NAMES):
    x = (index % 4) * 256
    row = index // 4
    y, bottom = ((0, 265), (265, 420), (420, image.height))[row]
    sprite = image.crop((x, y, x + 256, bottom))
    for seed in ((0, 0), (255, 0), (0, sprite.height - 1), (255, sprite.height - 1)):
        ImageDraw.floodfill(sprite, seed, (255, 255, 255, 0), thresh=28)
    sprite.save(OUTPUT / f"{name}-v1.png")
