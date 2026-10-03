# 当前五指标契约 / Current five-metric contracts

`src/metric-contracts.js` explains the existing accounting engine. It exports the JSON-serializable arrays `METRIC_CONTRACTS` and `EVIDENCE_REFS`; it does not supply optimizer coefficients, import literature formulas, or change calculations. Human-facing descriptions have `{zh, en}` fields. IDs and status codes are stable machine-readable identifiers.

## 共同边界 / Common boundary

五项都是所选经营主体合计、单次合成三个月窗口的总量，不是每公顷、每人或年度指标。`CROPS`与`src/model.js`中的合成系数直接用于窗口，没有“年度系数除以4”的假设。月份曲线分配窗口需求；家禽水和劳动的`/3`只将窗口总量均分至三个月。季度选择2025年对应三个月降雨，没有跨期状态、作物轮作或土壤存量结转。主体选择/共享分组不构成距离、邻接或水文空间优化。

All five are totals for selected actors over one synthetic three-month window. They are not per-hectare, per-person, or annual indicators. Synthetic coefficients in `CROPS` and `src/model.js` apply directly to that window. Monthly curves distribute window demand; poultry water/labour `/3` distributes a window total among months. No annual-to-quarter division or state carryover is implemented. Quarter selects three rainfall months of 2025. Organizational grouping is not spatial optimization.

All five have science grade **D**, status `implemented-simplified-screening`, calibration `uncalibrated`, and synthetic production coefficients. `execution.status = implemented` describes code, not empirical validity or reproduction of a literature model. These statuses apply separately to implementation, source identity, and scientific evidence; no aggregate “verified” badge upgrades them.

## 核算口径 / Accounting meanings

| Field | Unit and definition | Boundary that must remain explicit |
|---|---|---|
| `margin` | CNY: actor revenue minus model-accounted costs, summed | Not household net income or annual per-hectare literature gross margin; standardized labour pricing does not distinguish family/hired work; detailed cost overlap is unverified |
| `water` | m³: plot demand after simplified rainfall reduction plus poultry demand | Supplemental demand, not groundwater depletion, recharge, measured withdrawals, or a complete water balance |
| `labour` | workdays: activity × area × monthly curve plus poultry workdays | Hours per workday are **undefined**; no default eight-hour conversion, family/hired distinction, or daily/weekly peak model |
| `nSurplus` | kg N: signed selected-boundary external inputs minus outputs | Internal transfers cancel; not measured N loss or emissions; negative balance remains negative; absolute value is only a decision-comparison transform |
| `energy` | GJ: synthetic activity energy × area × output factor plus poultry energy | Production-side proxy, not food security, actual consumption, nutritional adequacy, access, or affordability |

`margin`: modeled revenue includes plot activities and poultry. Costs include activity/poultry base costs, chemical N, water, labour, and internal manure-transfer charges. No household/nonfarm account or complete fixed-capital/tax/financing account exists. Cost categories lack itemized calibration, so double counting cannot be ruled out.

`water`: each monthly plot demand is `max(0, c.water × curve − rain × config.rain × 10 × fraction) × areaHa`; the fraction is 0.15 for ponds and 0.35 otherwise. The factor 10 converts mm·ha to m³. These simplified fractions are synthetic code assumptions, not paper-derived recharge coefficients. Poultry adds 0.07 m³ per unit per window. `config.water` changes capacity, not demand. Month-by-month constraints can fail even when total capacity is sufficient.

`labour`: activity workday coefficients and curves define demand; poultry adds 0.04 workdays per unit per window. `config.labour` changes capacity, not demand. Labour participates in Pareto dominance and monthly constraints; the preference score does not have a separate labour weight. The cost rate of CNY 100 per workday does not define hours per workday.

`nSurplus`: external inputs are chemical N, feed N, and fixation; external outputs are synthetic harvest N. Actor balances include transfers; total `nInput`/`nOutput` are external-only. Poultry feed/harvest/manure/recovery factors and manure availability are synthetic. Internal manure reduces chemical-N demand but is not an additional external input. No nitrogen-loss pathway or soil-stock dynamics are estimated. The stored signed balance is preserved; `dominates`, ranking normalization, and preference scoring use its absolute value. A negative result triggers a warning rather than a zero clamp.

`energy`: activity `energy` is multiplied by hectares and the output factor directly. This is not an executed multiplication of `yieldTonnes` by a validated food-composition table. Poultry adds 0.008 GJ per unit. The internal preference name `food` does not change the metric’s meaning.

