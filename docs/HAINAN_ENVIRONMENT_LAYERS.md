# Hainan environmental raster recovery, cloud build 2026-10-03

## Result and integration

This directory contains actual derived environmental raster pixels, not just a dataset index. All acquisition, processing, and testing ran on the dot cloud computer. No user desktop was used and no account, key, paid service, or new package installation was needed.

Copy `assets/` to the site's `data/hainan/regional/environment/`. Load `environment-manifest.json`. The deployed bundle is about **18.7 MB**, including 50 raster-window records and their metadata, PNG previews/value rasters, 46 numeric GeoTIFFs, three source-family manifests, and checksums. Four redundant DSM overview TIFFs are omitted to stay under 20 MB; their numeric value PNGs remain available. Source-cache files and input copies are not deployed.

The manifest has `layers.dsm`, `layers.rain`, `layers.soilPh`, and `layers.soilSoc`. Each has:

- `groups`: geographic group previews (soil has main only; offshore soil has named audits only)
- `previews`: group and named-window assets, with `file`, `values_file`, `bbox`, dimensions, EPSG, coverage counts, decode settings, status, source-metadata file, and where available `native_window_geotiff`
- `assets`: 57 original public DSM COG records with HTTPS URL, native bounding box, EPSG, resolution, nodata, scale, and offset; other layers use self-hosted materialized windows
- Source attribution, licence, date/period, and coverage limitations

All PNGs are **geographic EPSG:4326 rasters**. Project each display tile's Web-Mercator target pixels back into the geographic PNG grid. Do not stretch a whole broad geographic image as a simple Web-Mercator `imageOverlay` if pixel alignment matters. Value lookup uses the recorded actual `bbox` and source PNG dimensions, not the requested AOI bbox.

For value PNGs: alpha zero means unavailable. Otherwise, decode `(red + 256 * green) * decode.scale + decode.offset`. Values are DSM metres, annual rainfall millimetres, pH units, or SOC g/kg. DSM display/query PNGs quantize height to the nearest metre; native-window Float32 GeoTIFFs retain original source elevations. Rainfall PNGs quantize to 0.1 mm; GeoTIFFs retain Float32 source values. Soil values preserve native integer encoding and have GeoTIFF scale 0.1 and units. No interpolation fills ocean gaps.

## Products

### Copernicus DEM GLO-30

- **57 actual source tiles** intersect the four geographic query envelopes, with all 57 overview rasters read and processed. This number differs from prior unmaterialized inventories; use this rebuilt catalog.
- Four continuous geographic overview mosaics: main, Xisha, Zhongsha, Nansha. Main/Xisha/Zhongsha display grid is 8 arcseconds (about 247 m north–south). Nansha display grid is 32 arcseconds (about 989 m north–south).
- Ten named-window numeric GeoTIFFs and value PNGs on the original half-pixel-offset **1 arcsecond (~30 m)** cell-edge lattice. Native source pixels are sampled without smoothing in these windows.
- Source is a **digital surface model**, including vegetation and buildings, with TanDEM-X acquisitions mainly 2011–2015 and potentially older infill. The 2021 STAC date is catalog publication, not acquisition. It is not present-day bare-earth terrain.
- Source zeros are numerically retained and counted separately. The display makes source zero transparent. Missing source tiles are nodata. Zero-only offshore windows are explicitly unresolved; they are not verified terrain at elevation zero.
- Yongxing has historical nonzero surface values. Yongshu has no intersecting source tile. Zhubi and Huangyan named windows have only source zeros and are flagged `unresolved-source-zero-surface`.
- Direct S3 browser CORS has not been established; original source URLs are for documented retrieval/native window processing. Use materialized same-origin outputs for reliable browser delivery.

