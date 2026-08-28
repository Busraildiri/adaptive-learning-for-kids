from collections import deque
from pathlib import Path
import sys

from PIL import Image


source = Image.open(sys.argv[1]).convert("RGBA")
output = Path(sys.argv[2])
output.mkdir(parents=True, exist_ok=True)
names = ("red", "blue", "green", "yellow", "orange", "purple", "pink", "cyan")
cell_width = source.width // 4
cell_height = source.height // 3

for index, name in enumerate(names):
    column, row = index % 4, index // 4
    sprite = source.crop((column * cell_width, row * cell_height, (column + 1) * cell_width, (row + 1) * cell_height))
    queue = deque([(x, 0) for x in range(sprite.width)] + [(x, sprite.height - 1) for x in range(sprite.width)] + [(0, y) for y in range(sprite.height)] + [(sprite.width - 1, y) for y in range(sprite.height)])
    visited = set()
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        red, green, blue, _ = sprite.getpixel((x, y))
        if min(red, green, blue) < 235 or max(red, green, blue) - min(red, green, blue) > 12:
            continue
        visited.add((x, y))
        sprite.putpixel((x, y), (red, green, blue, 0))
        for point in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= point[0] < sprite.width and 0 <= point[1] < sprite.height:
                queue.append(point)
    sprite.save(output / f"balloon-{name}-v1.png")
