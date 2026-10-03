# Sentinel-2 Hainan regional imagery recovery (2025)

All work was performed in the dot cloud workspace. No user desktop or old local recovery was used. This package is newly produced from public Earth Search / Copernicus Sentinel-2 C1 L2A data.

## Scope and limitations

The four query envelopes and ten named display/verification windows are geographic rectangles, not legal administrative boundaries or territorial claims. They include ocean and can include land outside the intended scope. The mainland rectangle is not all Hainan Province. A complete authoritative island/reef inventory is still missing, so this package must not be labelled complete provincial land coverage.

Full 2025 catalog searches are paginated until no next link exists. Counts of scene records and MGRS grids are catalog counts, not cloud-free or valid-pixel coverage. The last empty page, when provided by the API, is included in the page count. Date filter: 2025-01-01T00:00:00Z through 2025-12-31T23:59:59Z. This is a multi-date 2025 display mosaic, not a 2026 product or one-date observation.

## Pipeline

Use the preinstalled system GDAL Python environment, not the unrelated locally installed dependency directory:

    /usr/bin/python3 collect_catalogs.py
    /usr/bin/python3 prepare_scenes.py main xisha zhongsha nansha
    /usr/bin/python3 augment_aoi_candidates.py
    /usr/bin/python3 augment_main_gaps.py
    /usr/bin/python3 render_previews.py
    /usr/bin/python3 finalize_outputs.py

- Catalog source: https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a
- Query envelope file: `aoi-inventory.json`
- `catalogs/*.json.gz`: compact exhausted catalogs with matched/unique/page counts
- `selected-items/*.json`: source STAC items for selected candidates, including exact COG URLs, transforms and checksums
- `output/scene-catalog.json`: lightweight front-end catalog of 3 low-cloud/nodata-ranked scenes per intersecting MGRS grid within each query envelope, plus6 AOI-full-footprint candidates and3 remaining-main-island-gap candidates
- `output/previews/*.webp`: true-color display assets with transparent unrecovered areas
- `output/previews/*-status.png`: 0 unobserved; 1 observed but rejected; 2 accepted
- `output/previews/*-clear-count.png`: number of accepted observations among selected candidate scenes only
- `output/previews/*-source-doy.png`: 16-bit day-of-year for 2025, 0 missing
- `output/previews/*-qa.npz`: exact selected-source index, day-of-year, observation and accepted-observation counts
- `output/previews/*.json`: source-date and mask audit for each window
- `output/preview-manifest.json`: browser integration manifest
- `output/verification.json`: mechanical consistency and file-size audit
- `output/mask-regression-tests.json`: all-false, all-true and half-mask reprojection tests

Raw RGB COGs are not bulk-downloaded. GDAL uses HTTPS Range reads and existing COG overviews for reduced-scale display. Native SCL windows are read for quality masking. Source RGB TCI is uint8 at 10 m; this is a rendered true-color product. The reflectance red/green/blue assets are separate uint16 bands: mask DN 0 first, then apply the per-asset scale and offset (verified 0.0001 and -0.1 in the selected C1 assets). Never apply this reflectance transform to uint8 TCI values.

## Display and cloud masking

The broad main-island image is intentionally a lightweight approximately 150 m display preview. Its exact horizontal/vertical ground pixel size varies with latitude and is recorded. Most named windows render at approximately 10–20 m; none should be called more detailed than their recorded preview resolution. High zoom should use bounded native COG windows, with cancellation, viewport culling, and memory/HTTP Range caps.

Native SCL is 20 m. Accept classes 2, 4, 5 and 6. Reject 0, 1, 3, 7, 8, 9, 10 and 11. Buffer cloud/shadow/cirrus classes 3, 8, 9, 10 by 3 native SCL pixels (60 m). Reproject clean-mask fractions and require at least 99.9% accepted source area per display cell. Encode rejected=false as1 and accepted=true as2 before statistical resampling, with0 reserved for out-of-grid; this prevents the GDAL zero-value exclusion issue. For the broad main-island preview only, reduce the native20m mask to conservative80m all-clear blocks before reprojection to constrain memory; observed blocks use any-observed pixels. TCI is bilinearly resampled and mosaicked using the first accepted pixel in scene cloud-percent + 0.35*nodata-percent rank order.

Unobserved and observed-but-rejected pixels remain transparent; they are distinct in the status raster. No placeholder image, synthetic land, or global basemap is used to fill missing imagery. SCL is imperfect: haze, thin cloud, water/land confusion and seams remain possible. This is a display recovery, not certified cloud-free scientific compositing.

Coverage percentages normally use all display cells in each rectangular window, including water. Main-island land coverage, if reported, uses the companion Esri 2025 100 m connected-main-island mask (interior lakes filled), a derived approximation rather than an administrative boundary. Nearshore and offshore islands are audited separately only where named windows exist.

## Web integration

Use each `records[].preview` as an image overlay with `bounds_wsen` in WGS84. Reproject correctly if the map is Web Mercator; do not stretch longitude/latitude rasters uniformly in Web Mercator at large extents. Full records link to status, source date and count assets. Display the source year, actual contributing date range, native RGB/SCL resolution, preview display resolution, and partial-coverage warning.

For close zoom, read `scenes[].assets.visual` (TCI) together with `scl` from the scene catalog. Each has its source EPSG, transform and shape. Do not fetch entire multi-hundred-MB COGs in a browser. Bound Range reads, choose overview levels, cap concurrency and cache, cancel obsolete viewport requests, and keep nodata/clouds visible as unavailable. Asset availability and mainland-China browser performance are not guaranteed by successful cloud access.

## Attribution and license

Contains modified Copernicus Sentinel data (2025). Earth Search is operated by Element 84; source assets are public AWS-hosted COGs. Copernicus Sentinel data are free, full and open subject to the applicable legal notice and attribution. Preserve the actual acquisition year and processing attribution.

- https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice
- https://registry.opendata.aws/sentinel-2-l2a-cogs/
- https://github.com/Element84/earth-search

No registration, credentials, persistent access grant, paid request, or publication is part of this imagery preparation.

## Final validated snapshot

- Four exhausted 2025 catalogs: main2860, Xisha1511, Zhongsha2751, Nansha15976 scene records; counts are per query and must not be summed as unique observations
- Final front-end catalog:522 candidate IDs across170 distinct MGRS grids, including6 added full-footprint offshore-window candidates and3 added main-island-gap candidates
- Main display:2200×1980,579470bytes WebP,63 candidates processed; actual source dates and exact display resolution are in the metadata
- Approximate main-island mask:1558758 display cells;1545072 accepted(99.122%);13686 observed but rejected;0 without a source observation among processed candidates. These are display-cell counts using a100m derived connected-main-island mask, not native10m land area or provincial completeness
-11 completed previews:main island plus10 named windows. All actual image/status/count/date consistency checks passed. Native RGB10m and SCL20m metadata were verified for all522 candidates; red,green,blue scale0.0001 and offset-0.1 are recorded separately from TCI display
- Every unresolved or rejected display cell remains transparent. Mainland internet/browser access and exhaustive island/reef completeness remain unverified

The accompanying `reproduce-imagery.zip` contains only reproducible scripts, frozen public STAC catalogs/items, the AOI inventory, source-mask snapshot and README. It excludes dependencies, temporary failed runs, intermediate image caches and raw RGB COGs. Extract it, use an environment with GDAL,NumPy,SciPy andPillow, then follow the pipeline above. Public COG access is still required to recompute the imagery.
