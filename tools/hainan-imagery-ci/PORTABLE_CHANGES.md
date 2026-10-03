# Portable adaptation scope

The production method is copied from frozen v2-exact-transform. Changes are path/CLI packaging adaptations:

- Input paths are relative/configurable instead of workspace-specific
-63source footprints are embedded in the minimal catalog instead of opening individual STAC files
- Only the old overview source_index seed is retained, not its RGB/date/count arrays
- Generate,LOD,verify and offline tests accept explicit inputs/output/work arguments
- ZIP parts preserve complete members and verifySHA256 on reassembly

Quality rules, nearest-neighbor nativeRGB reads, exact warp thresholds and live original-pixel/SCL-guard checks are preserved. Synthetic testing is separate from live generation, and partial output cannot pass final validation or packaging.
