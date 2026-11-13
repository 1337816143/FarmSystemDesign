# Route A: optional single-quarter recovered-manure N/P

## Research scope / 研究范围

This is one interface increment toward all three original AGD objectives: spatial heterogeneity and temporal variation in selected systems; integration of PhD1 cropping systems with other production activities; nutrient, water and labour allocation for adaptive improvement. It does not complete these objectives, a whole-farm P-loss model or dynamic adaptive control. Route B, maps, source records and historical snapshots remain separate and retained.

本次仅原 AGD 三目标中的一个接口增量：所选系统空间异质与时间变异；PhD1作物与其他生产活动整合；养分、水和劳动的适应性资源优化。三个目标均未因此完成，也未实现完整P损失模型或动态适应控制。B、地图、来源与旧快照均保留。

## Input and use / 输入与使用

N/P is off by default, including after reload and full-project restore. Download the blank contract for the selected scope and quarter; null is missing, never zero. Explicitly provide schema FarmSystemDesign.ManurePhosphorusContract, schemaVersion 1, period 2025-Q1…2025-Q4, unit exactly kg elemental P, and per-operator farmId, recoveredManureP, remainingApplicationCapacityP, provenance and nonempty source. Import original JSON and confirm the P corresponds to the displayed same recovered-N material, and that the remaining capacity is fixed and net of other fixed occupancy. Import retains a disabled draft; enable manually.

N/P默认关闭。模板null保持缺失，不能启用。单位必须为所选季度kg元素P，不是P₂O₅、肥料产品质量、年Gg或施肥率。每个选中主体必须显式填写，含零。P必须与当前回收N是同一物料；容量是扣除其他固定占用后的剩余总P施用容量。导入并声明确认后保留停用草稿，手动启用。

Capacity is an exogenous fixed cap, not crop P demand or P-loss allowance. If it varies with candidate crops, mineral fertilizer or prior stocks, this contract is not applicable and a per-candidate recalculation interface is needed. The model does not fill P from plants Scores or island-wide literature thresholds. Synthetic, user-unverified, observed and literature-transfer statuses remain original declarations; observed never means independently verified.

容量不是P需求或允许P损失；若它随候选作物、矿质施肥或先期存量改变，须另建逐候选重算接口。不能从植物Scores或全岛阈值填造实测P。observed只表示用户声明实测、未独立核验；文献外推仍为外推。

Switching off removes the contract from current config, restores the original numerical path and keeps the draft and old plans. Enabled contracts block changed quarters, selected boundaries or recovered-N inventory. Ordinary resource imports retain active N/P and therefore block stale bindings; full-project restore explicitly resets N/P off. Re-import and bind to a new context or explicitly switch off; no silent fallback or rewriting of historical plans.

关闭恢复原计算但保留草稿与旧方案；启用后季度、范围或回收N库存变动时阻止计算。普通资源导入不静默关闭P；完整项目恢复明确默认关闭。须重绑或手动关闭，不能补零、偷偷回退或改写旧结果。

## Output and archives / 输出与归档

The reviewed core is unchanged: same-composition material is capped simultaneously by remaining available-N demand (existing 0.45 fraction) and total P capacity, own use first then input-order transfers within allowed groups. Transfer charge remains the hypothetical 2 per kg N. Greedy allocation is not optimal logistics or fair allocation. Result ledgers show recovered/applied/remaining N and P, P caps and transfers, and original source declarations.

核心原字节不变。它只分配单期回收物料；不核算饲料P、产品P、矿质P、土壤存量、损失通路、跨期库存或水质响应。余料不是实测环境排放。500合成系统守恒是软件检验，不是实测校准。

Exact original JSON text, filename, confirmation basis and paired recovered-N inventory are retained in inputArchive, full-search runInputs/config and selected-plan config. Candidate ledgers retain source declarations without duplicating the full raw JSON in every candidate. Historical 0.3.14 FrozenRuns use seven original modules; 0.3.15–0.3.19 / screening-0.2.1 use eight. No current module or parameter is inserted and no old output is recalculated. Digests demonstrate retained-content integrity, not authenticity, scientific validation or executed-byte attestation. local-preview release records remain incomplete.

## Recovery and verification / 恢复与验证

This documentation was regenerated after the cloud workspace reset. Core SHA256 is 69d8ac11e60c8497e96b517a8b85bdd814c6c0dc0bfc93745076e45153ee03d5 and complete engine digest exactly recovers d0974161afa7d5698e7f0ab07eec24658df96ec7c103171f17bf052b73d2a3af. Missing test-file bytes and old runtime timestamps were not invented: tests/fixtures were regenerated and all checks rerun under a new package hash. No original whole-patch recovery or old test result is claimed.

本恢复包使用新的包身份。已证实核心与完整engine精确恢复；缺失测试尾段和原createdAt未伪造。测试重新生成并重跑，不沿用旧264结果。真实浏览器和service-worker离线运行仍NOT_RUN；禁止绕过云Chromium socket限制。是否完整build/manifest通过只按本次新报告认定。

## Revision 0.3.21 / model screening-0.2.3: input guards, not calibration

The preceding recovery statement describes the immutable 0.3.20 baseline. This revision has a new engine digest because its admission checks changed; the reviewed manure-np.js algorithm remains byte-identical. Existing seven-, eight- and ten-module records keep their own historical identities and actual settings.

N/P file reads now belong to a single import request and page/modal session. Newer file selection, edits, navigation, dismissal, cancellation or reopening invalidate an older read/confirmation. Superseded reads are discarded. Confirmation displays the escaped filename and byte length, then checks the same paired material/context before saving the disabled draft. A successful confirmation is single-use. These lifecycle assertions were tested with actual app function/event bodies and delayed Promises in Node; browser visual/interaction acceptance is still NOT_RUN.

N/P文件读取与本次请求、页面及弹窗会话绑定。新文件、编辑、导航、关闭、取消、重开会使旧读取／确认失效。确认明确显示文件名与字节数，重新核对原物料／范围，成功确认只能使用一次。Node异步反例通过不等于已进行真实浏览器验收。

Inherited numeric input guards are now explicit:

- samples must be a JavaScript integer from 100 through 6000. It is the number of random draws in the large-problem branch, not a ceiling on all evaluated candidates. Baseline, uniform, single-plot and local-neighbourhood candidates are separate; small problems still enumerate their discrete set. Out-of-range, nonfinite, missing and wrong-type settings are rejected, not clamped or defaulted
- seed must be an unsigned 32-bit integer, 0 through 4294967295. Missing, nonfinite, fractional, negative or wrong-type seeds are rejected, not coerced
- Non-finite scaled monthly capacities, pooled monthly demand/capacity, quarter-total capacities and reported outside-boundary water capacity reject the calculation before an output can be exported as null. Dataset structural admission alone does not prove all scenario calculations are finite
- These checks do not change ordinary coefficients, units, material allocation or default numerical outputs. Historical snapshots are verified as retained records and are never passed through current configuration validation or recomputed

samples为100–6000的整数随机抽样次数，不是全部候选总上限；seed为0–4294967295整数。非法参数拒绝，不再自动回退或截断。月度、汇总和输出边界容量非有限时拒绝计算，不将Infinity转为JSON null。这是输入与数值安全修补，不是科学模型校准；旧快照不按新合同改写。
