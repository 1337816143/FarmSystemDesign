# 海南全域地图扩展：来源、实际覆盖与剩余缺口

更新：2026-10-03。应用0.3.9，区域资料版本 hainan-regional-2026-10-03-r1。数据获取与处理在云端完成，原农场FTW几何、合成经营属性与模型不改。

## 当前能做什么

- 主岛整幅2025 Sentinel-2真彩色概览，以及本岛任意高缩放视窗的原始COG按需读取；不再只依赖原2025-03-22崖州小裁剪
- 浏览海南岛及近岸、西沙、中沙、南沙四个地理检索范围，切换2025完整分类/Crops=5、地表高程、年降水和土壤
- 本岛18个OSM社区聚合参考面包含五指山，海口下辖琼山区不混作同级单位。原2017历史边界保留为单独选项，默认都不打开
- 查看各窗口真实有效、质量拒绝、nodata和来源日期记录。无法获得的值保持透明，不从附近陆地或粗总览补到细窗

以上不等于获得“全部海南每个岛礁每个像元、最新权威行政界、全10米环境数据”。离岛以已检索原始COG和具名像元审计为证；穷尽岛礁清单、完整三沙行政聚合面、现势权威可转载边界仍是缺口。四个查询矩形包含海域和其他陆地，不是省界、海域主张或行政统计范围。

## 数据与分辨率

| 图层 | 原始支撑 | 本网站实际展示 | 时间与限制 |
|---|---|---|---|
| Sentinel-2 C1 L2A RGB | B02/B03/B04及TCI10m；SCL20m | 主岛约143×152m轻量总览；城市样窗约20m、离岛样窗10m；12级起任意视窗COG，15–18级仅放大 | 2025多日期首个质量接受像元拼图，非单日或中值合成；保留云/缺测，SCL不能保证无薄云或薄雾 |
| Esri/Impact Observatory/Microsoft2025 | 原始UTM10m分类，Crops=5 | 官方分类显示服务按瓦片；原生COG用于面积与一致性审计 | 最新已核实完整年度2025；非地籍/法定耕地；树高作物常归Trees |
| ESA WorldCover2021 | 10m分类 | 保留原300m左右历史预览与原始类别统计 | 2021历史基线；不同产品面积差不当作变化 |
| Copernicus GLO-30 DSM | 1arcsecond，约30m | 全主岛/西沙/中沙约247m概览，南沙约989m概览；10个具名原生30m细窗 | 主体2011–2015，可能有更早填补；是包含树木/建筑的地表模型，非现势裸地地形 |
| CHIRPS3 final2025降水 | 0.05°，约5.5km | 同源原始粗格网及数值查询 | 年总量mm/年；不是10m气候或小岛独立观测；未加入温度或完整气候模型 |
| SoilGrids2.0 pH/SOC | 名义250m，0–5cm预测均值 | 本岛完整原有WCS格网恢复、具名窗口核验 | 非年度土壤调查或田间实测；离岛8次新WCS请求均无预测，不捏造完整离岛表面 |
| OSM社区参考界 | WGS84原关系几何 | 18个本岛聚合面约207KB，未简化坐标 | 2026-10-03下载不证明每条关系现势。非权威界；不用于县域统计分配 |

完整机器记录：

- [统一地理范围](../data/hainan/regional/aoi-inventory.json)
- [影像候选COG与分页记录](../data/hainan/regional/imagery/scene-catalog.json)
- [影像实际预览、日期和像元状态](../data/hainan/regional/imagery/preview-manifest.json)
- [主岛影像实际覆盖审计](../data/hainan/regional/imagery/previews/main.json)
- [50条环境栅格及解码清单](../data/hainan/regional/environment/environment-manifest.json)
- [OSM几何与19单位名录审计](../data/hainan/regional/county-osm-audit.json)

## 主岛实际影像覆盖的分母

主岛概览是2200×1980真实RGB输出，并非目录缩略图。本次522个候选覆盖170个MGRS格；主岛实际读取63景。100m近似主岛掩膜内概览格质量接受率99.122%，没有来源观测缺口，余13,686格因质量拒绝而透明。这不是原生10m无云率或精度认证。其主岛质控分母来自2025 Esri分类约100m连通岛掩膜，填充内湖后近邻投影至概览格；这仍不是官方海岸/行政边界。覆盖数值以主岛JSON中的 approx_main_island_land_audit 为准，分别列出：接受显示格、存在观测但被质量掩膜拒绝、没有来源观测。

矩形accepted百分比包含海水，不能替代陆地完整率。概览掩膜内百分比也不能冒充所有原始10m陆地像元的无云率。具名窗同样只是有范围的验证；岛名窗口的矩形不等于岛陆地。

TCI是提供方的8bit显示产品，不按反射率scale/offset重复转换。B02/B03/B04的原始DN需先屏蔽0，再按资产记录的scale0.0001、offset−0.1处理；本次没有由RGB计算NDVI、作物品种或权属。

