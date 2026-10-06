# Application-shell updates and their limits

The 0.3.16 release repairs an observed update gap: a warm browser could retain the
old eight-reason renderer while independently refreshed metadata displayed a newer
commit. A fresh GET or a matching version badge is insufficient acceptance evidence.

## Bounded update behavior

- Application 0.3.16 has a new release identity and a new service-worker cache.
- Shell installation explicitly reloads all declared shell resources. A failed
  `addAll` cannot activate an incomplete installation; old data are not cleared first.
- The active worker revalidates navigations, application JavaScript, root CSS and
  version metadata. Large map/raster resources retain their existing request policy.
- Successful response caching is included in the fetch event lifetime. Offline
  fallback reads the current cache, not an arbitrary older application cache.
- Activation does not reload a document, clear localStorage, rewrite saved plans,
  or pretend to replace JavaScript already executing in an open page.

An existing document may still execute its old modules after a new worker activates.
An ordinary reload after activation loads the updated shell. A legacy migration can
therefore require a second ordinary reload; it does not require clearing browser data.
Metadata consistency remains a declared-source check, not executed-byte attestation
or a promise of atomic cross-file deployment. A fresh version module beside an old
renderer is explicitly included as a negative control in the regression test.

## Acceptance evidence

`tests/upgrade_browser.py` serves byte-verified original 0.3.15 shell files with an
hour-long HTTP cache, warms a real browser and service worker, creates a real saved
plan, then switches the same origin to 0.3.16. It verifies the actual 78-reason UI
after activation and normal reload, preserved saved-plan content, resource revalidation,
offline reload, and settled mobile screenshots. A separate mixed-shell control proves
that the badge alone cannot establish successful migration. Playwright request routing
is deliberately absent because it would disable the HTTP cache under test.

No model coefficients, source geometry, rainfall assumptions or calibration status
are changed by this update mechanism. Future changes to the application shell should
carry a new release/cache identity and rerun the real upgrade regression.
