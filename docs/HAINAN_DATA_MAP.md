# 海南数据地图：图层、清晰度与下载

打开网站的“海南数据地图”，先选海南岛，再切换图层。月降水、月均温还需选择月份。原农场模型的110个局部预测田块保留在农场界面；海南数据地图用于浏览区域资料。

## 现在有哪些数据

| 图层 | 数据时期 | 原始分辨率与网页显示 | 范围与限制 | 资料入口 |
|---|---|---|---|---|
| 卫星真彩色 | 2025年20个实际贡献日期，跨日期拼接 | RGB原生10m，SCL20m排云；本岛114个连续派生细块约9.4–9.5×10.02m，另有56个分级预览。图上14级起用最细块，更高放大不增加源细节 | 覆盖推测本岛掩膜及300m沿岸选块缓冲；三沙与其他离岸范围保留单独来源。仍有源质量筛选空白、接缝、色差与残留薄云，不能称无云无缝或逐岛完整覆盖 | [连续本岛影像清单](../data/hainan/regional/imagery-local/manifest.json) · [覆盖CSV](../data/hainan/regional/imagery-local/coverage-grid.csv) · [数据与质量说明](../data/hainan/regional/imagery-local/README.md) · [原始场景目录](../data/hainan/regional/imagery/scene-catalog.json) |
| 2025完整土地覆被 / Crops=5 | 2025完整年度 | 原始10m；本站连续本岛派生格网约9.4–9.5×10.02m。低、中缩放使用约151×160m、38×40m分级图 | 本岛及近岸查询框已分块；三沙保留官方服务入口。Crops仅为一个模型类别，树木类可能包含果园、橡胶等 | [当前本地数据清单](../data/hainan/regional/landcover-local/landcover-local-manifest.json) · [覆盖CSV](../data/hainan/regional/landcover-local/coverage-grid.csv) · [数值与方法](../data/hainan/regional/landcover-local/README.md) |
| 地表高程DSM | 主体观测2011–2015，可能含更早填补 | Copernicus GLO-30，1角秒、约30m；本岛连续110块。低缩放使用约247m概览 | 本岛按窗口显示连续约30m数据；含植被和建筑，垂直基准EGM2008。三沙部分岛礁无源或为未解释零值 | [连续本岛清单](../data/hainan/regional/environment/dsm-main-native-manifest.json) · [覆盖CSV](../data/hainan/regional/environment/dsm-main-native-coverage.csv) · [覆盖状态图](../data/hainan/regional/environment/dsm-main-native-coverage-preview.png) |
| 逐月降水 | 2025年1–12月 | CHIRPS v3，0.05°、约5.5km；mm/月 | 本岛、近岸与各离岸地理组分别保留。海域和不少小岛没有该产品的预测值；放大不会增加细节 | [逐月气候清单](../data/hainan/regional/climate/climate-manifest.json) · [气候数据说明](../data/hainan/regional/climate/README.md) |
| 逐月2米气温 | 2025年1–12月 | NASA POWER / MERRA-2，0.625°经度×0.5°纬度，约55–70km；°C | 本岛有30个真实源网格点，各月分别取值；离岸区域保留源模型海域格。只能表达区域气候背景，不能解析农田或小岛局地温度 | [逐月气候清单](../data/hainan/regional/climate/climate-manifest.json) · [各地理窗口核验](../data/hainan/regional/climate/named-window-climate-audit.json) |
| 表层土壤pH / 有机碳 | SoilGrids 2.0模型产品，非某一年的实测调查 | 名义250m，0–5cm深度预测均值；有机碳g/kg | 已有本岛连续查询格网，但仍有源预测空白；离岛可能完全没有预测。未包含全部土层、全部土壤属性或田间实测 | [环境数据清单](../data/hainan/regional/environment/environment-manifest.json) · [pH数据说明](../data/hainan/regional/environment/soil-ph-main.json) · [有机碳数据说明](../data/hainan/regional/environment/soil-soc-main.json) |
| 行政边界参照 | OSM于2026-10-03取得的快照；另保留2017历史层 | 矢量边界，可单独勾选 | 本岛18个聚合参考面；三沙单独提供部分范围参考，含海域。下载日期不代表每条边界都已更新，仍缺权威现势GIS县界 | [本岛参考GeoJSON](../data/hainan/regional/county-osm-reference-20261003.geojson) · [三沙参考GeoJSON](../data/hainan/regional/administrative/sansha-osm-reference-20261003.geojson) · [来源核验](../data/hainan/regional/administrative/audit.json) |

