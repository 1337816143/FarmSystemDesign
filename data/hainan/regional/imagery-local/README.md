# Continuous Hainan-main-island Sentinel-2 display mosaic

2025 Sentinel-2 C1 L2A true-colour source: native TCI RGB10m, native SCL20m. Attribution: Contains modified Copernicus Sentinel data(2025); Earth Search / Element84 public C1 L2A COGs. Source catalogue and exact selected footprints are in source-catalog.json. No remote whole-scene downloads are needed by the browser for the covered main-island display grid.

## Coverage and resolution

All114 selected near-native blocks are complete, with56 coarser blocks and five display levels. The selection covers the connected main-island mask derived from100m Esri2025 classes, with a300m coastline selection buffer; it is not an official administrative boundary or an exhaustive inventory of detached islands. Existing offshore layers remain separately available.

The display CRS is EPSG:4326. Fine pixels are0.00009degrees, approximately9.4–9.5m east-west by10.019m north-south, derived by exact nearest-neighbour transformation from native10m source cells. Use bounds_wsen and pixel_size_degrees with geographic target-pixel rendering. transform uses Rasterio/Affine[a,b,c,d,e,f]; gdal_transform is also explicitly supplied. Do not interchange them.

Choose one level only: map zoom<=10 -> level4 (~151x160m);11 -> level3 (~76x80m);12 -> level2 (~38x40m);13 -> level1 (~19x20m);>=14 -> level0 (~9.5x10m). Further magnification cannot create additional detail. Fetch only intersecting viewport records; use a bounded decoded-image cache. Records carry preview, status_preview, metadata, min_zoom/max_zoom. Status and per-pixel source/day-of-year files are lossless PNG. WebP RGB is lossy display imagery and must not be used as quantitative reflectance.

## What blank cells mean

Status0: no valid-SCL observation among processed candidates, including source SCL0. Status1: observed but rejected by the stated SCL/60m guard. Status2: accepted original RGB and native SCL guard. Status3: acceptable SCL but tested RGB is entirely zero. Loading failures are a separate runtime state and must not be relabelled source no-data. Do not fill known transparent quality/nodata cells with a coarse overview.

Across the114 native display rectangles there are478150656 output cells:477620716 accepted,383447 quality rejected,146493 without a valid-SCL observation,0 RGB-all-zero cells. In the approximate main-island mask,357545392 cells are accepted and294847 quality rejected, giving99.9176037% accepted DISPLAY CELLS. This is not a surveyed land-area statistic, provincial/island census completeness, or a cloud-free accuracy score. Scene dates differ across space; seams, radiometric differences and some residual haze/cloud remain visible. Cropland, ownership and current crop species are not inferred from RGB.

## Verification and reproducibility

The producer checked all114 native blocks, all56 overviews, alpha/status agreement, source-index/date consistency and5360 live raw RGB/native7x7SCL controls. All source warps use errorThreshold0 and original-resolution RGB data. The independently downloaded seven artifact groups were checked against outer GitHub artifact digests and all630 original member SHA256 values; a second full raster-consistency pass reproduced the counts and5360 recorded controls. Independent checking does not mean every remote source byte was downloaded twice, or that there is independent ground-truth cloud validation.

Read verification.json, independent-verification.json and coverage-grid.csv. Per-block metadata includes actual contributing dates, source IDs, source-window checks and status counts. The producer kit is tracked in GitHub run37115479650, commit ee7def219c1d11a4df1c93c77dea30ff2e843cef, on review/hainan-mainland-generation. All processing was in cloud environments. Dataset archive content SHA256 (original630 members):76ff000ea6429a8407a8c5633d2be8892e6e51ff0f647e91cd6120d291044ec1. The delivery mapping adds only this README, the coverage CSV and the independent verification record.
