"""Build art/levelData.json from the original level picture and crash line.

The new art draws the ground from the crash line itself (so what you see is
exactly what you hit). This script works out, once, what that ground is made
of: where the lakes, grass, snow and sand are, which bumps in the crash line
are rock outcrops or palm trees, and the named zones used by the HUD.

Run from the project root:  python tools/build_level_data.py
Needs Pillow (pip install pillow).
"""
import bisect
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LAND = ROOT / 'images' / 'land.png'
CRASH = ROOT / 'imageCollisionData' / 'landscapeCollisionData.json'
OUT = ROOT / 'art' / 'levelData.json'

CRASH_OFFSET_Y = 270  # canvas y = json y + 270 (see CollisionDetection)
LAND_TOP = 590  # the land picture is drawn at canvas y 590
WATER_Y = 639 + CRASH_OFFSET_Y  # crash line height on the lakes (909)
STEP = 8


def load_crash():
    pts = json.loads(CRASH.read_text())
    # the first and last points close the shape along the bottom; skip them
    line = sorted({(p['x'], p['y'] + CRASH_OFFSET_Y) for p in pts if p['y'] < 815})
    xs = [p[0] for p in line]

    def at(x):
        i = bisect.bisect_left(xs, x)
        if i <= 0:
            return line[0][1]
        if i >= len(line):
            return line[-1][1]
        (x0, y0), (x1, y1) = line[i - 1], line[i]
        return y0 + (y1 - y0) * (x - x0) / max(1, x1 - x0)

    return line, at


def surface_material(px, width, height):
    """What the original picture shows at the top of the ground, per column."""
    out = {}
    for x in range(0, width, STEP):
        mat = None
        for y in range(height):
            if px[x, y][3] > 128:
                r, g, b, _ = px[x, min(height - 1, y + 6)]
                if g > 150 and r < 150 and b < 120:
                    mat = 'grass'
                elif r > 200 and g > 200 and b > 200:
                    mat = 'snow'
                elif r > 180 and g > 140 and b < 120:
                    mat = 'sand'
                elif abs(r - g) < 25 and abs(g - b) < 25:
                    mat = 'rock'
                else:
                    mat = 'other'
                break
        out[x] = mat
    return out


def runs(xs, keep, min_len=0, join_gap=0):
    """Contiguous [x0, x1] ranges of sampled x where keep(x) is true."""
    found = []
    for x in xs:
        if keep(x):
            if found and x - found[-1][1] <= STEP + join_gap:
                found[-1][1] = x
            else:
                found.append([x, x])
    return [r for r in found if r[1] - r[0] >= min_len]


