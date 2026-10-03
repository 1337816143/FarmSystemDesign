# Hainan monthly rainfall and air-temperature data, 2025

Actual raster data built entirely on dot cloud on 2026-10-03. This package adds all twelve monthly rainfall and temperature layers, without using a single weather point to represent Hainan. It does not modify application source/tests and has not been published.

## Deliverable

Copy `assets/` to the website's chosen climate asset directory. Entry point: **`climate-manifest.json`**. `FRONTEND_INTERFACE.md` describes month selection and the existing renderer-compatible fields.

- 120 raster records: 2 variables × 12 months × 5 retained geographic groups
- 120 native-resolution Float32 GeoTIFFs, 120 numeric RGBA PNGs, 120 geographic preview PNGs, and per-record metadata
- Five original NASA POWER JSON responses, preserving original monthly values and response headers
- Exact source dates, URLs, units, licensing links, complete native grid definitions and SHA-256 hashes
- `validation-report.json`, `monthly-annual-precipitation-audit.json`, `named-window-climate-audit.json` and `source-catalog.json`
- Deployed assets approximately 2.3 MB; no browser request to NASA or UCSB is needed to use the data

## Source and temporal definitions

### Monthly accumulated rainfall

**CHIRPS v3 final**, 2025-01 through 2025-12, native **0.05° × 0.05°**, approximately 5.5 km. Units are **mm/month**, already monthly accumulated totals. Do not multiply them by the number of days.

The actual source COGs are:

`https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/global/cogs/chirps-v3.0.2025.MM.cog`

Only HTTP Range blocks needed for the geographic subsets were read. No complete global raster was downloaded. The native grid transform and actual -9999 fill values were preserved; the source COGs do not set a GDAL nodata tag, so this fill is assigned explicitly in the derived GeoTIFFs. True zero rainfall remains valid.

