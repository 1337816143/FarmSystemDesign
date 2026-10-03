# 空间数据模式与覆盖审计（2026-10-03）

本阶段基于已发布 main `4b794b028d266a4b4999970fd9ffe4f631a58b28`。保留所有原版数据、模型和统计导出；新版只改变空间证据展示，不把分类像元接入农场经营优化。

## 原版“预测几何”究竟是什么

`tools/acquire_fields.py` 从 [FTW / PRUE 公共发布](https://source.coop/ftw/global-data) 的海南 `CN_HI.parquet` 读取已发布机器学习田块多边形。选择 determination 年份 2025、与 `[109.108,18.354,109.151,18.397]` 相交的记录，最多 3000 条；此次快照 1170 条。代码没有生成随机边界、平滑或重画。

`tools/prepare_evidence.py` 再要求 Polygon 有效、面积至少 0.1 ha、完整包含于裁剪影像、与 OSM 农业斑块重叠至少 90%。输出 `data/evidence/selected-fields.geojson` 和 `src/evidence.generated.js`。OSM 重叠是筛选，不能作为独立准确率验证。FTW confidence 是 500m 图层采样，不是逐田块正确概率。

边界源为公开机器学习预测；经营主体、作物配置（水稻/蔬菜/豆类按 source ID 取余）、水与劳动预算和协作区是明确合成演示假设。这是“真实公开预测几何 + 合成经营情景”，不是实测耕地、地籍、经营权或确权调查。

`src/map.js` 原始 Sentinel-2 底图只加载 `data/evidence/sentinel2-visual.webp` 单张裁剪，影像日期 2025-03-22，bbox `[109.1030393,18.3194732,109.1952329,18.39629]`，1027×901 像元，原生 10m。原图 minZoom=11 和按所选单元 fit 加强了局部窗口体验；本阶段允许缩小至 zoom 6，但没有把旧裁剪称为全省影像。

## 新版分类模式

[Esri 官方项目](https://www.arcgis.com/home/item.html?id=cfcb7609de5f478eb7666240902d4d3d)和[公开 ImageServer](https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer)实际返回 2017–2025 年时间范围，年度 10m 分类。2025 是此次核验的该服务最新完整年度，不代表所有土地调查的“最新”。源数据 CC BY 4.0；在线服务另适用项目 metadata 中 Esri Master License Agreement。署名 Impact Observatory、Microsoft、Esri。metadata 原文和服务响应保存在 `data/hainan/landcover-2025/`。

新版 `src/landcover-layer.js` 固定 `Year = 2025`，使用服务的 `Isolate Crops for Visualization and Analysis`，只显示 Crops=5；完整分类模式显示所有类别，供核查其他类别与云。256×256 视野瓦片、最近邻分类渲染、keepBuffer=1、只在移动结束更新；没有一次下载全省高分栅格。服务不可用显式显示错误；透明不自动解释为“非耕地”。

Crops=5 主要表示非树高的栽培作物/结构化休耕地。淹水农田可能落入 Flooded vegetation=4，树作物可能落入 Trees=2。Clouds=10 意味无有效分类；透明可能是服务无数据，在 Crops 模式也可能是被隐藏的其他类。这是遥感分类耕作覆盖，不是法定耕地名录；缺少海南本地独立分类准确率验证。切换不修改原田块、模型输入、原 2021 面积统计或导出。

## 实际覆盖记录

| 图层 | 本岛 | 离岛 / 三沙 | 年份与限制 |
|---|---|---|---|
| 原 FTW 田块 | 仅崖州窗口 | 无 | 2025 公开模型预测 |
| 原 Sentinel-2 RGB/SCL | 仅上述裁剪 | 无 | 2025-03-22；SCL usable=4,5,6,7 |
| 原 WorldCover | 本岛窗口及邻近大陆/海域 | 不能称全省 | 2021；1200×1080 渲染预览约 300m/像元 |
| 原县界 | 历史参考 | 缺少逐岛验证 | geoBoundaries 2017；含琼山、缺五指山，不能当现行政全集 |
| 原 SoilGrids pH/SOC | 本岛窗口；存在无值 | 窗口外无 | 模型预测；0–5cm、原生 250m |
| 原 NASA POWER | 原演示点位 | 无逐岛站点网格 | 不等同全省实测气候 |
| 新 2025 分类 | 已核实本岛窗口和崖州返回有效图像 | 西沙/南沙大窗口能返回部分分类；每个岛礁未逐一核验 | 在线按需；不保证无云或省域完整 |

`tools/verify_latest_landcover.py` 预算 10 个请求，包括服务 metadata、项目 metadata、4 个 256×256 渲染探针、年度目录、256×256 原类别 TIFF、Crops 隔离一致性探针和 64KiB COG Range，不作大数据下载。`verification.json` 记录请求、文件 SHA256、实际非透明数量。本岛大窗口 31920/65536、崖州 65536/65536、西沙窗口 6012/65536、南沙窗口 12776/65536。探针包含海域、低分辨率渲染，因此不能把透明比例当缺测面积，也不能用它推算类别面积或声称全省覆盖。

原类别 TIFF 采用 `None` rendering、U8、nearest，窗口采样计数 Water=5827、Trees=1159、Flooded vegetation=68、Crops=31378、Built=23454、Bare=250、Rangeland=3400，总计 65536。不是原生面积统计。本次窗口未采到云，不保证整个海南无云。

官方 Explorer 使用的 [2025 原生 49Q COG](https://lulctimeseries.blob.core.windows.net/lulctimeseriesv003/lc2025/49Q_20250101-20251231.tif) 已核 HTTP Range 206 和 TIFF 头；约 136MB 的完整文件没有打包到 Pages。Range 记录单独保留，64KiB 样本 hash 不是全文件 hash。49Q 可用于后续本岛原生分析，但不能代表离岛/三沙全覆盖。

## 后续全覆盖验收门槛

证据 JSON 明确使用 LF 字节，由 `.gitattributes` 保持 checkout/archive 一致；SHA256 校验精确原文件字节，不做忽略换行的宽松校验。`tools/canonicalize_landcover_evidence.py` 规范文本并重建校验清单；采集脚本也明确写 LF。分类图在17/18级使用16级瓦片放大，10m原生精度不会随放大提高，不再因超过16级而隐式消失。

尚未完成全海南现行行政边界核验、逐岛/三沙清单核验、最新 10m RGB 影像拼接、云与无数据分类统计、全省 DEM 和气候网格。后续先建立明确区域清单和合法许可，再用 STAC 场景索引、COG Range 读取、SCL 云/无数据、分块及 LOD；限定下载预算，逐块记录时间、范围、hash、分类计数与无值比例。完整原始统计不能从网页颜色预览推算。不能把本阶段称为“全部海南数据已经完成”。
