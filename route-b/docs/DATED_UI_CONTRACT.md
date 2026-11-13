# Dated UI and recovery contract / 日期入口与恢复合同

Release: B 0.1.6-dated-ui-r2. Dated allocator: dated-menu-events-0.1.0 (unchanged). Scientific engine: hainan-menu-engine-0.1.3 (unchanged).

## Input and scope

A source is an ordinary finite JSON object satisfying HainanDatedResourceEvents schemaVersion 1, with one required extra binding field, stratumId. Both source.stratumId and source.menuId must equal the UI selection. The input stratum and menu must exist. Each source/event also has explicit operatorId and unitId; these synthetic identifiers must agree within the source. They do not establish a real-world operator identity.

The date input requires explicit synthetic evidence and hypothetical-systems inference scope, complete-within-declared-horizon coverage, datasetVersion, local-date-no-timezone-conversion calendar convention, ordered contiguous period definitions, and nonempty explicit events for both resources. Labor is h and water is m3. A truly zero resource requires an explicit zero event. Missing, null, nonnumeric, sparse, negative or excessive values are rejected; missing is never filled with zero.

Dates are strict ISO calendar dates. All periods and uniform durations are half-open [start,end). Event dates at a period end fall into the next period, and the final horizon end is excluded. Leap-day validity is checked. Periods must align exactly with the current input period-label order. Attached menus must share identical period IDs/start/end definitions so that a regional period means the same date interval across menus. Invented examples share the first established date calendar, or initially divide the synthetic calendar year 2026 into the current number of periods (two periods use half-years).

The allocator supports only explicit event-date or uniform-duration rules. Every event retains source, parameterVersion, allocationReason and scope. A uniform-duration event is apportioned by overlap days; only floating-point residue is assigned to the last overlapping period. Conservation is checked. The UI previews labor/water vectors, totals, per-event allocation audit, original sources, dataset/module versions, synthetic mark, coverage and SHA-256 of the complete original source.

The UI's “annual” engine flag is inherited from the unchanged engine. For a custom horizon it means summation of those declared periods, not extrapolation to a calendar year. A permanently visible date-horizon notice accompanies results whenever dates are attached; non-calendar-year comparison/result warnings explicitly say declared-horizon aggregation.

## Adoption and ordinary edits

Preview does not change model input. The confirmation checkbox and separate Apply button authorize the local replacement of exactly the selected menu's laborHours and waterM3 arrays. Candidate bindings are revalidated and the original engine is run before adoption; every other input field and every other menu is kept. No date record is added to the original input object.

Applied dates are held separately as datedRecords. Ordinary input edits retain them. Editing linked resource vectors, period labels/order, stratum/menu identity or incompatible provenance is rejected if the attachments would become inconsistent. Changes to capacities, labels, non-resource prices/products/nutrient assumptions and unrelated unknown metadata remain allowed and exact; every accepted change is rerun. Declared source/version and resource-unit context changes are not treated as unrelated metadata. The user must explicitly check removal confirmation and click Remove to detach one menu; its resource values remain unchanged. Closing/cancelling the editor never detaches records. Reset explicitly restores the old no-date fixture. A successful newly imported archive/snapshot explicitly replaces the whole current model and its attachment set. A failed or stale import replaces neither.

## Canonical attachment

Each record has exactly {stratumId, menuId, parentContext, source, audit}. The source is the entire original JSON value including unknown metadata, original source strings, period declarations, allocation rules, identifiers and synthetic marks; object field order and array order are retained by JSON cloning. Formatting/whitespace of the uploaded JSON file is not retained as separate file bytes. User IDs, original labels, JSON and source text are not translated. Only UI copy and unchanged built-in label/identity pairs are translated.

The audit is freshly computed by the original allocator; it includes periods/calendar, scope, versions, vectors/totals and each event's allocation, source, parameter version, reason and date/interval. Unknown extra source fields are retained in source, not falsely described as interpreted audit fields. Records use explicit paired fields and a Set of canonical [stratumId,menuId] arrays; they are not stored in an unsafe ID-keyed ordinary object. Reserved names and separators are tested.

## Parent menu/version binding (review revision r1)

parentContext is independent of the unchanged original date JSON and uses FarmSystemDesign.DatedParentContext schemaVersion 1. It binds:

- Parent input datasetVersion, evidence and inferenceScope, plus explicitly declared input parameterVersion/source
- Stratum id, origin, areaHa and landClass, plus explicitly declared stratum parameterVersion/source
- Menu id, source, origin, areaHa, landClass, agronomicStatus, phd1CandidateId and commitment, plus explicitly declared menu parameterVersion
- Fixed resource interpretation: h and m3 per declared operating menu, never an implicit per-hectare conversion

Optional declared provenance/version fields preserve presence and their entire JSON value, distinguishing absent from null. A later same-ID replacement with a new dataset version, parameter version, source, area denominator or land class fails validation in ordinary JSON adoption, full archive restore and snapshot restore (even with a recomputed digest). The current live model/attachments remain intact. Explicit detachment is required before adopting a changed parent context; a newly previewed source is then bound to that new context. The preview includes the captured context for inspection.

Labels, resource capacities, prices/products/nutrient scenario inputs, and unrelated extra metadata are not frozen by the date binding. Their source values are retained and their model effects are recomputed. This is an explicit resource-provenance policy, not a checksum claiming that every menu coefficient is fixed.

Pre-review date attachment contract schemaVersion 1 lacked parentContext. It is rejected rather than silently upgraded, as is a current record with missing parentContext. This unpublished candidate transition does not change compatibility with old no-date B 0.1.5/schema-1 archives or schema-1 recovery snapshots. The date event source schema and allocator version remain unchanged.

## Full archives