Official references: [CHIRPS v3 documentation](https://chc.ucsb.edu/data/chirps3), [monthly source directory](https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/global/cogs/), [data DOI](https://doi.org/10.15780/G2JQ0P)

Licence: CC-BY-4.0; the CHC page additionally states a public-domain waiver. Attribution: Climate Hazards Center, CHIRPS3, accessed 2026-10-03.

Each record includes `period_start`, `period_end`, `source_last_modified` and `source_raster_produced_at`. These distinguish the calendar month represented from file production/modification dates. The May COG was modified in August 2026. Nevertheless, summing all twelve delivered monthly grids agrees with the already cached annual 2025 product to Float32 rounding: maximum difference **0.0004673 mm** for the main query window and **0.0008698 mm** across the compared Nansha window. No annual source was downloaded again. There were no compared cells differing by more than 0.1 mm. This numeric agreement is recorded, rather than assumed from filenames.

### Monthly mean air temperature at 2 m

**NASA POWER monthly regional API, T2M, MERRA-2**, calendar months 2025-01 through 2025-12. Units are **°C**. The returned source header explicitly identifies MERRA2 and LST. This is monthly mean 2 m air temperature on the model's average grid elevation, not a weather station, satellite land-surface temperature, or island/field microclimate measurement.

Native spacing is **0.625° longitude × 0.5° latitude**, roughly 55–70 km depending on latitude. All retained cell centres were obtained from the regional API, then reconstructed on their exact source lattice. No interpolation or downscaling creates additional detail. The API's returned `202513` annual value is not a thirteenth month and is not included among the monthly rasters.

Official references: [Monthly/annual regional API](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/), [native model grid and interpretation](https://power.larc.nasa.gov/docs/methodology/meteorology/), [current data sources](https://power.larc.nasa.gov/docs/methodology/data/sources/), [NASA-managed provider registry and licence](https://registry.opendata.aws/nasa-power/)

The official provider registry lists CC-BY-4.0, states there are no restrictions on use/access/download, and requests citation. Attribution: NASA POWER Project, NASA Langley Research Center; MERRA-2, NASA GMAO.

## Spatial completeness and limitations

| Retained geographic group | Temperature native cells per month | Valid CHIRPS cells per month |
| --- | ---: | ---: |
| Main-island query window | 30 | 1,597 |
| Xisha geographic window | 20 | 0 |
| Zhongsha geographic window | 36 | 21 |
| Nansha geographic window | 285 | 4,580 |
| Additional targeted-offshore navigation extent | 4 | 0 |

The main CHIRPS grid is a complete 60 × 54 native-cell rectangle (3,240 total cells), retaining all 1,597 supported source cells and all 1,643 source-nodata cells. Every row and column is retained for all twelve months. The output was compared pixel-for-pixel against the downloaded regional source subset. These are source-support counts within a rectangle, not administrative land-area counts or a claim that every coastline or tiny island is resolved.

The 30 main-temperature cells form a complete 5 × 6 source grid; all twelve values at every cell match the original API response. The January source range is 15.29–22.24 °C across the query window, demonstrating actual spatially varying data rather than one repeated point. This range includes all source cells in the query envelope and is not an official province temperature statistic.

Four broad groups preserve main-island, Xisha, Zhongsha and Nansha scope. The current candidate also contains two targeted offshore shoal windows (Shenhu and Yitong); these are retained with individual point-support audits and a navigation envelope. Query windows are not current administrative polygons, exhaustive island inventories, or territorial claims. They include sea and sometimes other land/jurisdictions. The targeted navigation extent is not recast as an administrative boundary.

- CHIRPS source-ocean fill stays transparent and unavailable. Xisha and the targeted offshore extent have no valid CHIRPS rainfall values in this product. Named Yongxing, Yongshu and Zhubi rainfall points remain unavailable.
- NASA/MERRA-2 legitimately provides atmospheric model cells over both land and ocean. Those source values are retained as **coarse grid context**, not filled from nearby mainland data. No tiny island is isolated at this resolution.
- Missing values in either product are never silently supplied from the other product.
- `cloud_cells: null` means this climate product has no cloud-class layer; it does not claim observed cloud-free conditions.
- Source resolution, physical units, calendar period, geographic bounds and numeric PNG quantization remain separate metadata.

## Validation and acquisition

`validation-report.json` passes all **120 record checks**:

1. Exact source-grid dimensions and every CHIRPS numeric cell preserved
2. Every POWER value matches its original returned native grid cell
3. All twelve periods present for both variables and all five groups
4. GeoTIFF/PNG masks identical; no ocean/nodata filling; physical decoding matches within quantization
5. SHA-256 hashes, full grid continuity and source-date/unit metadata
6. Monthly-to-existing-annual rainfall reconciliation and individual named-window context audit

PNG precision is 0.1 mm for rainfall and 0.01 °C for temperature; unquantized source Float32 values remain in the GeoTIFFs. Preview colouring is clamped to the legend endpoints; clamping colours does not clamp the numeric data. `monthly-mainland-visual-qa.png` is an offline visual check of all 24 mainland monthly views, not an extra dataset.

Five successful POWER regional products were retrieved. POWER requires at least 2° on each query axis; undersized offshore requests returned explicit HTTP422 validation errors. Their request boxes were minimally expanded, and only the intended exact native cells were retained. The original full responses are included to make this inspectable. No account, credentials, paid service, new software installation or security changes were required.

Received payload was metered through a loopback-only, pinned-source Range reader. Recorded payload is approximately **12.5 MB**, far below the 120 MB per-run cap; transport headers and unrecorded interrupted bodies are not described as measured wire bytes. Source URLs, observed file modification dates, returned model headers and monthly-versus-annual numerical checks are preserved. Runtime caches and acquisition logs are excluded from the web/download archive.

## Reproduce

Use the preinstalled system Python with GDAL, NumPy and Pillow:

```sh
export HAINAN_CLIMATE_ROOT=/path/to/climate
# Optional: point at the already acquired annual raster for reconciliation.
export HAINAN_EXISTING_ANNUAL=/path/to/existing/chirps-2025-expanded.tif
/usr/bin/python3 scripts/build_climate.py
/usr/bin/python3 scripts/validate_climate.py
```

Retain `aoi-inventory.json` and scripts. Cached regional TIFFs and JSON responses in `raw/` are reused; no annual raster is fetched by either script. To deliberately refresh source products, move the raw cache aside, review the source versions/dates, rebuild, and compare the new output. Scripts are relocatable through `HAINAN_CLIMATE_ROOT`; they only write beneath that root. The annual comparison is skipped transparently if no existing annual reference is available. No application source or shared tests are edited.