2021土地覆被和2025-03-22局部卫星快照保留供历史参照。2021与2025的分类定义、模型和统计范围不同，不能直接把面积差解释为土地变化。

## 空白和“模糊”分别意味着什么

主岛的连续分块由本站提供，放大后按视窗读取，避免每次直接拼接远程原始文件。低缩放仍使用轻量分级图，约151×160m、76×80m、38×40m、19×20m，14级起读取约9.5×10m细图。在推测本岛掩膜内，约99.918%的显示格通过本次RGB/SCL规则；其余294847格因质量筛选保留透明，没有在该掩膜内发现来源无值或RGB全零格。这是显示格接受比例，不是官方陆地面积、独立无云准确率或全省逐岛覆盖率。

- 卫星影像的低缩放概览经过降采样；只有更细的数据加载后才能看到更多细节。真实云、云影和无值不会被生成的纹理补满。多日期拼接也可能出现色差和接缝
- Crops模式只显示类别5，其他有效类别会透明。切到“完整分类”可区分其他地类、云类10与无数据0；透明不等于没有耕地
- 高程0m是一个原始源值，可能对应水面等，不能自动当作缺测。当前预览不对源零值着色。网页数值PNG按整数米编码，量化误差≤0.5m；点查显示0m不能单凭该数值证明原始源恰好为0。推测本岛掩膜内约0.207%为源零值，来源不存在的区域另行标记
- 土壤、降水、温度应按原始格网解释。土壤预测空白并不全在水面，也不能由附近格点随意补齐。粗气候格网显示成方块是其实际空间尺度，不是10m数据没有加载
- 读取失败会显示错误和重试提示；来源无值、质量排除与网络失败应分别判断。目录数量和若干样点通过均不能证明逐岛完整覆盖

数据清单中的preview、values或values_file分别指向显示图和可解码数值图；有geotiff字段且文件已提供的气候记录还可下载原数值窗口。DSM原始浮点分块属于单独资料包，未随网页核心下载提供的文件不应被当作可点击下载。分类PNG保存原类码，不能直接当彩色影像使用。

## 数据来源与适用范围

- [Copernicus Sentinel-2 C1 L2A公开影像](https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a)：真彩色与排云来源；定量反射率分析应使用原波段，网页有损压缩图用于显示
- [Esri / Impact Observatory / Microsoft年度土地覆被](https://livingatlas.arcgis.com/landcover/)：CC BY 4.0。遥感Crops类别不是法定耕地、地籍或经营权数据
- [Copernicus GLO-30说明](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM)：地表高程与数据许可、归属说明
- [CHIRPS v3](https://chc.ucsb.edu/data/chirps3)与[NASA POWER月数据](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/)：分别提供月降水与源模型月均温
- [ISRIC SoilGrids](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html)：CC BY 4.0的土壤模型预测；网页接入不等于本地实测验证
- [OpenStreetMap / Geofabrik海南提取](https://download.geofabrik.de/asia/china/hainan.html)：社区参考几何，ODbL。另可查看[2025版海南标准地图发布说明](https://www.csgpc.org/detail/26391.html)；其JPG/EPS制图产品不能直接替代用于空间统计的GIS县界

海南本岛与西沙、中沙、南沙及定向离岸窗口分别说明覆盖。地理查询矩形可能包含海域和其他陆地，不是行政界；当前没有穷尽每个岛礁的完整名录。以上图层用于查看来源证据，不自动成为农场经营模型的参数、实测田块或权属结论。
