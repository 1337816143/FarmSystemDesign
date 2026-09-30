"""Extract historical Hainan Island geometries from geoBoundaries CHN ADM2.

These names and shapes are not current Chinese administrative boundaries and
must never be joined directly to Hainan's current county statistical rows.
"""
from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/hainan/source/CHN-ADM2.zip"
TARGET = ROOT / "data/hainan/county-reference-2017.geojson"
NAMES = {
    "Wenchangxian", "Qiongshanshi", "Haikoushi", "Lingaoxian",
    "Chengmaixian", "Chanzhoushi", "Dinganxian", "Tunchangxian",
    "Changjianglizuzizhixian", "Qionghaishi", "Baishalizuzizhixian",
    "Qiongzhonglizumiaozuzizhixian", "Dongfanglizuzizhixian",
    "Wanningshi", "Ledonglizuzizhixian", "Baotinglizumiaozuzizhixian",
    "Lingshuilizumiaozuzizhixian", "Shanyashi",
}


def main() -> None:
    with zipfile.ZipFile(SOURCE) as archive:
        data = json.loads(archive.read("geoBoundaries-CHN-ADM2_simplified.geojson"))
        metadata = json.loads(archive.read("geoBoundaries-CHN-ADM2-metaData.json"))
    features = [feature for feature in data["features"] if feature["properties"].get("shapeName") in NAMES]
    found = {feature["properties"]["shapeName"] for feature in features}
    if found != NAMES or len(features) != len(NAMES):
        raise ValueError(f"Boundary selection mismatch: missing {NAMES-found}")
    output = {
        "type": "FeatureCollection",
        "properties": {
            "source": "geoBoundaries CHN ADM2 gbOpen",
            "boundaryYearRepresented": metadata["boundaryYear"],
            "sourceDatasetID": metadata["boundaryID"],
            "license": metadata["boundaryLicense"],
            "use": "Historical orientation only; not current administrative units or statistical join keys",
            "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        },
        "features": features,
    }
    TARGET.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(len(features), TARGET.stat().st_size, output["properties"])


if __name__ == "__main__":
    main()
