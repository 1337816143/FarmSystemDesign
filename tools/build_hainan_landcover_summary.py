"""Summarize native ESA WorldCover pixels for an approximate Hainan main-island mask.

The mask is inferred from the product itself at 100 m. This is exploratory
land-cover area, not an administrative land-use statistic or accuracy estimate.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from scipy.ndimage import binary_fill_holes, label


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "hainan" / "source"
OUT = ROOT / "data" / "hainan" / "landcover-main-island-summary.json"
TILES = ("N18E108", "N18E111")
CLASSES = {10: "Tree cover", 20: "Shrubland", 30: "Grassland", 40: "Cropland", 50: "Built-up", 60: "Bare/sparse", 70: "Snow/ice", 80: "Permanent water", 90: "Herbaceous wetland", 95: "Mangroves", 100: "Moss/lichen"}


def row_pixel_areas_km2(height: int, width: int) -> np.ndarray:
    """Ellipsoidal area of a latitude/longitude raster cell, by row."""
    a = 6378137.0
    e2 = 6.6943799901413165e-3
    e = np.sqrt(e2)
    edges = np.deg2rad(21.0 - np.arange(height + 1) * 3.0 / height)
    u = np.sin(edges)
    integral = u / (2 * (1 - e2 * u * u)) + np.arctanh(e * u) / (2 * e)
    return a * a * (1 - e2) * np.deg2rad(3.0 / width) * (integral[:-1] - integral[1:]) / 1e6


def build_island_mask(side: int) -> np.ndarray:
    coarse = []
    for tile in TILES:
        path = SOURCE / f"{tile}.tif"
        with rasterio.open(path) as ds:
            if ds.width != 36000 or ds.height != 36000 or str(ds.crs) != "EPSG:4326" or ds.nodata != 0:
                raise ValueError(f"Unexpected raster geometry: {tile}")
            coarse.append(ds.read(1, out_shape=(side, side), resampling=Resampling.nearest))
    overview = np.concatenate(coarse, axis=1)
    components, count = label((overview != 0) & (overview != 80))
    seed_row, seed_col = int((21.0 - 19.0) * side / 3), int((109.8 - 108.0) * side / 3)
    component = int(components[seed_row, seed_col])
    if not component or count < 2:
        raise ValueError("Main-island seed or separation from mainland failed")
    return binary_fill_holes(components == component)


def mask_area_km2(mask: np.ndarray, side: int) -> float:
    return float((mask.sum(axis=1) * row_pixel_areas_km2(side, side)).sum())


def main() -> None:
    hashes = {tile: hashlib.sha256((SOURCE / f"{tile}.tif").read_bytes()).hexdigest() for tile in TILES}
    mask = build_island_mask(3600)
    mask_100_area = mask_area_km2(mask, 3600)
    mask_200_area = mask_area_km2(build_island_mask(1800), 1800)
    valid_counts = np.zeros(256, dtype=np.int64)
    areas = np.zeros(256, dtype=np.float64)
    masked_nodata = 0
    for tile_index, tile in enumerate(TILES):
        with rasterio.open(SOURCE / f"{tile}.tif") as ds:
            row_area = row_pixel_areas_km2(ds.height, ds.width)
            for _, window in ds.block_windows(1):
                r0, c0 = int(window.row_off), int(window.col_off)
                r = np.arange(r0, r0 + int(window.height)) // 10
                c = tile_index * 3600 + np.arange(c0, c0 + int(window.width)) // 10
                local_mask = mask[np.ix_(r, c)]
                if not local_mask.any():
                    continue
                pixels = ds.read(1, window=window)
                masked_nodata += int(np.count_nonzero(local_mask & (pixels == 0)))
                selected = local_mask & (pixels != 0)
                if not selected.any():
                    continue
                codes = pixels[selected]
                valid_counts += np.bincount(codes, minlength=256)
                weights = np.broadcast_to(row_area[r0:r0 + int(window.height), None], pixels.shape)[selected]
                areas += np.bincount(codes, weights=weights, minlength=256)
    unexpected = [i for i in np.flatnonzero(valid_counts) if i not in CLASSES]
    if unexpected or masked_nodata > 1000000:
        raise ValueError(f"Unexpected classes or nodata: {unexpected}, {masked_nodata}")
    total = float(areas.sum())
    if not 30000 < total < 37000:
        raise ValueError(f"Unexpected island extent: {total:.1f} km2")
    output = {
        "product": "ESA WorldCover 2021 v200",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "attribution": "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
        "citation": "Zanaga et al. (2022). ESA WorldCover 10 m 2021 v200. https://doi.org/10.5281/zenodo.7254221",
        "citation_url": "https://doi.org/10.5281/zenodo.7254221",
        "geography": "Approximate Hainan main island, product-derived mask; excludes separate islands and Sansha",
        "method": "100 m nearest-neighbor overview; four-neighbor connected land component at 19.0 N, 109.8 E; fill enclosed water holes; apply mask to native 10 m classes; ellipsoidal cell areas by latitude",
        "not_for": "Official cultivated-land area, administrative area, field decisions, county statistics or classification accuracy",
        "source_urls": [f"https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif" for tile in TILES],
        "source_sha256": hashes,
        "mask_overview_m": 100,
        "mask_area_100m_km2": round(mask_100_area, 2),
        "mask_area_200m_km2": round(mask_200_area, 2),
        "mask_sampling_difference_percent": round(abs(mask_200_area - mask_100_area) / mask_100_area * 100, 3),
        "masked_nodata_pixels": masked_nodata,
        "total_classified_km2": round(total, 2),
        "classes": [
            {"code": code, "name": name, "pixels": int(valid_counts[code]), "km2": round(float(areas[code]), 2), "percent": round(float(areas[code]) / total * 100, 2)}
            for code, name in CLASSES.items() if valid_counts[code]
        ],
    }
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total_km2": output["total_classified_km2"], "masked_nodata": masked_nodata, "classes": output["classes"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
