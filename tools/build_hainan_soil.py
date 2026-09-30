"""Render static, inspectable SoilGrids 0–5 cm pH and SOC layers from WCS.

Run after downloading the WCS coverage described in docs/Hainan_DATA_SOURCE_AUDIT.md.
Value PNGs store original SoilGrids integer units, with metadata per property.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/hainan/source/phh2o-0-5cm.tif"
OUT = ROOT / "data/hainan"
COLORS = [
    (45, (161, 62, 52)),
    (50, (204, 103, 64)),
    (55, (229, 156, 81)),
    (60, (225, 193, 107)),
    (65, (160, 188, 124)),
    (75, (83, 151, 121)),
]


def main() -> None:
    with rasterio.open(SOURCE) as dataset:
        if dataset.crs.to_epsg() != 4326 or dataset.count != 1:
            raise ValueError("Unexpected SoilGrids WCS raster geometry")
        values = dataset.read(1)
        valid = values > 0  # WCS returns zero for sea/no coverage in this AOI.
        if not np.any(valid):
            raise ValueError("No valid soil predictions")
        if values.max() > 255 or values.min() < 0:
            raise ValueError("Value PNG requires byte-range source")
        rgba = np.zeros((dataset.height, dataset.width, 4), dtype=np.uint8)
        previous = 0
        for upper, rgb in COLORS:
            mask = valid & (values > previous) & (values <= upper)
            rgba[mask, :3] = rgb
            previous = upper
        rgba[valid, 3] = 215
        Image.fromarray(rgba, "RGBA").save(OUT / "soil-ph-preview.png", optimize=True)
        Image.fromarray(values.astype(np.uint8), "L").save(OUT / "soil-ph-values.png", optimize=True)
        source_bytes = SOURCE.read_bytes()
        record = {
            "dataset": "ISRIC SoilGrids 2.0 phh2o_0-5cm_mean",
            "identity": "model prediction, not a field measurement",
            "source": "https://maps.isric.org/mapserv?map=/map/phh2o.map",
            "access": "WCS 2.0.1 GetCoverage; X(108.5,111.5), Y(17.8,20.5), EPSG:4326",
            "documentation": "https://docs.isric.org/globaldata/soilgrids/",
            "license": "CC BY 4.0",
            "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
            "bounds_wsen": [dataset.bounds.left, dataset.bounds.bottom, dataset.bounds.right, dataset.bounds.top],
            "width": dataset.width,
            "height": dataset.height,
            "native_resolution": "250 m in native SoilGrids product; returned WCS grid is ~0.00226 degrees",
            "value_encoding": "PNG grayscale value / 10 = pH (H2O); 0 = no prediction",
            "valid_cells": int(valid.sum()),
            "minimum_ph": round(float(values[valid].min()) / 10, 1),
            "maximum_ph": round(float(values[valid].max()) / 10, 1),
        }
        (OUT / "soil-ph-metadata.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(record)

    soc_source = ROOT / "data/hainan/source/soc-0-5cm.tif"
    with rasterio.open(soc_source) as dataset:
        soc = dataset.read(1)
        valid = soc > 0
        if dataset.crs.to_epsg() != 4326 or dataset.count != 1 or soc.max() > 65535 or not np.any(valid):
            raise ValueError("Unexpected SoilGrids SOC raster")
        stops = [(100, (247, 234, 179)), (200, (220, 210, 130)),
                 (300, (174, 192, 115)), (400, (119, 167, 114)),
                 (500, (68, 137, 114)), (650, (33, 109, 112)),
                 (800, (28, 80, 112)), (65535, (37, 57, 91))]
        rgba = np.zeros((dataset.height, dataset.width, 4), dtype=np.uint8)
        previous = 0
        for upper, rgb in stops:
            mask = valid & (soc > previous) & (soc <= upper)
            rgba[mask, :3] = rgb
            previous = upper
        rgba[valid, 3] = 215
        Image.fromarray(rgba, "RGBA").save(OUT / "soil-soc-preview.png", optimize=True)
        encoded = np.zeros((dataset.height, dataset.width, 3), dtype=np.uint8)
        encoded[:, :, 0] = (soc % 256).astype(np.uint8)
        encoded[:, :, 1] = (soc // 256).astype(np.uint8)
        Image.fromarray(encoded, "RGB").save(OUT / "soil-soc-values.png", optimize=True)
        record = {
            "dataset": "ISRIC SoilGrids 2.0 soc_0-5cm_mean",
            "identity": "model prediction, not a field measurement",
            "source": "https://maps.isric.org/mapserv?map=/map/soc.map",
            "access": "WCS 2.0.1 GetCoverage; X(108.5,111.5), Y(17.8,20.5), EPSG:4326",
            "documentation": "https://docs.isric.org/globaldata/soilgrids/",
            "license": "CC BY 4.0",
            "source_sha256": hashlib.sha256(soc_source.read_bytes()).hexdigest(),
            "bounds_wsen": [dataset.bounds.left, dataset.bounds.bottom, dataset.bounds.right, dataset.bounds.top],
            "width": dataset.width, "height": dataset.height,
            "native_resolution": "250 m in native SoilGrids product; returned WCS grid is ~0.00226 degrees",
            "value_encoding": "PNG red + 256 * green, divided by 10 = SOC g/kg; 0 = no prediction",
            "valid_cells": int(valid.sum()),
            "minimum_g_kg": round(float(soc[valid].min()) / 10, 1),
            "maximum_g_kg": round(float(soc[valid].max()) / 10, 1),
        }
        (OUT / "soil-soc-metadata.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(record)


if __name__ == "__main__":
    main()
