from pathlib import Path
import sys

from PIL import Image


source = Image.open(sys.argv[1]).convert("RGBA")
output = Path(sys.argv[2])
output.mkdir(parents=True, exist_ok=True)

pixels = source.load()
for y in range(source.height):
    for x in range(source.width):
        red, green, blue, _ = pixels[x, y]
        if max(red, green, blue) - min(red, green, blue) <= 4 and min(red, green, blue) >= 232:
            pixels[x, y] = (red, green, blue, 0)

for index, name in enumerate(("sad-bear", "happy-rabbit", "angry-fox")):
    cell_left = round(index * source.width / 3)
    cell_right = round((index + 1) * source.width / 3)
    left = cell_left + (0 if index == 0 else 30)
    right = cell_right - (0 if index == 2 else 30)
    source.crop((left, 0, right, source.height)).save(output / f"{name}-v1.png")
