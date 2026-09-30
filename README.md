# FarmSystem Design · v0.3.5

**研究路线 → 数据审计 → 空间证据 → 约束核算 → 情景比较**

在线使用：https://1337816143.github.io/FarmSystemDesign/

一个可解释的农业系统研究工作台。当前同时展示 proposal 的农场系统主线和待导师组确认的海南全域备选路线。不是经过农户实测校准的数字孪生，也不是FarmDESIGN/FarmSTEPS的官方实现。

顶栏可选择**中文 / EN / 中英双语**。双语模式在同一页面显示中英文；选择仅保存在当前浏览器，不改变导出的项目数据。已打包英文文案，断网后仍可切换。用户自行导入的名称、备注在项目数据和导出文件中保留原文。

## v0.3 双路线研究台

- 首页分别说明农场／地块与海南市县／分区的决策单元、研究问题、产出和边界。
- 接入海南省统计局 2025 年省级农业总量作为描述性背景；它不进入农场模型，也不被拆成县级或地块估计。
- 逐项列出数据来源状态、时空粒度、用途及缺口，支持导出 CSV 审计清单。
- 就绪关口只接受“已接入并核验”的资料；当前海南全域分析与优化均未标为就绪。
- 加入 Dong 等（2026）全岛氮磷边界文献证据；其阈值未进入演示农场模型，也未下推到市县。
- 海南图谱加入 ESA WorldCover 2021 土地覆被预览、ISRIC SoilGrids 0–5 cm pH 与 SOC 预测栅格，以及可选的历史县级参考边界。点击土壤图层显示对应预测像元值；来源、版本和处理记录见[海南空间数据审计](docs/Hainan_DATA_SOURCE_AUDIT.md)。
- 图谱仅覆盖海南岛及邻近裁剪窗，不代表整个海南省；尚无可与现势 19 个统计单元匹配的边界或经过校验的市县汇总。
- 农场案例、模型和本地项目仍沿用 v0.2 数据版本。区域来源审计有独立版本号。

研究路线、实施顺序和验收边界见 [docs/RESEARCH_ROUTES.md](docs/RESEARCH_ROUTES.md)。
路线二的可检验研究设计见[研究协议](docs/ROUTE2_PROTOCOL.md)，四级通用系统的对象与迁移顺序见[平台架构](docs/PLATFORM_ARCHITECTURE.md)，方法与年鉴目录核对见[证据笔记](docs/REGIONAL_METHOD_EVIDENCE.md)，核心术语见[术语表](GLOSSARY.md)。

## 本版重点

- 用**公开预测边界**替代随意生成的虚拟几何；所有源坐标不改动。
- Sentinel-2 L2A 10m真彩色历史影像、Leaflet本地地图、对象检查器、影像对照、源图层和质控证据。
- 110个预测单元、70.7836409ha，是明确规则筛选的演示集合，不是研究区完整农田或代表性抽样。
- 真实经营者、作物、土壤值为未知；13个主体、3个协作组及生产参数是显式假设。
- 独立、同组协作、集中配置情景；逐月水/劳动约束；简化氮收支；可复现候选搜索；方案及反馈版本快照。
- 应用、模型、数据、构建源提交四类版本信息；旧本地工作区不覆盖。

## 使用与存储

无需账号。浏览器直接计算，数据仅在当前浏览器本地保存；没有云数据库或自动GitHub写回。
第一次载入需联网；已缓存同源资源可离线使用。外部OSM底图和重新获取气象仍需网络。
私密农户资料不要提交公共仓库；定期导出项目备份。浏览器容量不足时应保留导出文件。

## 开发

```bash
npm test
npm run check
python3 -m http.server 4173
# 首次需要 Python shapely / pyproj
python3 tools/prepare_evidence.py
# 通过已安装 Playwright Chromium 在真实HTTP上测试
python3 tests/browser.py --url http://127.0.0.1:4173 --output test-results
node tools/build.mjs
```

`tools/prepare_evidence.py`只从库内公开快照确定性生成数据与结构质控，不修改源几何。
`tools/acquire_spatial.py`和`tools/acquire_fields.py`保留原始获取方法。公开服务更新可能改变返回数据，当前研究版本以SHA-256所标识的冻结快照为准。

## 结构

- `src/version.js`, `version.json`, `CHANGELOG.md`：版本
- `src/research.js`, `research.css`, `docs/RESEARCH_ROUTES.md`：双路线、区域数据审计与呈现
- `src/evidence.generated.js`：由源数据确定性生成的默认对象
- `src/model.js`：可审计核算与探索；`src/optimizer.worker.js`：计算线程
- `src/map.js`, `src/app.js`, `studio.css`：地图与界面
- `data/evidence/`：FTW、OSM、Sentinel及质控
- `data/public/`：NASA POWER和历史v0.1背景快照
- `docs/SOURCES.md`, `docs/METHODS.md`, `docs/DATA_DICTIONARY.md`：来源、方法、字段

## 数据使用边界

FTW / PRUE为10m遥感模型的连通田块预测单元，**不是地籍**。重叠筛选不能确认边界准确率，无法从RGB判定真实作物或权属；没有计算NDVI。
NASA POWER为2025历史网格数据，非逐地块实测或实时气象。
生产系数、价格、资源配额及关联全部是示例假设。模型结果不构成经营建议。

FTW CC-BY-4.0；OSM ODbL-1.0；Contains modified Copernicus Sentinel data (2025)。详见来源文档。Leaflet许可证随vendor保留。