## 缺失值 / Missingness

No paper or missing observation automatically supplies production coefficients. Invalid activities and unknown/duplicate actor IDs raise errors; non-finite totals raise errors. Dataset validation separately checks required input fields. This contract does not claim exhaustive input validation by `evaluate` alone.

`climateForQuarter` returns `null` when the chosen month is absent or monthly precipitation is non-finite. `evaluate` retains missingness in `rainMonths`, warns, and uses 0 mm for the supplemental-demand calculation. This can also affect margin through water costs. The extractor does not itself reject finite negative rainfall. Missing workday duration remains `null`; there is no implicit hours conversion. Missing `feedN` has the existing `(c.feedN || 0)` accounting default; this does not constitute observed zero feed N. Negative N balance is retained.

## 文献身份与执行身份 / Literature versus execution identity

`EVIDENCE_REFS.kind` distinguishes:

- `definition`: the current repository’s description of its own accounting
- `executed-code`: code and synthetic constants actually defining accounting/ranking
- `background`: literature used to discuss definitions and limitations, with `relationship = background-not-adopted`

The initial literature scope is only the five sections of `liang-indicator-audit`: margin `s2`, energy `s3`, labour `s4`, water `s5`, and N `s6`. No other paper is promoted into this registry. Each reference retains the stable Paper route and static fallback, exact locator, and field-specific verification limits. Paper definition comparisons remain background; they are not the definition of Farm’s executed number.

Pinned Paper identity: version **5.5.2**, commit `d949f4dce1d7d867e7fae41fabb6734e75cdb831`, ledger `content/indicator-audit-v53.json`, Git blob `939dc6ba198a91e0abcbf976a509d64d9cb22ebb`, ledger SHA256 `a82e8b59fdaca3466cfdfdb95a8a3a75928f4d55b720cb8735c5f64d19dfb020`. The existing audit verified this release identity independently of a later local checkout HEAD. Route generation/parser source was checked; this increment does not claim live browser verification of the Paper destinations.

Original article: Liang et al. (2022), *Identifying exemplary sustainable cropping systems using a positive deviance approach: Wheat-maize double cropping in the North China Plain*, DOI [10.1016/j.agsy.2022.103471](https://doi.org/10.1016/j.agsy.2022.103471). Its existing original-source audit records a 15-page main article with SHA256 `bfbde3ef50d61598c5aa73a5ff6d02141f1d7473ae446b0f73f88e6bbef0ef47`. That identity does not automatically cover supplementary formula/parameter tables or repeat page-image review. Original article, Paper ledger, current explanatory contracts, and executed Farm source are separate identities.

All reference `adoption` flags (`parameters`, `formulas`, `optimizerInputs`) refer to **adoption through this explanatory registry** and are false. For an `executed-code` reference, this does not deny that the referenced code executes; it means the registry itself supplies nothing to calculation. Numeric constants in `execution.equations` are descriptions of already implemented synthetic code, never imported paper parameters. The actual implementation byte identity belongs to the run engine manifest; this static registry is not executing-byte attestation.

## Schema and compatibility

Each contract has `id`, `field`, bilingual `label`, a `unit` with `symbol/zh/en`, `basis`, bilingual `period/definition/boundary`, arrays of bilingual `exclusions/missingHandling`, `execution`, `science`, `ranking`, and `evidenceRefs`. `execution.codeRefs` and `execution.equations` are strings. Evidence IDs resolve to exactly one `EVIDENCE_REFS` entry. Links contain stable evidence identities only, never private run inputs.

`metricBasesCompatible(leftBasis, rightBasis)` returns true only for equal, complete declared bases: unit, semantic quantity, sum/normalization, spatial scope class, period length/kind, coefficient treatment, workday duration, and value transform. It performs **no conversion**. It rejects CNY versus USD, totals versus per-ha/year, m³ versus mm/year, workdays versus hours, and signed N balance versus emissions or absolute balance. Two workday declarations with `hoursPerWorkday: null` can match as workdays, but do not define a conversion to hours. Equality does not establish matching actual actor IDs, calendar dates, source quality, or scientific validity; those require run context. It is not a calculation or ranking dependency.

Focused checks: `node --test tests/metric-contracts.test.mjs`. Tests inspect semantic metadata against code behavior, verify source/definition/implementation separation and no literature parameter adoption, and reject incompatible dimensional bases. The project’s full regression checks remain necessary for the complete release.
