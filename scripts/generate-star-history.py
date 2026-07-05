#!/usr/bin/env python3
"""Generate a static Star History PNG for this repository."""

from __future__ import annotations

import datetime as dt
import json
import math
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    print("Pillow is required: python -m pip install pillow", file=sys.stderr)
    raise

REPO = os.environ.get("STAR_HISTORY_REPO", "zereight/gitlab-mcp")
OUT = Path(os.environ.get("STAR_HISTORY_OUT", "assets/star-history.png"))
WIDTH, HEIGHT = 800, 533
MARGIN_L, MARGIN_R, MARGIN_T, MARGIN_B = 86, 36, 58, 76
RED = (246, 83, 64)
INK = (28, 31, 35)
MUTED = (107, 114, 128)
GRID = (226, 232, 240)
BG = (255, 255, 255)


def request_json(url: str):
    req = urllib.request.Request(url)
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/vnd.github.star+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read()), res.headers.get("Link", "")


def next_url(link: str) -> str | None:
    for part in link.split(","):
        if 'rel="next"' in part:
            return part[part.find("<") + 1 : part.find(">")]
    return None


def fetch_stars(repo: str) -> list[dt.datetime]:
    url = f"https://api.github.com/repos/{urllib.parse.quote(repo, safe='/')}/stargazers?per_page=100"
    stars: list[dt.datetime] = []
    while url:
        data, link = request_json(url)
        for row in data:
            starred_at = row.get("starred_at")
            if starred_at:
                stars.append(dt.datetime.fromisoformat(starred_at.replace("Z", "+00:00")))
        url = next_url(link)
    if not stars:
        raise SystemExit(f"No stargazer timestamps returned for {repo}")
    return sorted(stars)


def font(size: int, bold: bool = False):
    names = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]
    for name in names:
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


def nice_max(value: int) -> int:
    if value <= 0:
        return 1
    exp = 10 ** math.floor(math.log10(value))
    for step in (1, 2, 5, 10):
        top = step * exp
        if top >= value:
            return top
    return 10 * exp


def draw(stars: list[dt.datetime]) -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    d = ImageDraw.Draw(img)
    f_title, f_label, f_tick, f_small = font(26, True), font(17), font(13), font(15)

    start = dt.datetime(stars[0].year, 1, 1, tzinfo=dt.timezone.utc)
    end = max(stars[-1], dt.datetime.now(dt.timezone.utc))
    max_stars = nice_max(len(stars))
    plot_w, plot_h = WIDTH - MARGIN_L - MARGIN_R, HEIGHT - MARGIN_T - MARGIN_B

    def x(t: dt.datetime) -> float:
        span = max((end - start).total_seconds(), 1)
        return MARGIN_L + ((t - start).total_seconds() / span) * plot_w

    def y(count: int) -> float:
        return MARGIN_T + plot_h - (count / max_stars) * plot_h

    # Grid + axes.
    for i in range(6):
        val = round(max_stars * i / 5)
        yy = y(val)
        d.line((MARGIN_L, yy, WIDTH - MARGIN_R, yy), fill=GRID, width=1)
        label = f"{val // 1000}K" if val >= 1000 and val % 1000 == 0 else str(val)
        bbox = d.textbbox((0, 0), label, font=f_tick)
        d.text((MARGIN_L - 12 - (bbox[2] - bbox[0]), yy - 8), label, fill=MUTED, font=f_tick)
    d.line((MARGIN_L, MARGIN_T, MARGIN_L, HEIGHT - MARGIN_B), fill=INK, width=2)
    d.line((MARGIN_L, HEIGHT - MARGIN_B, WIDTH - MARGIN_R, HEIGHT - MARGIN_B), fill=INK, width=2)

    first_year = start.year
    last_year = end.year
    tick_step = max(1, math.ceil((last_year - first_year + 1) / 6))
    for year in range(first_year, last_year + 1, tick_step):
        t = dt.datetime(year, 1, 1, tzinfo=dt.timezone.utc)
        if start <= t <= end:
            xx = x(t)
            d.line((xx, HEIGHT - MARGIN_B, xx, HEIGHT - MARGIN_B + 5), fill=INK, width=1)
            d.text((xx - 15, HEIGHT - MARGIN_B + 12), str(year), fill=MUTED, font=f_tick)

    points = [(x(start), y(0)), *[(x(t), y(i + 1)) for i, t in enumerate(stars)]]
    if len(points) == 1:
        d.ellipse((points[0][0] - 4, points[0][1] - 4, points[0][0] + 4, points[0][1] + 4), fill=RED)
    else:
        d.line(points, fill=RED, width=4, joint="curve")
        d.ellipse((points[-1][0] - 5, points[-1][1] - 5, points[-1][0] + 5, points[-1][1] + 5), fill=RED)

    # Title, labels, legend.
    title = "Star History"
    bbox = d.textbbox((0, 0), title, font=f_title)
    d.text(((WIDTH - (bbox[2] - bbox[0])) / 2, 18), title, fill=INK, font=f_title)
    d.text((WIDTH / 2 - 18, HEIGHT - 34), "Date", fill=INK, font=f_label)

    legend = f"{REPO}  •  {len(stars):,} stars"
    d.rounded_rectangle((MARGIN_L, MARGIN_T + 10, MARGIN_L + 320, MARGIN_T + 46), radius=8, outline=GRID, fill=(255, 255, 255))
    d.ellipse((MARGIN_L + 14, MARGIN_T + 23, MARGIN_L + 24, MARGIN_T + 33), fill=RED)
    d.text((MARGIN_L + 34, MARGIN_T + 18), legend, fill=INK, font=f_small)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    print(f"wrote {OUT} from {len(stars)} stargazers")


if __name__ == "__main__":
    draw(fetch_stars(REPO))
