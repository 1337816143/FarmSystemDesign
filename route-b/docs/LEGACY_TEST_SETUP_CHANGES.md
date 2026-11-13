# Explicit old-test adaptations for the r2 draft contract

All original 137 tests and their original assertion expressions are retained. Two old test files contain insertions only. The exact old files are retained at baseline/tests/ in the review package.

1. tests/controller.test.mjs: at the beginning of “Imported labels and IDs are escaped, and null does not become zero”, insert el('#reset').click(). The preceding test leaves malformed, unapplied JSON and then runs the committed model. Run now correctly preserves that draft. The new setup isolates the next test rather than depending on losing a user's draft. All original assertions follow unchanged.
2. tests/i18n-controller.test.mjs: in “Switching while dirty does not recompute, reset edited JSON or enable export”, after the existing Run click, insert assert.equal(el('#json-input').value,'UNAPPLIED JSON TEXT') followed by el('#discard-json-draft').click(). The existing assertion that the adopted capacity is 175 then executes unchanged, as do all other original assertions. This strengthens draft preservation and makes discarding explicit.

No assertion was weakened or removed. Removing these two exact inserted snippets reproduces both original files byte-for-byte; the release sealing check verifies that fact. Every other original test/fixture/browser-script file remains byte-for-byte unchanged. New draft tests also execute the actual app/controller for complete/incomplete drafts through detach → re-Apply, Run, controls, date adoption, version restore, import, explicit discard and Reset.


## Minimal parent integration additions (0.3.22)

The frozen B runtime/BUILD17 bytes remain unchanged. The two browser test sources are adapted only in this integration candidate, not in the independent component package:

- tests/browser-qa.mjs: the dirty-input/language test keeps the original Run and capacity=175 assertion. After Run it now additionally asserts the exact UNAPPLIED JSON text survives, then explicitly clicks discard-json-draft before the original capacity assertion. The native archive identity assertion uses the imported frozen BUILD.version instead of old 0.1.5-recovery.
- tests/recovery-browser-qa.mjs: VERSION now comes from imported frozen BUILD.version. All original assertions remain.
- tests/dated-browser-qa.mjs is retained with its explicit authorization and served-URL gate. It is newly included in proposed CI. All native browser/download/offline execution is NOT_RUN in local assembly.

The original unit-controller adaptations above remain unchanged. These edits do not relax input limits, recovery pressure cases, hash checks, original assertion expressions other than current BUILD identity, or file-picker-cancellation caveats.
