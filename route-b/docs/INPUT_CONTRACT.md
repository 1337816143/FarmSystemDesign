# B engine v0.1.3 / UI v0.1.5-recovery 输入与结果合同

入口 src/engine.js，数据 src/fixture.js。浏览器纯本地运行，无账号、请求、浏览器永久存储或A模型调用。

- schema = FarmSystemDesign.HainanMenus，schemaVersion = 1
- evidence = synthetic；inferenceScope = hypothetical-systems；representativeness.status = absent；social.status = not-measured；其他身份拒绝
- periods：1–24个唯一非空标签，所有容器与时间向量逐索引要求自身明确值，拒绝稀疏孔洞和原型继承项；所有时间向量长度严格一致，未知值不得用null/空字符串替代数值；物理数量须非负且≤1e12，毛利金额另用有符号校验，允许负值和0且绝对值≤1e12（软件演示防溢出上限，不是科学阈值）
- accounting.nutrients：精确 kg elemental N / kg elemental P。P2O5不接受，须先在有来源转换合同下转换；模型不静默转换
- currency：CNY synthetic price-year 2026；毛利允许亏损、0与盈利，是固定菜单给定的已列变动成本后值，不含家庭福利或全部投资费用
- strata：1–6层；id和label；landClass；count是1–8个相同条件的假设单元整数，非面积/人口权重；areaHa；每单元 laborCapacity h、waterAccess m³；waterSourceId；origin
- menus：每层1–8个完整预筛合成菜单；id全局唯一；同 landClass，areaHa不超过单元面积；逐期劳动/水；总毛利；粮食和蔬菜kg分报；externalN/P、harvestN/P单位元素kg
- 每个菜单均声明 source、origin=synthetic、agronomicStatus=synthetic-prescreened、phd1CandidateId=null、commitment=uncommitted。不接受改名为真实试验或已承诺作物；该版本未实现时间排程
- waterSources：资源连接节点和逐期容量，不是省级水量或坐标
- constraints：产品分别设下限，外部N/P分别设上限，均为情景假设。没有N/P环境法规或海南观测阈值的含义
- objectives：固定为 grossMarginCny max / externalN min / waterTotal min；不读取用户权重，未替代参与式指标选择

nBalance / pBalance 仅为所列外部输入减所列收获移出；缺固氮/沉降/残体/库存/损失等，不是完整质量平衡或土壤损失。可能为负，应理解为该简化账本的缺口，不能自动填零。

固定菜单与两期资源不等于过程模型或作物历史排程。可达水源是此小例的唯一位置依赖关系；菜单未绑定真实地图。

输出包含每个菜单的局部检查、全部组合、违例、前沿、完整枚举计数、关闭的推断关口及科学验证状态。本版固定安全上限2000组合，任意更大实例拒绝运行；run.maxCombinations只允许1–2000的有限正整数，不能用NaN/Infinity或更大数关闭上限。compositions只接受total=0–8、parts=1–8的有限整数，并在枚举前检查单层组合数。零可行解保留原因，不自动放松约束。

FarmSystemDesign.HainanRun v1 含完整input/result、创建时刻、模型和构建标识。导入只取input重算，不信任输入记录存储的结果。源哈希是发布者的内容标识，不是签名或执行证明。会话版本最多10个，不自动覆盖；刷新前须自行下载。导入最大5MiB，且在File.text前检查。完整结果归档可能超限，不能保证在本页恢复；须另存独立的可恢复输入快照。无日期快照仍采用 schema1，带日期关联的快照采用 schema2；归档与小快照合同见 [DATED_UI_CONTRACT.md 的 Full archives](DATED_UI_CONTRACT.md#full-archives) 与 [Small recovery snapshots](DATED_UI_CONTRACT.md#small-recovery-snapshots) 两节：保留完整原输入/来源/假设标记、引擎与输入合同版本、实际有效模式和固定2000上限、有界摘要及SHA-256内容一致性校验，不含完整结果。导入后独立重算并明确原完整审计结果未载入。

异步导入与快照合同：文件读取关联请求序号及输入/模式revision。后来的导入、Reset、control编辑、JSON草稿编辑/apply、版本restore、重新运行或模式更改均使旧请求失效。旧文件读取/SHA请求成功与失败不更改当前数据、状态或导出资格，亦不派发旧快照下载；语言切换不改输入代次，同代准备去重，准备错误可重试；未应用的JSON草稿文本不是运行输入。N/P纯分份接口对零N/零可用N需求短路为0份，并使用稳定除法和有限非负后置校验，不允许数值下溢变NaN传播。
