from pathlib import Path
import sys
from collections import deque

from PIL import Image


source = Image.open(sys.argv[1]).convert("RGBA")

def is_background(x: int, y: int) -> bool:
    red, green, blue, _ = source.getpixel((x, y))
    return max(red, green, blue) - min(red, green, blue) <= 9 and min(red, green, blue) >= 220

queue = deque()
visited = set()
for x in range(source.width):
    queue.extend(((x, 0), (x, source.height - 1)))
for y in range(source.height):
    queue.extend(((0, y), (source.width - 1, y)))

while queue:
    x, y = queue.popleft()
    if (x, y) in visited or not is_background(x, y):
        continue
    visited.add((x, y))
    source.putpixel((x, y), (*source.getpixel((x, y))[:3], 0))
    if x > 0:
        queue.append((x - 1, y))
    if x + 1 < source.width:
        queue.append((x + 1, y))
    if y > 0:
        queue.append((x, y - 1))
    if y + 1 < source.height:
        queue.append((x, y + 1))

destination = Path(sys.argv[2])
destination.parent.mkdir(parents=True, exist_ok=True)
source.save(destination)
