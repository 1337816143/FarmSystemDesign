# 数据字典与导入

## 完整资源 JSON

`schemaVersion:1`, `version:string`, `crs:'EPSG:4326'`, `center:[lon,lat]`, `extent:[west,south,east,north]`, `villages:[]`, `farms:[]`, `plots:[]`。

村组：`id,name,center`，组必须非空且ID唯一。

主体：`id,name,villageId,kind,representative,center,provenance,poultry,water:[m1,m2,m3],labour:[m1,m2,m3]`。water单位m³；labour工日；当前每季度重用同一虚拟3个月资源向量，后续应改为逐时期调查值。kind允许农户/农场展示标识，不决定资源边界。representative只是示例代表，不是统计抽样权重。

地块：`id,name,farmId,geometry,areaHa,crop,locked,soilFactor,slopeDeg,soilN,provenance,geometrySource,updatedAt,note`。geometry=闭合Polygon（允许孔洞）；WGS84经纬度。crop=rice/vegetable/legume/cover/orchard/pond；locked为boolean。soilFactor为产出比例因子，不是实测理化指标；slopeDeg与soilN默认null、保留未知，**不进入本版模型计算**。

几何与属性各自保留来源，不因改了作物名称就把虚拟边界改为真实。provenance为synthetic、user-unverified、observed；geometrySource另支持public-ml-prediction与public-osm；observed只代表用户的声明，界面仍显示未核验。

校验：ID与关联、坐标范围、闭合环、含洞净面积差异（前端球面近似核对容差1%）、字段有限值、资源非负、固定活动与活动类型。导入时不进行拓扑修复、地籍认证或来源自动核验；随版本发布的基线另有Python拓扑和相互重叠检查。当前限制300主体/600地块是UI保护，不是性能/科研精度保证。

可直接从数据中心下载完整示例JSON作为模板。新增真实主体/地块请用完整模板，不会为缺失调查自动捏造经营预算。GeoJSON仅用于更新已存在ID的地块，保留完整属性。所有导入均先检查并确认替换。

## 项目备份

应用导出的文件含`application:'FarmSystemDesign'`、资源dataset、气候climate、方案plans、反馈observations与audit。导入完整备份会替换当前同类数据。单独导入资源JSON则保留历史方案，旧快照不自动更新。

## 公共气候

`records.month`: YYYY-MM；temperatureC为月平均气温°C；precipitationMmDay为月平均日降水mm/day；precipitationMmMonth为对应月总量mm；humidityPct为%；windMps为m/s。缺测保留null，不替换为“实测0”。

地理网格点109.17°E18.38°N只作演示气候背景。NASA返回几何里的高度值不是某个地块的测量高程。全区域使用同一网格气候，不能声称已表达地块微气候差异。

## v0.2.0新增与语义修订

| 字段 | 含义 |
| --- | --- |
| `plots[].geometrySource` | `public-ml-prediction`（FTW）、`public-osm`、`synthetic`、`user-unverified`或用户声明observed；不自动核验 |
| `plots[].sourceId/sourceYear/sourceUrl` | FTW源ID、2025、产品网址 |
| `geometrySha256` | 规范JSON格式源几何哈希；用于源坐标核对 |
| `sourceConfidence` | 本次全部null；500m区域质量值并非逐块正确概率 |
| `parentOsmId/osmOverlapFraction` | 源OSM关联与投影叠合比例；仅筛选，不表示经营权或准确率 |
| `representativePoint` | Shapely几何内部点，非农户住所或实测设施 |
| `areaHa` | WGS84椭球含洞净面积，1ha=15亩；不是地籍登记面积 |
| `actualCrop/actualOperator/soilN/slopeDeg` | 默认null，明确待调查 |
| `crop/farmId/soilFactor` | 模型假设，不是上列真实属性；默认soilFactor=1 |
| `villages` | 为兼容结构保留字段名；默认内容为假设协作组，不是真实行政村 |
| `nTransferIn/nTransferOut` | 逐主体跨边界内部粪肥N转入/转出；整体汇总剔除内部双计 |
| `externalNInput/externalNOutput` | 计算整体所选系统的外部N边界 |
| `applicationVersion/modelVersion/dataVersion/buildCommit` | 分别记录应用、模型、数据及构建源提交 |

默认原始图层在`data/evidence/`；v0.1的`data/public/imagery.json`与MODIS仍作为历史文件保留，但不再作为新默认影像。
