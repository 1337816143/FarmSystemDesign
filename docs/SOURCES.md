# 空间与气候来源 · v0.2.0

## 1. Fields of The World / PRUE，2025预测

提供者：Fields of The World、Taylor Geospatial及合作团队。
入口：https://source.coop/ftw/global-data
源分区：https://data.source.coop/ftw/global-data/predictions/vectors/alpha/results-by-admin-conf/admin:country_code=CN/CN_HI.parquet

Robinson et al. (2026), *The first global agricultural field boundary map at 10 m resolution*, arXiv:2605.11055。许可CC-BY-4.0。

库内`ftw-fields-2025.geojson`为2026-09-29获取的本地窗口1170个源单元子集。`field-acquisition-report.json`和`tools/acquire_fields.py`记录检索。
这些是预测田块内部像元的连通单元，不是地籍、经营权或实测田界。可能漏识、过分割、连片合并或误识。
源confidence来自500m区域栅格，不是逐地块经过校准的正确概率。本次全部入选单元为缺失，未补造。

## 2. OpenStreetMap农业斑块及地理背景

https://www.openstreetmap.org/copyright · © OpenStreetMap contributors · ODbL-1.0。

农业斑块15个，保留OSM way ID、版本、修订时间、原始坐标和标签。只反映公开地图标注，不是完整农业地块或经营边界。
筛选使用UTM 49N投影（EPSG:32649）的交叠面积比≥90%；这是保守演示筛选，不是准确率或独立验证。
FTW源预测保留CC-BY归属；OSM源/叠合字段保留ODbL来源，两类来源分层保存，不主张统一的新许可覆盖原数据。

## 3. Sentinel-2 L2A历史RGB

提供者ESA/Copernicus，通过Microsoft Planetary Computer。
产品：https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a
Item: `S2B_MSIL2A_20250322T030529_R075_T49QBA_20250322T060811`
观测：2025-03-22T03:05:29.024Z；获取：2026-09-29。
原生EPSG:32649、10m；本地RGB重投影EPSG:3857（双线性），用于标准Web地图叠加。边界保持WGS84经纬度。

`sentinel-imagery.json`保存原始影像ID、获取日期、投影范围、像元大小、局部SCL分类比例、处理过程及SHA-256。
`sentinel2-visual.webp`只作背景，**不用于推断当前作物、经营者或计算NDVI**。
SCL分类4/5/6/7按本次规则计为可用，局部占比约99.60%；不等于无云概率，不是每块地的观测质量。
Contains modified Copernicus Sentinel data (2025)。没有假装用一景影像完成田界精度验证。

## 4. NASA POWER历史月度气候

https://power.larc.nasa.gov/docs/services/api/temporal/monthly/
2025年12个月；请求点109.17°E，18.38°N；来自MERRA-2等网格资料，非田间气象站。
参数T2M（°C）、PRECTOTCORR（mm/day）、RH2M（%）、WS2M（m/s）。月降水总量=月平均日降水×当月日数。
仅降水进入当前需水代理核算。切换模型季度不改变卫星影像日期，不表示连续监测。

## 5. 假设数据与未知

13个主体、3个协作组、作物选择、禽类规模、价格、用水、用工、成本及模型响应均为假设。模拟主体按源OSM斑块组织，不表示推断出真实经营者。
真实作物、经营权、土壤氮、坡度一律未知，不将RGB颜色转成实测数据；基准soilFactor=1只表示不施加未经证实的空间差异。
完整选择及文件哈希见`data/evidence/quality-report.json`。

## 6. 地图库

Leaflet 1.9.4，BSD-2-Clause，`vendor/LEAFLET-LICENSE`保留全文。在线OSM按用户视图请求；不预取或批量离线缓存其瓦片。
