from pathlib import Path
import sys
from PIL import Image

source = Image.open(sys.argv[1]).convert("RGBA")
output = Path(sys.argv[2])
output.mkdir(parents=True, exist_ok=True)
for index, name in enumerate(("clap", "bell", "drum")):
    left = round(index * source.width / 3)
    right = round((index + 1) * source.width / 3)
    source.crop((left, 0, right, source.height)).save(output / f"rhythm-{name}-v1.png")
