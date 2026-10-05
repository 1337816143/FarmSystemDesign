# Spatial evidence → optional farm rainfall input (0.3.15)

## What now runs

The Scenario lab offers an opt-in **CHIRPS 2025 representative-point rainfall** mode next to the original NASA POWER point series. The existing default stays NASA. Both source series feed the same synthetic three-month supplemental-water equation, with the same crop allocation, rainfall multiplier and resource capacities. The NASA series uses its existing requested point (109.17°E, 18.38°N); CHIRPS uses the plots’ containing cells. This changes both the data product and spatial support, so the contrast does not isolate product bias. Source switching marks existing results stale; it never rewrites saved plans.

This is a historical input-source sensitivity experiment, not a weather forecast, calibrated crop-water model or validated adaptation policy. Application 0.3.15 uses model `screening-0.2.1`; the original evidence/assumptions dataset and regional evidence versions do not change.

## Contract and reproducibility

Public file: [spatial-inputs-2025.json](../data/derived/spatial-inputs-2025.json), schema `FarmSystemDesign.SpatialInputContract`, version `spatial-inputs-2025-r1`.

- 110 existing FTW plot geometries remain byte-for-byte unchanged. Binding records carry plot ID, representative point, area, existing source-geometry SHA-256 and a geometry fingerprint for ordinary stale-binding detection
- 1,320 monthly rainfall assignments link those plots to **one independent 0.05° CHIRPS grid cell**, approximately 5.5 km. They are not 110 independent climate observations; this case cannot resolve between-plot rainfall variation
- `sources` records each frozen file path and SHA-256, source metadata, units, period, CRS, native raster extent and dimensions. Each observation retains source reference, row/column, native-cell bounds, value and missingness status
- Coordinates are WGS84. For climate, the containing original GeoTIFF cell is selected at the plot's already-published interior representative point. No interpolation, gap filling or downscaling is performed. A point assignment is not a polygon-area mean, especially if a polygon crosses cell boundaries
- CHIRPS values are native **monthly totals in mm/month**. They are not multiplied by days. The legacy POWER series retains its existing mean-daily-to-month-total conversion
- The contract freezes the twelve months. Switching quarter selects three aligned months; it does not transmit state, learn from previous windows, or implement an adaptive decision policy

Build with `python tools/build-spatial-inputs.py` using rasterio 1.4.3, Shapely 2.1.2 and Pillow. It only reads repository snapshots and writes the derived contract. `python tests/spatial_inputs.py` independently resamples the raw files and verifies hashes, cells, values and context joins. No network request is needed. The original metadata's CHIRPS source URL and product identity are retained; building this bridge does not independently validate the source product's meteorological accuracy.

## Admission and missingness

Optional mode requires an exact plot ID, matching geometry fingerprint, unchanged representative point/area, twelve finite nonnegative month totals, supported units and CRS, and valid native-cell mapping for every selected plot. Missing, out-of-bounds, misaligned or stale records throw an error. No zero imputation and no automatic NASA fallback occur in this mode. Users can manually switch back to the original mode; its existing missing-rainfall warning and conservative zero-demand-reduction behavior are unchanged.

The FNV geometry fingerprint is a stale-state check, **not** a cryptographic signature or hostile-tampering defense. Source SHA-256 values identify the repository bytes used by the build. Runtime contract checks do not re-download and authenticate every source. FrozenRun captures the contract inside the actual calculation config and hashes inputs/outputs with SHA-256; it remains local-record integrity, not scientific validation or executed-byte attestation.

## Context that must not become parameters

Each binding also retains:

- 2025 Esri/Impact Observatory/Microsoft class at the representative point on the existing detail nearest-neighbor WGS84 display derivative. Its native source is 10 m UTM; the sampled derivative is explicitly identified. Here 109 points have Crops code 5 and one has Built area code 7. These are **point-class counts**, not plot-majority classes, areas, official cultivated land or observed crop species
- OSM 2026-10-03 community administrative containment, source relation ID and whether the full original plot is covered. It does not establish authority, ownership, operating rights, a collaboration group or permitted transfers
- Monthly POWER/MERRA-2 temperature at its native coarse grid. It is context only and does not supply a yield response, soil factor or calibration

None of these context records changes crop choices, `soilFactor`, farm grouping, fixed activities, income floors, capacities or production coefficients. Land-cover versioning remains separate from the FTW plot geometry version. No original geometry is substituted or redrawn.

## A bounded numerical check

For the unchanged 110-plot, Q1, normal-condition allocation:

- Legacy NASA supplemental-water total: 423,968.4867004955 m³
- CHIRPS-input total: 431,385.0247510644 m³
- Difference: +7,416.538050568954 m³

These are outputs of the same **synthetic uncalibrated accounting model**, not measurements or a forecast of water demand. Crop revenue, output, labour, nitrogen and capacities do not change merely by selecting rainfall input. Water cost and accounting margin can change through the existing synthetic CNY 0.35/m³ term. Unknown irrigation rights remain unknown.

## PhD2 and method scope

- O1 spatial/temporal characterization: establishes auditable plot-to-native-grid support and monthly alignment; one year and one local rainfall cell do not establish a spatiotemporal classification or trend
- O2 integrated farming systems: admits one observed-product input to the existing demonstrator while maintaining the explicit hypothetical activities/resource flows
- O3 resource allocation: allows reproducible source-sensitivity comparison of feasible allocations; it does not validate a real farm recommendation or prove a global optimum

FarmDESIGN, FarmSTEPS and Landscape IMAGES remain methodological references. This bridge does not claim to implement their full models, dynamic states, spatial interactions or calibration. Next scientific gates remain real decision rights, operating records, calibrated responses, independent validation and explicit information-arrival/adjustment rules. Paper-to-Farm integration is additive: metric evidence links, maps, archived data, complete candidate frontier and old snapshots remain available.
