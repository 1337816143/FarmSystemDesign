# Hainan 2025 continuous local class delivery

Source: Esri / Impact Observatory / Microsoft, 2025 annual land cover, native 10 m, CC BY 4.0. The pinned original COG URL and SHA256 are in landcover-local-manifest.json. This derivative covers the geographic rectangle around Hainan main island and nearshore, including some mainland land and sea; it is not a provincial administrative polygon. Existing offshore service layers remain separate.

## Rendering contract

Load landcover-local-manifest.json. Select only records with min_zoom <= map zoom <= max_zoom. The overview is approximately 151 x 160 m (zooms <=9), medium approximately 38 x 40 m (zooms10-11), and detail approximately 9.4-9.5 x 10.02 m (zooms12-18). All are regular EPSG:4326 nearest-neighbour derivatives of the native EPSG:32649 class raster. Use bounds_wsen, width/height and pixel_size_degrees for the existing geographic target-pixel renderer. Values are grayscale PNG red-channel codes, not colorized pixels. Codes:0 nodata,1 Water,2 Trees,4 Flooded vegetation,5 Crops,7 Built,8 Bare,9 Snow/ice,10 Clouds,11 Rangeland. Full-class display must retain cloud10; crop-only display hides every non5 class. No category or invalid pixel is filled or smoothed.

The detail/medium blocks are at most1024x1024. The main overview block is2048x1875 (~15MB decoded RGBA); a narrow eastern companion covers the remaining overview columns. Cache by decoded-byte budget, or keep at most8 detail blocks. Empty source blocks have explicit source-nodata status and null URLs. They are not network failures. Missing PNG within a nonempty record is a network/load failure and should be retryable.

## Verification and limits

Every rectangular grid cell is accounted for by a non-overlapping block.9576 independently transformed display-pixel centres were compared with full-resolution source values; zero differences. Coordinate transformation is exact (GDAL error threshold0); source overviews are disabled for coarse derivatives. SHA256 of the native136217448-byte source was verified. PNGs are lossless; all observed class codes are in the original product legend. These are reproducibility/coverage checks, not ground-truth classification accuracy. Display class counts are not native land area and must not replace the earlier native10m source area audit. Crops is a model class, not statutory cultivated land, crop species, cadastral ownership or farm-model input.

## Rebuild

Requires GDAL, NumPy and Pillow. Download the exact source COG URL from the manifest to a local file, verify the stated source SHA256, then set HAINAN_ESRI_SOURCE to that file and run build_landcover_delivery.py. The source COG is not embedded in this small web bundle. Default source path is source/esri49Q-2025.tif beside the script. GDAL cache is capped at64MiB and warp work memory32MiB. --reuse-verified-detail is only a checkpoint recovery option: it requires an existing matching manifest, all existing detail PNG hashes, and a prior zero-mismatch native detail check; normal reproduction omits this flag.