def main():
    img = Image.open(LAND).convert('RGBA')
    px, width, height = img.load(), img.size[0], img.size[1]
    line, crash_at = load_crash()
    xs = list(range(0, min(width, line[-1][0]), STEP))
    mats = surface_material(px, width, height)

    lakes = runs(xs, lambda x: abs(crash_at(x) - WATER_Y) <= 3, min_len=60, join_gap=40)

    # the ground type of each stretch, ignoring rocks, trees and the sign
    def base(x):
        counts = {}
        for dx in range(-480, 481, STEP * 2):
            m = mats.get(x + dx - (x + dx) % STEP)
            if m in ('grass', 'snow', 'sand'):
                counts[m] = counts.get(m, 0) + 1
        return max(counts, key=counts.get) if counts else 'grass'

    biomes = []
    for x in xs:
        b = base(x)
        if biomes and biomes[-1][2] == b:
            biomes[-1][1] = x + STEP
        else:
            biomes.append([x, x + STEP, b])
    biomes = [r for r in biomes if r[1] - r[0] >= 160] or biomes

    # rock outcrops: the crash line runs over grey rock in the picture
    rocks = runs(xs, lambda x: mats.get(x) == 'rock', min_len=24, join_gap=24)

    # palm trees, found by colour: dark-green fronds and brown trunks. The
    # crash line traces their canopies, so each new palm is drawn at least as
    # tall and as wide as the crash line there (never crash into empty air).
    def is_frond(c):
        r, g, b, a = c
        return a > 128 and g > r + 15 and g > b + 30 and g < 200

    def is_trunk(c):
        r, g, b, a = c
        return a > 128 and 110 < r < 200 and 60 < g < 130 and b < 80 and r > g + 25

    frond_cols, trunk_cols = [], []
    for x in range(0, width, 2):
        if base(x - x % STEP) != 'sand':
            continue
        col = [px[x, y] for y in range(height)]
        greens = [y for y, c in enumerate(col) if is_frond(c)]
        if len(greens) > 3:
            frond_cols.append((x, min(greens)))
        run = best = 0
        for c in col:
            run = run + 1 if is_trunk(c) else 0
            best = max(best, run)
        if best >= 50:
            trunk_cols.append(x)

    trunks = []
    for x in trunk_cols:
        if trunks and x - trunks[-1][-1] <= 6:
            trunks[-1].append(x)
        else:
            trunks.append([x])
    trunk_xs = [sum(t) / len(t) for t in trunks if len(t) >= 3]

    palms = []
    for i, tx in enumerate(trunk_xs):
        left = (trunk_xs[i - 1] + tx) / 2 if i > 0 and tx - trunk_xs[i - 1] < 400 else tx - 220
        right = (tx + trunk_xs[i + 1]) / 2 if i + 1 < len(trunk_xs) and trunk_xs[i + 1] - tx < 400 else tx + 220
        cols = [(x, y) for x, y in frond_cols if left <= x <= right]
        if not cols:
            continue
        x0, x1 = min(c[0] for c in cols), max(c[0] for c in cols)
        top_img = min(c[1] for c in cols) + LAND_TOP
        top_crash = min(crash_at(x) for x in range(int(x0), int(x1) + 1, 2))
        # the sand surface just beside the trunk, read from the picture
        def sand_top(x):
            for y in range(height):
                r, g, b, a = px[x, y]
                if a > 128 and r > 180 and g > 140 and b < 120:
                    return y
            return height
        ground = min(sand_top(int(tx) + dx) for dx in (-16, 16)) + LAND_TOP
        palms.append({
            'x': round(tx),
            'ground': round(ground),
            'top': round(min(top_img, top_crash) - 6),
            'left': round(tx - x0 + 10),
            'right': round(x1 - tx + 10),
        })

    # rocks sitting in a lake are below the waterline: the crash line ignores them
    rocks = [r for r in rocks if not any(a <= r[0] and r[1] <= b for a, b in lakes)]

    # the old "The End" sign: the crash line runs along the top of its board
    # (the highest flat run after the beach), reached by a slope from the hill
    end_pts = [p for p in line if p[0] > 17000]
    top = min(y for x, y in end_pts)
    board = [p for p in end_pts if p[1] - top <= 4]
    board = [p for p in board if p[0] - board[0][0] < 400]
    ramp = max(p for p in end_pts if p[0] < board[0][0])

    def hill_top(x):
        # the grass below the board in the picture
        for y in range(int(top - LAND_TOP) + 60, height):
            r, g, b, a = px[x, y]
            if a > 128 and g > 150 and r < 150 and b < 120:
                return y + LAND_TOP
        return height + LAND_TOP

    finish = {
        'rampX': ramp[0],
        'x0': board[0][0],
        'x1': board[-1][0],
        'top': top,
        'hill': [[board[0][0] + 24, hill_top(board[0][0] + 24)], [board[-1][0] - 24, hill_top(board[-1][0] - 24)]],
    }

    sand_end = max(b for a, b, k in biomes if k == 'sand')
    zones = [
        ('Sunny Meadows', 0, lakes[0][0], 'meadow'),
        ('Splash Lake', lakes[0][0], lakes[0][1], 'lake'),
        ('Rocky Hills', lakes[0][1], lakes[1][0], 'meadow'),
        ('Shark Bay', lakes[1][0], lakes[1][1], 'lake'),
        ('Frosty Peaks', lakes[1][1], lakes[2][0], 'snow'),
        ('Laser Lagoon', lakes[2][0], lakes[2][1], 'lake'),
        ('Moai Beach', lakes[2][1], sand_end, 'beach'),
        ('Finish Fields', sand_end, width, 'finish'),
    ]

    data = {
        'about': 'Generated by tools/build_level_data.py from images/land.png '
        'and imageCollisionData/landscapeCollisionData.json. Land x '
        'coordinates; y values are canvas y.',
        'waterY': WATER_Y,
        'winOffset': 16700,
        'finish': finish,
        'lakes': lakes,
        'biomes': biomes,
        'rocks': rocks,
        'palms': palms,
        'zones': [{'name': n, 'x0': a, 'x1': b, 'kind': k} for n, a, b, k in zones],
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1))
    print(f'wrote {OUT.relative_to(ROOT)}')
    print(' lakes ', lakes)
    print(' biomes', biomes)
    print(' rocks ', rocks)
    print(' palms ', palms)


if __name__ == '__main__':
    main()
