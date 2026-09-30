"""Acquire reproducible Hainan map previews from first-party WMS services.

These PNGs are cartographic previews, never analysis rasters or county statistics.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import requests
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "hainan"
BOUNDS = [108.5, 17.8, 111.5, 20.5]  # west, south, east, north
SIZE = [1200, 1080]
SOURCES = {
    "landcover": {
        "url": "https://titiler.terrascope.be/wms",
        "params": {
            "SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap",
            "LAYERS": "esa-worldcover-map-10m-2021-v2_map", "STYLES": "",
            "CRS": "EPSG:4326", "BBOX": "17.8,108.5,20.5,111.5",
            "WIDTH": SIZE[0], "HEIGHT": SIZE[1], "FORMAT": "image/png",
            "TRANSPARENT": "TRUE", "TIME": "2021-01-01",
        },
        "reference": "https://esa-worldcover.org/en/data-access",
        "description": "ESA WorldCover 2021 v200 classified cover; WMS-rendered preview",
        "native_resolution": "10 m",
        "kind": "classified-model-product",
        "attribution": "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
    },
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"bounds_wsen": BOUNDS, "preview_size_px": SIZE, "layers": {}}
    for key, spec in SOURCES.items():
        response = requests.get(spec["url"], params=spec["params"], timeout=90)
        response.raise_for_status()
        if not response.headers.get("content-type", "").startswith("image/png"):
            raise ValueError(f"{key}: unexpected content type {response.headers.get('content-type')}")
        target = OUT / f"{key}-preview.png"
        target.write_bytes(response.content)
        with Image.open(target) as image:
            if image.size != tuple(SIZE) or image.getbbox() is None:
                raise ValueError(f"{key}: empty or wrongly sized image")
        manifest["layers"][key] = {
            "file": target.name,
            "request_url": response.url,
            "sha256": hashlib.sha256(response.content).hexdigest(),
            **{k: v for k, v in spec.items() if k not in ("url", "params")},
        }
        print(key, len(response.content), manifest["layers"][key]["sha256"][:12])
    (OUT / "atlas-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