Sources: [public AWS product/readme](https://copernicus-dem-30m.s3.amazonaws.com/readme.html), [collection and licence information](https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model), [Earth Search catalog](https://earth-search.aws.element84.com/v1/collections/cop-dem-glo-30)

Attribution: © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. Copernicus DEM free licence applies.

### CHIRPS v3 annual rainfall, 2025

- Actual final annual 2025 Float32 source raster, directory/file publication 2026-03-06. This is the latest completed calendar year as of 2026-10-03; no completed 2026 annual layer is claimed.
- Four geographic groups plus ten named windows, at the source **0.05° (~5.5 km)** grid. A single coarse raster cell is not an island-specific or parcel rainfall measurement.
- Source has no GDAL nodata tag, but the observed fill value is -9999. That fill is explicitly masked; true zero rainfall remains valid.
- Xisha broad group and Yongxing/Yongshu/Zhubi named windows have no valid rainfall cells. Huangyan has 15 valid cells out of a 25-cell sample window, but remains `coarse-context-only`. Xidao's single valid cell is also coarse context, not isolated island rainfall.
- Large Nansha geographic windows include land outside the intended administrative scope. Pixel coverage and means are not statistics for Hainan Province.

Sources: [CHIRPS v3 documentation](https://chc.ucsb.edu/data/chirps3), [annual source directory](https://data.chc.ucsb.edu/products/CHIRPS/v3.0/annual/global/tifs/), [actual 2025 source](https://data.chc.ucsb.edu/products/CHIRPS/v3.0/annual/global/tifs/chirps-v3.0.2025.tif), [data DOI](https://doi.org/10.15780/G2JQ0P)

Attribution: Climate Hazards Center, CHIRPS3. Official terms state CC-BY-4.0 and additionally a public-domain waiver. Attribution is retained. This is precipitation only, not temperature, evapotranspiration, or a full climatic suitability model.

### SoilGrids 2.0 surface pH and organic carbon

- Two real modelled 0–5 cm mean soil products, nominal source **250 m**, CC-BY-4.0.
- Main raster recovered from the historical authoritative value PNGs already in the cloud-restored project, with original WCS provenance preserved. Six main/nearshore named samples are derived from that grid. Original source-file hashes in historical metadata are preserved as provenance; the raw old WCS files are not available for an independent checksum recheck. Restored input-file checksums are in `source-acquisition.json`.
- Four offshore named windows per property fetched afresh from public WCS on 2026-10-03: Yongxing, Yongshu, Zhubi, Huangyan. All eight actual returned rasters were all-zero/no-prediction. These records, transparent previews, exact raster bounds, and counts are retained rather than filled with neighbouring values.
- These eight fresh audits do **not** establish full offshore soil coverage. Broad Xisha/Zhongsha/Nansha soil surfaces were not manufactured from four samples.
- The source is a spatial prediction, not a 2025/2026 soil survey or a replacement for soil testing. The exact dynamic underlying revision is not asserted; version family and access/recovery provenance are stated.

Sources: [SoilGrids access and licence](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html), [pH WCS](https://maps.isric.org/mapserv?map=/map/phh2o.map), [SOC WCS](https://maps.isric.org/mapserv?map=/map/soc.map). Each fresh request's complete public URL and source checksum are in its individual metadata.

Attribution: ISRIC — World Soil Information; SoilGrids 2.0.

## Scope and coverage meanings

The common AOI inventory contains four geographic query envelopes and ten named sample windows. It explicitly is not an administrative boundary, exhaustive island/reef inventory, land mask, or territorial claim. The envelopes may include ocean and other jurisdictions. Consequently:

- `valid_cells` is actual finite supported grid data within a specific rectangular raster, including any source ocean zeros
- `nodata_cells` is actual missing model/source coverage or no source tile
- DSM `positive_surface_cells` and `zero_height_cells` expose the distinction between readable grid and resolved surface, without asserting a coastline
- `cloud_cells: null` means **not applicable**, because these environmental products do not have a cloud class; it does not mean observed zero clouds
- A raster's minimum/maximum/mean is a statistic of this output window, not a verified province/municipality land statistic; coarse overview maxima are not true maximum elevations
- Source resolution, output display resolution, and value quantization are separate metadata fields

## Reproduce and test

Use the preinstalled system Python containing GDAL, NumPy and Pillow:

```
/usr/bin/python3 tools/build_hainan_environment.py all
/usr/bin/python3 tools/compact_hainan_environment.py
/usr/bin/python3 tests/hainan_environment.py
```

Optional separate stages are `rain`, `soil`, and `dsm`. Public source caches are reused when present. For a deliberate later refresh, move the cache aside before rebuilding and review updated source dates/licences; same URLs can change upstream. `input/soil-history/` makes the historical main-soil recovery reproducible without another checkout. The scripts only write in this directory.

Five test cases validate all 50 records: existence and hashes; <20 MB deployed bytes; PNG/GeoTIFF dimensions and validity; physical decode equivalence/quantization; nominal resolutions and exact native DSM grid alignment; missing/zero-only/offshore semantics. Final result: **PASS, 5 tests**, with 50 per-raster subchecks. `test-results.txt` holds the run. `visual-qa.png` records a visual check of actual DSM, rainfall, pH, and SOC rasters; it is not deployed.

### Copying the scripts into repository tools/tests

The scripts may be copied directly into repo `tools/` and the test into repo `tests/`; when their locations change, **set both directory variables** so they do not default to a repository-level `assets/` folder:

```
export HAINAN_ENV_WORKDIR="$PWD/data-pipeline/environment"
export HAINAN_ENV_ASSET_DIR="$PWD/data/hainan/regional/environment"
/usr/bin/python3 tools/build_environment.py all
/usr/bin/python3 tools/compact_manifest.py
/usr/bin/python3 tests/hainan_environment.py
```

Copy this directory's `aoi-inventory.json` and `input/soil-history/` into `HAINAN_ENV_WORKDIR`; retain `cache/` there locally or rebuild it. Ignore the cache in version control. Source scripts preserve this standalone directory layout when the environment variables are omitted. The tests need only `HAINAN_ENV_ASSET_DIR` to validate a deployed copy. No changed filename or implicit checkout path is required.

Repository integration defaults: scripts now use data/hainan/regional/environment for assets, .data-cache/hainan-environment for caches, the committed AOI inventory, and existing data/hainan historical soil inputs. Environment variables remain optional overrides.
