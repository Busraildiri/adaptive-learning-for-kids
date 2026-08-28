from pathlib import Path
import sys

from PIL import Image


source = Image.open(sys.argv[1]).convert("RGBA")
output = Path(sys.argv[2])
output.mkdir(parents=True, exist_ok=True)
names = ("red", "blue", "yellow", "teal", "green", "purple", "pink", "orange")
cell_width = source.width // 4
cell_height = source.height // 2

for index, name in enumerate(names):
    column = index % 4
    row = index // 4
    left = column * cell_width
    top = row * cell_height
    sprite = source.crop((left, top, left + cell_width, top + cell_height))
    sprite.save(output / f"fish-{name}-v1.png")