No dates: FarmSystemDesign.HainanRun schemaVersion 1, unchanged old path.

With dates: the same archive schema name, schemaVersion 2, with datedContract, datedRecords and explicit runConfig in addition to the original full input/result/build. datedContract is {schema: FarmSystemDesign.DatedMenuAttachments, schemaVersion: 2, moduleVersion: dated-menu-events-0.1.0}. BUILD records the new app version and hashes of the dated allocator, contract, UI, error/copy modules and all old runtime sources.

The complete result tree is retained in full audit exports. The 5 MiB import protection is not weakened; a large archive is still evidence but may not be reimportable. Save a separate small recovery snapshot. For schema 2, missing/null/empty/corrupt date records are invalid, not interpreted as absence of dates. Schema-1 archives containing reserved datedContract/datedRecords fields are rejected rather than silently dropping them.

## Small recovery snapshots

No dates: FarmSystemDesign.HainanInputSnapshot schemaVersion 1 via the unchanged recovery.js.

With dates: the same schema name, schemaVersion 2. Exact top-level fields are schema, schemaVersion, engineVersion, inputContract, datedContract, datedRecords, input, runConfig, summary, build and integrity. It includes the complete input and date sources/audits, a fixed-size result summary and build identity; it excludes the full results, unrelated N/P demo controls, current result selection and session version list. Only the actual UI maxCombinations 2000 is accepted.

integrity uses SHA-256 / sorted-json-v1 / snapshot-without-integrity. The entire envelope except integrity is hashed, including original unknown input/source metadata. Hash consistency is not authentication, a trusted signature, or evidence of scientific truth. The snapshot is rejected before download if its full serialized size exceeds 5 MiB. The file guard checks size before File.text on import.

Restore clones the input before asynchronous work, checks schema/version/config and complete attachments, reallocates every original date source, rejects any source/audit or source/menu vector mismatch, checks the digest, and independently runs the original engine. A rehashed forged summary still fails against the recomputed summary. Archived result values are never adopted; full-archive saved results are audit evidence only and may be completely replaced/forged without affecting recomputation. Altering source plus every derived field consistently is not detectable as tampering because no trusted signature is claimed.

## Unapplied main-JSON drafts (review revision r2)

The main JSON editor tracks its last programmatic write and retains a sticky unapplied-draft state. Invalid or parent-context-rejected text remains exact, including incomplete JSON and formatting. Run, ordinary controls, date adoption/detachment, session restore and successful imports do not overwrite that draft. A visible notice beside results and in the editor says results/downloads use only adopted input. These operations may change the adopted model; the draft remains separate and has not been applied. An explicit detachment therefore permits the still-present draft to be submitted again directly, without retyping it.

Only successful Validate/Apply adopts the draft and replaces its display with canonical pretty JSON. The separate “Discard unapplied draft and show adopted input” button explicitly discards it. Reset is explicitly labelled “Restore the initial synthetic example and discard unapplied drafts”, and does so. Both invalidate old asynchronous reads/digests. Language changes do not edit the draft. Drafts are session-only editor state and are not included in archives/snapshots, which retain the adopted model only.

Two inherited test flows depended on Run silently replacing unadopted text. No original assertion was removed: one next-test setup now explicitly resets, and the other explicitly discards only after additionally asserting that Run preserved the bad draft. Exact original test files are retained in baseline/tests; the precise insertions are documented separately.

## Async generation and downloads

A single model generation invalidates date file reads, preview digests, pending apply confirmations, archive/snapshot file reads and recovery digest work whenever dates/ordinary JSON are edited, selection/mode changes, Reset/Run/import occurs, a preview is cancelled, or the details panel closes. Old success and failure callbacks cannot write status/input, enable adoption or dispatch an old snapshot. Both file inputs also handle the actual cancel event (not just change with an empty file list), invalidating old reads/digests while retaining adopted input and editor drafts. Node uses explicit event callbacks; the future browser script distinguishes dispatched DOM cancel from real OS file-picker cancellation, which remains separately NOT_RUN. Repeated pending preview and snapshot clicks share one operation; failures leave retry available. Language switching only re-renders presentation and does not invalidate a valid pending operation or rewrite data.

A download creates an application/json Blob with a fixed safe hainan-route-b-{kind}-{timestamp}.json name. The ObjectURL is held for 60 seconds, then revoked, and is revoked immediately if dispatch throws. URLs are created only after the current-generation guard. There is no URL for a cancelled preparation. Once dispatch has occurred, later cancellation cannot retroactively cancel the browser's independent download. UI wording says prepared and handed to the browser; it does not claim a disk save. The authored browser script must verify download.failure, native file presence, saved bytes and hash before real download success can be claimed.

## Verification boundary

209 Node tests passed: all 137 prior tests and original assertions retained plus 72 date contract/controller tests (two old test setups/actions explicitly adapted; see LEGACY_TEST_SETUP_CHANGES.md), including strict calendars/units/coverage, legacy input compatibility, data opacity, malicious-looking legal identifiers, all transition races, repeated clicks, failure/retry, actual controller 9/8/5 and 9/8/3, and the full 729-combination stress case. See root evidence/node-tests.txt.

Native browser, visual/layout, native disk and offline network QA: NOT_RUN. The future script tests those stages; its source is not a pass result. No empirical validation, calibration or adaptive-policy replay is implemented.

中文摘要：日期原始JSON值、分配规则、来源原文和重算审计同时留在完整归档及schema2小快照；无日期沿用schema1。导入必须先重新分配并核对绑定、日历、向量和审计，再独立运行原引擎；不采用文件里保存的结果。普通编辑不能暗中清除日期来源。撤销预览/关闭只取消待处理操作；解除已采用关联需要显式双动作。真实浏览器、磁盘与离线验收尚未执行。
