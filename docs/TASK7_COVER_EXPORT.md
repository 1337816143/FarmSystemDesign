# Task 7: traceable cover-summary export (local review)

Baseline: remote `main` / `9e2f26a076cbe011dbfa80e3f4b7360f8988ba1d`, application v0.3.8. No release or publication performed. Only v0.2.0 was found as a Git tag; v0.3.8 is an application version. Live version.json also reports v0.3.8.

## Findings and completed changes

- The chart denominator was implicit. It now explains that shares use classified approximate main-island area, including permanent water, rather than county administrative area or official cultivated-land area.
- Existing 100/200 m mask sensitivity was available only in the frozen JSON. The card now displays both totals and the 0.164% difference, explicitly distinguished from confidence intervals and local classification accuracy.
- The card could not export its full evidence. CSV now contains all nine nonzero classes in the snapshot (including minor classes), original pixel counts, km², percentages, denominator, geographic scope, method, exclusions, mask sensitivity, nodata count, source URLs and SHA-256, with the uncertainty boundary on every row. The original JSON is also downloadable. No new area calculation was introduced.
- Only five displayed classes were previously validated; malformed minor-class values could contaminate “other”. The complete summary is now checked for finite nonnegative values, duplicate codes, percentage consistency and area conservation before rendering/exporting. Invalid data retains the explicit unavailable state.
- The new module is included in the service-worker shell with a new cache identifier for offline availability.

## Source check

ESA's original documentation confirms 2021 v200, native classified GeoTIFFs versus RGB web services and attribution requirements: https://esa-worldcover.org/en/data-access (checked 2026-10-02). SoilGrids remains a prediction product: https://docs.isric.org/globaldata/soilgrids/. Global product accuracy is not treated as Hainan accuracy. No source geometries, raster values or model coefficients changed.

## Validation

44 Node tests passed, including malformed minor classes, duplicate codes, denominator mismatch, CSV provenance/limits and spreadsheet formula neutralization. Syntax and Git whitespace checks passed. Local HTTP browser flow: research → cover summary → CSV download → soil switch → cover switch → English → 390 px mobile. Installed Chrome CDP used because Browser plugin and local Playwright package were unavailable; no software installed. Desktop 1440×1050 and mobile 390×844 screenshots, downloaded CSV and browser check log are supplied separately. This was targeted QA, not the entire existing Python browser suite.

## Remaining boundaries and priorities

County geometries and statistical rows remain mismatched (historic Qiongshan / missing Wuzhishan); county choropleths and county soil averages remain unavailable. Soil mean predictions do not supply local measurements or quantified local uncertainty. Ownership/operating rights, observed crops, calibration, response relationships and independent validation remain missing; 13 actors / 110 selected predicted units retain their existing demonstration status. Both research routes await JR's decision. FarmDESIGN 4.21.5 package acquisition is not installation or execution; website v0.3.8 is separate. No regional optimization or scientific validation was added. Further high-value work requires verified county-unit crosswalks and actual operating/measurement evidence rather than additional assumed inputs.

## Parent review follow-up (r2)

Source URLs must identify both declared ESA v200 tiles with corresponding SHA-256 values. Required geography, method, exclusions, license, attribution and citation cannot be omitted. Masks require positive finite areas and the declared 100 m overview; nodata must be a nonnegative integer. Sensitivity is checked against `abs(A200 - A100) / A100 * 100`, allowing only the declared three-decimal rounding tolerance (0.0005 percentage points). Zero nodata additionally requires agreement between classified and 100 m mask area. Null class rows return an invalid summary and exports report `Invalid cover summary` rather than throwing a property-access exception.

Both the frozen JSON and its generator retain ESA's CC BY 4.0 license, requested 2021 map attribution and Zanaga et al. (2022) dataset citation / DOI from the checked original documentation. CSV repeats these on every class row. Pixel counts, class areas, masks and input raster hashes are unchanged.

46 tests now pass, including 26 malformed metadata/null-row counterexamples and an exact sensitivity/rounding check. Real Chrome CDP QA started with the prior `cover-export` service worker, updated to `cover-export-r2`, confirmed activation removed the prior cache and cached the module and snapshot, then disabled networking and reloaded. The summary and soil layer rendered offline. Actual CSV and JSON browser downloads were identical before and after disabling networking; both retained attribution. Updated desktop/mobile screenshots and a 12-check browser report accompany the delivery. No runtime or console errors, framework overlay, blank screen or mobile horizontal overflow were observed. The complete existing Python browser suite was not run.
