# Complete published-site offline bundle

Open **Complete offline bundle** in the navigation. Download and keep the tab open until every published file is verified. Closing or pausing is safe: open it again and resume. A partial download, an HTTP failure, a checksum mismatch or a storage quota failure is visibly incomplete. No saved plan, note, map source or other website cache is removed.

The build enumerates the exact `_site` output after source identity stamping. `offline-manifest.json` contains every served file except its own envelope and the `.nojekyll` GitHub Pages deployment marker (which returns HTTP 404, not a website resource), including all application pages and data/downloads, with byte size and SHA-256. Its entries digest identifies the bundle; the manifest envelope is also stored for offline use, outside the self-referential file count. Only a fully verified bundle gets a version-specific active marker, after a final retained-byte recheck. Rechecking missing or damaged entries revokes the unchanged marker. A generation check and a short Web Lock protect another tab that completed a newer verification during the scan. Resuming verifies retained data and retries failures without trusting counts alone.

Before presenting, verify again in the same device/browser, turn off networking, reload, and navigate through the exact views you will use. Browser eviction, private mode and user deletion can remove cached files. This is a local browser cache, not a cross-device cloud backup; exporting saved plans is still recommended.

## Boundaries

All frozen files published at this site's path are covered. The build's existing exclusions remain exclusions: `data/hainan/source/**`, the failed MODIS acquisition and repository-only files are not silently added to publication. Live OSM raster tiles are never bulk downloaded. ArcGIS services, offshore remote COGs, external papers and other linked websites remain online dependencies. Use the included local Hainan layers offline. Caching a diagram or a research reference does not claim a remote service or paper has been downloaded.

## Upgrade and storage safety

The app shell is revalidated independently of large map assets. Worker identity is established through a read-only message on the actual page controller. Activation does not reload pages or rewrite user plans. The complete bundle and metadata cache names include the site path; the worker ignores other scopes. Old complete bundles are retained, so low space is reported rather than silently deleting user storage. Offline raster single-range requests receive proper 206 responses from verified complete files.