概览接受SCL2/4/5/6，拒绝0/1/3/7/8/9/10/11；云/云影/卷云3/8/9/10加3个原生SCL像元（60m）缓冲。主岛概览先保守聚合到80m，再投至约150m显示格；命名细窗保留更细格网。前端高缩放读取原生20m SCL并同样使用60m邻域拒绝。不同显示格网/选景顺序仍可能产生不同细部缺口，不能据此判变化。

跨日期、传感器和光照使MGRS接缝及海面色差可见。未做将真实差异抹平的无依据填洞；SCL漏检的薄云/雾仍可能可见。

## 2025遥感作物类面积，非官方耕地面积

[原生像元汇总](../data/hainan/regional/landcover2025-main-island-summary.json)读取官方49Q COG的10m分类值，按推测主岛掩膜计数。有效分类约33,728.50km²，其中Crops=5约9,211.3868km²（27.3104%）；云类约4.2971km²，掩膜内nodata0。100m与200m掩膜总面积差0.2241%。区域是主岛，不含分离离岛或三沙。

面积为EPSG:32649投影格网面积（每原生像元100m²），有UTM投影畸变及海岸/掩膜不确定性，不称严格等面积/地籍面积。源COG136,217,448bytes，SHA256见记录。

第二遍73行条带逐类布尔计数与首遍1024块bincount完全一致；本岛8处共15个实际出现的Trees/Crops/Built源像元与官方2025原值identify全部一致。[交叉记录](../data/hainan/regional/landcover2025-crosscheck.json)。这只验证来源/计算一致，不是本地分类准确率，也不证明真实作物、耕地或经营权。

WorldCover2021原9.6%与Esri2025的27.3%来自不同分类定义、模型与掩膜。严禁把这个差值解释为耕地增长、树木减少、土地转用或遥感精度优劣。

## 行政层级和边界

官方年鉴行政表的19个市县聚合名称用于名录核对；海口/三亚/三沙/儋州与15省直辖县级单位是统计聚合层，不把海口下辖琼山再列为同级。

今天下载的Geofabrik公开Hainan OSM PBF为9,874,644bytes，保留SHA。GDAL组装18个本岛名称匹配的关系面，全部有效、无大于1m²交叠、坐标未改；包括五指山。聚合多边形投影总面积约37,300.23km²，包含来源关系定义的水域/海岸范围，不是本岛陆地面积，也不能拿来作为像元完整率分母。海岸及小岛是否完整未获权威核验。

三沙完整聚合面缺失。Geofabrik区域提取范围并不覆盖南沙南部，不能靠把西沙/中沙局部关系拼一起冒充三沙。保留2017旧层只供历史位置参考，不改名伪装现势。两个边界层均非权威现势行政矢量，也不支持县域分级设色统计。数据开放许可不自动解决地图公开使用的法律合规要求。

## 浏览器实现与网络

轻量本地清单和已处理预览优先。RGB高缩放通过COG Range读取视窗，不把数GB源影像塞进源码；最多2个渲染任务并发，45秒整瓦片截止，离屏/换层取消、有限LRU缓存。原始源不支持Range时拒绝整文件下载。来源服务器和公网失效时显示错误/透明，不由旧图冒充新图。

显示格逐像元WebMercator→WGS84/源UTM转换；避免把大范围经纬度图直接拉伸到3857。类别使用近邻，土壤/降雨格网保留实际空间支撑，不能因页面放大变成10m。最细覆盖窗口的透明/nodata不能被粗总览反填。

Copernicus原始S3当前无浏览器CORS，DSM使用同源概览和本次原生细窗；没有绕过CORS或假称任意地块都是30m网页DSM。

外部Esri/Sentinel-2请求会向提供方发送地图范围或COG字节范围及IP/来源站点等常规请求信息，不发送项目农户姓名、备注、完整经营资料或模型方案。新增图层仍不进入农场模型。

云网络可读、HTTP206和CORS成功不代表中国大陆可访问。中国大陆网络/手机性能尚未实测。

## 来源与许可

- [Copernicus Sentinel资料政策](https://sentinels.copernicus.eu/web/sentinel/sentinel-data-access)；[Earth Search C1](https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a)。Contains modified Copernicus Sentinel data(2025)，Earth Search/Element84提供公开COG
- [Esri/Impact Observatory/Microsoft2025](https://livingatlas.arcgis.com/landcover/)，原始数据CC BY4.0；在线ImageServer另适用Esri服务条款
- [Copernicus DSM许可](https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model)，保留DLR/Airbus/EU/ESA归属
- [CHIRPS3](https://chc.ucsb.edu/data/chirps3)，CHC，DOI10.15780/G2JQ0P，CC BY4.0及官方声明的公共领域放弃
- [SoilGrids](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html)，ISRIC，CC BY4.0
- [OSM](https://www.openstreetmap.org/copyright)、[Geofabrik](https://download.geofabrik.de/asia/china/hainan.html)，© OpenStreetMap contributors，ODbL1.0；该参考数据库及其衍生数据库按ODbL提供
- GeoTIFF.js2.1.3、Proj42.15.0，官方npm固定版，MIT许可证和下载完整性信息随vendor保留

处理脚本、JSON、PNG数值解码和测试随源码保存。未新建账户、凭据、数据库、付费服务或改变用户电脑配置。
