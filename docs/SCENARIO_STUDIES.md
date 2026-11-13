# 批量情景、方案对照与反馈 / Scenario studies, comparison and feedback

本地版本 0.3.23，2026-10-27。原版 FarmDESIGN 页面仍独立使用原作者引擎；本说明中的批量功能使用案例区 A 模型，模型版本保持 screening-0.2.3。

Local version 0.3.23, 2026-10-27. The original FarmDESIGN page continues to use the author's engine. Batch studies described here use the Route A case model, still screening-0.2.3.

## 批量实验 / Batch experiments

1. 在单次情景规划中选好主体、资源数据、气候、收益参与底线及可选输入合同。打开“批量情景实验”，选择预设或当前自定义条件、独立季度和决策规则。最多60个组合。
2. 创建时复制全部输入并计算 SHA-256。创建后的工作台修改不影响该批次。预设会替换水、劳动、降雨、价格和冲击倍率；自定义项保留当前倍率。可选 N/P、空间降雨合同不会被静默移除，不兼容的季度或范围会阻止创建。
3. 点击运行。每项使用原有搜索线程，串行计算；完成后存检查点。暂停保留完成项，当前未完成项下次重算。关闭网页或进程后重新打开，也可从未完成项继续。
4. 每项保留所选排序偏好下的首个可行候选、基准、可行数量和检查数量。未找到可行方案时不会以零代替结果。完整前沿不会被冒称为已保存；“重算完整前沿”恢复冻结输入并重新计算，可在原情景规划中浏览并保存具体方案。
5. 导出 JSON 保留输入、合同和结果摘要；CSV 含单位和状态。导入会核对摘要。摘要仅检查本地记录完整性，不证明来源真实、运行字节身份或科学有效性。恢复计算要求记录的参数和声明引擎身份与当前版本一致；旧版记录可以查看和导出。
6. 批次独立导出，普通项目 JSON 不包含批次。便携版会将其与其他本地状态一起保存到 UserData。普通浏览器配额不足时停止运行，内存结果仍可导出。导出后再清空旧批次，新批次不会自动覆盖旧结果。

Choose the farms and inputs in the single scenario lab, then choose scenarios, independent quarters and decision rules in the batch page. Creation freezes the full inputs with SHA-256 digests. Presets replace the five scenario multipliers; custom conditions retain them. Optional contracts are validated, never silently removed. Jobs run sequentially with the existing optimizer. Pause or reopening retains completed jobs and reruns interrupted jobs. Each job retains the preferred feasible candidate, baseline and counts; rerun a job for its full candidate frontier. JSON import checks record integrity. Resuming requires matching parameter and declared-engine identities. JSON digests do not establish authenticity or scientific validity. Batch JSON is exported separately from ordinary project JSON; the portable folder saves both automatically. Storage failure pauses computation while leaving in-memory results exportable.

独立季度之间没有状态传递，不能求和为全年结果。各次搜索的综合分数依赖其自身候选集，不能跨情景比较。示例系数没有田间校准；没有新增真实农户、因果识别或已批准的区域课题结论。

Quarters do not transfer state and must not be summed into annual results. Composite scores depend on each search's own candidate set and must not be compared between scenarios. Example coefficients remain uncalibrated. These features add no field observations, causal identification or approved regional research conclusions.

## 方案比较与工作恢复 / Plan comparison and working-state restoration

比较先核对所选主体、季度、模型、完整资源数据和气候数据。任何一项不同或未知时，仅并列显示结果。情景及排序目标、抽样数和种子的变化单独列出。允许相减也只是描述性差值；基数不为正时不计算百分比。导出 CSV 包含核对结果及双方值。

Comparison checks farms, quarter, model, complete resource snapshot and climate. Differences or unknowns suppress subtraction. Scenario and search-setting differences are listed separately. Permitted differences remain descriptive; percentages require a positive base. CSV includes context checks and both values.

方案名称和备注单独存为管理信息，不改写历史计算快照。项目导出包含这些信息及当前范围、季度、倍率、排序和选中对象。重新打开恢复工作设置，N/P 保持默认关闭，来源草稿保留并须手动启用。旧项目没有新字段时使用默认设置；无效设置有提示，原快照保留。

Labels and notes are separate metadata; historical calculation snapshots are preserved. Project exports include metadata and the working scope, quarter, multipliers, ranking and selected object. Reopening restores settings while keeping N/P off until explicitly enabled. Old projects without these fields use defaults. Invalid settings produce a notice without altering saved snapshots.

## 反馈与修订 / Feedback and revisions

反馈支持用水、收入、核算收益、劳动、氮余量、可食能量代理。记录必须提供有效日期、来源与可比性说明，并确认相同对象、窗口和指标口径。收益和氮余量可为负，其他指标不可为负。所选方案的参考值在提交时固定保存。

Feedback supports water, revenue, accounting margin, labour, nitrogen balance and edible-energy proxy. A valid date, source/comparability notes and explicit confirmation of matching population, window and metric are required. Margin and nitrogen balance can be negative; other metrics cannot. The selected plan's reference value is frozen on submission.

编辑保留旧值、参考值、来源说明和时间。归档可恢复，默认隐藏；历史最多20次以限制本地存储增长，到限额后导出并新建记录。删除原方案不会删除反馈及参考值，但不能再编辑其方案关联。完整反馈 JSON 包含修订历史。保存失败不提交本次反馈修改。用户录入均未独立核验，不自动改写或校准模型。

Edits retain previous values, references, notes and timestamps. Archiving is reversible and hidden by default. Up to 20 revisions are retained; export and create a new record after that limit. Removing a plan retains feedback and references but disables editing its plan association. Complete feedback JSON includes history. Failed saves do not commit feedback edits. User entries remain independently unverified and never automatically recalibrate the model.
