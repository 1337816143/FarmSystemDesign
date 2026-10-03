# Hainan mainland native-window imagery CI kit

Method: `v2-exact-transform`. Source:63 pinned public Sentinel-2 C1 L2A2025 scenes. This kit generates continuous same-origin RGB display coverage for the114 main-island grid cells, plus56 display-LOD parents. It does not publish a website, modify Pages/main, create an account, use credentials, or change billing/network/security settings.

## Required runner and commands

Recommended: official `ubuntu-24.04` runner, `/usr/bin/python3`,2 workers(default);3 workers are supported when memory permits. Set the workflow job timeout to120 minutes. Use a manual workflow on the reviewed generation branch with only `contents: read`; publishing/deployment is outside this kit.

Install only official Ubuntu packages:

    sudo apt-get update
    sudo apt-get install -y ca-certificates python3 python3-gdal python3-numpy python3-scipy python3-pil python3-pyproj
    cd path/to/ci-kit
    WORKERS=2 bash ci-run.sh

`ci-run.sh` first validates the full kit SHA manifest, runs offline geometry/mask tests, processes every native block, builds all LODs, validates outputs, then packages complete ZIP groups. No PyPI, npm, cloud account, secret, or application login is needed for generation.

Individual resumable command:

    /usr/bin/python3 scripts/generate.py --inputs inputs --output generated --work work --workers 2 --limit 6

Omit `--limit` for the full grid. Each invocation skips only already complete files with the exact method version. Failed source reads are retried, then failed cells are retried at lower concurrency; unresolved cells remain incomplete and prevent successful final validation/packaging. The default path never treats a failed download as a real source-data gap.

The input/output/work parameters are portable paths. GDAL settings are applied inside the script: bounded caches, bounded warp memory, HTTP Range reading and native RGB overview disabled. No proxy, OS isolation, persistent permission, or credential is changed. Runtime network permission must be supplied by the normal approved runner.

## Minimum public inputs (about431KB)

- `grid.json`:114 continuous2048-pixel cells at0.00009°
- `source-catalog.json`:63 source IDs, dates, source footprints, transforms, and onlyTCI/SCL URLs/metadata
- `main-island-mask-100m.tif`:85,790-byte derived connected-main-island mask
- `overview-source-index.npz`:178,766bytes, one uint8 source-index array; used only to rank source candidates
- `overview-provenance.json`:source-index→scene-ID lookup and old overview extent
- `source-notices.json`:public source/licence/attribution notes

There are no522-item STAC dumps, old24 imagery blocks, raw RGB COGs, request logs, private notes or secrets. The priority seed is never enlarged into detailed imagery and is not used as native-pixel coverage evidence.

## Pixel quality and exact reprojection

- Original10m TCI RGB must have at least one nonzero channel before display compression
- Native20m SCL must be2/4/5/6; its7×7 neighborhood must contain none of3/8/9/10, giving60m exclusion per axis
- SCL-window reads include a native-pixel halo, including tile edges
- All SCL, RGB and main-island-denominator warps set `errorThreshold=0`
- RGB uses nearest-neighbor native COG pixels with `overviewLevel=NONE`
- Up to12 live-source controls for every contributing RGB read compare exact raw source bytes using independently projected native pixel indices and recheck the original7×7 SCL guard; any mismatch fails, rather than relaxing validation
- Offline tests compare20,000 synthetic RGB points and20,000 SCL/guard points at the actual source affine, plus all3,373,280 centres in the supplied100m main-island mask

The output is a multi-date2025 display mosaic, not a single-date or independently certified cloud-free product. Haze/SCL mistakes and date seams can remain. Missing, rejected and zero-RGB pixels remain transparent. The mask and300m coastline selection buffer are not administrative boundaries or an exhaustive offshore-island inventory. Existing Sansha delivery is out of scope.

## Output and front-end interface

`generated/manifest.json` must report `native_grid_complete:true`,114 completed native blocks and170 records before use. Expected levels are114/36/13/5/2records. Native display pixels are0.00009°:approximately9.4–9.5m east-west and10.0188m north-south; original source resolution is10m and no finer detail is created.

Each record provides `preview,bounds_wsen,width,height,pixel_size_degrees,min_zoom,max_zoom,crs,transform,transform_convention,gdal_transform,metadata,status_preview`. `transform` is Rasterio/Affine[a,b,c,d,e,f]; `gdal_transform` is[x0,dx,rx,y0,ry,dy]. Both describe a regular EPSG:4326 grid.

Use one active level, viewport intersection, cancellation and a decoded-image LRU budget around8tiles. Choose from actual Leaflet tileZoom/coords.z:level4 forz<=10,level3 forz11,level2 forz12,level1 forz13,level0 forz>=14. Do not fetch all114 native images or multiple full LODs simultaneously. Rendered gaps must not be silently filled with a coarser product or a remote COG.

Every level has an independent statusPNG. Native source/date evidence is lossless RGB8 PNG:R=source_index,G=day-of-year lowbyte,B=highbyte; date=G+256*B in2025. This is Canvas-readable without16-bit PNG precision loss. LOD parents are sampled directly from native tiles, rather than recursively recompressing already downsampled parents. Quantitative radiometry must use original reflectance assets, not lossy WebP.

## Size and artifact delivery

The first urban cell measured1,048,292bytes WebP plus33,523bytes audit data and approximately53.46MB of source Range payload. Whole-island source transfer is estimated3–6GB; expected complete output approximately100–180MB, to be replaced by measured CI values. No15.39GB whole-scene download is performed. Every generated file must be<10,000,000bytes; packaging stops above220MiB total and reports the actual size rather than silently changing quality.

`package_artifacts.py` creates whole-member ZIP groups no larger than20MiB, plus `artifact-index.json`. Upload EACH ZIP as a separate CI artifact, with compression-level0; upload the index separately. Never upload the entire `artifacts/` directory as one artifact. A20MiB ZIP plus the uploader envelope stays below24MiB and leaves margin under32MiB materialization. There are no split binary fragments to concatenate.

Each ZIP contains `part-manifest.json` with member paths, sizes andSHA256; the index contains every part hash and every final member hash. Reconstruction verifies archive/member hashes, rejects traversal/symlinks/duplicates and refuses to overwrite a different existing file:

    /usr/bin/python3 scripts/reassemble_artifacts.py --index downloads/artifact-index.json --parts downloads --output reconstructed

The script finds part ZIPs recursively, so artifact extraction subdirectories do not require guessing. Keep native source, quality, date and metadata assets; do not upload `work/`, COG request logs, caches or extra raw NPZ layers.

## Provenance

Contains modified Copernicus Sentinel data(2025), obtained from Element84 Earth Search public C1 L2A COGs. See `inputs/source-notices.json`. The SHA manifest pins all kit inputs and code. Files under `proofs/` are offline test results, not a claim that the complete live dataset has already been generated.
