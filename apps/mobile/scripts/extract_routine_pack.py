from pathlib import Path
import sys

from PIL import Image


SOURCE = Path(sys.argv[1])
OUTPUT = Path(sys.argv[2])
NAMES = [
    "blocks",
    "toy-basket",
    "toothbrush-a",
    "toothbrush-b",
    "storybook-a",
    "pajamas",
    "storybook-b",
    "bed",
    "wash-hands-a",
    "coat",
    "wash-hands-b",
    "towel",
    "shoes",
    "star-unlit",
    "star-lit",
]

image = Image.open(SOURCE).convert("RGBA")
OUTPUT.mkdir(parents=True, exist_ok=True)
for index, name in enumerate(NAMES):
    column = index % 5
    row = index // 5
    left = round(column * image.width / 5)
    right = round((column + 1) * image.width / 5)
    top = round(row * image.height / 3)
    bottom = round((row + 1) * image.height / 3)
    image.crop((left, top, right, bottom)).save(OUTPUT / f"{name}-v1.png")
