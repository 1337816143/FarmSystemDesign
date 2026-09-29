# 数据字典与导入

## 完整资源 JSON

`schemaVersion:1`, `version:string`, `crs:'EPSG:4326'`, `center:[lon,lat]`, `extent:[west,south,east,north]`, `villages:[]`, `farms:[]`, `plots:[]`。

村组：`id,name,center`，组必须非空且ID唯一。

主体：`id,name,villageId,kind,representative,center,provenance,poultry,water:[m1,m2,m3],labour:[m1,m2,m3]`。water单位m³；labour工日；当前每季度重用同一虚拟3个月资源向量，后续应改为逐时期调查值。kind允许农户/农场展示标识，不决定资源边界。representative只是示例代表，不是统计抽样权重。

地块：`id,name,farmId,geometry,areaHa,crop,locked,soilFactor,slopeDeg,soilN,provenance,geometrySource,updatedAt,note`。geometry=无洞闭合Polygon；WGS84经纬度。crop=rice/vegetable/legume/cover/orchard/pond；locked为boolean。soilFactor为产出比例因子，不是实测理化指标；slopeDeg与soilN仅演示展示，**不进入本版模型计算**。

几何与属性各自保留来源，不因改了作物名称就把虚拟边界改为真实。provenance/geometrySource为synthetic、user-unverified、observed；observed只代表用户的声明，界面仍显示未核验。

校验：ID与关联、坐标范围、闭合环、面积差异（允许12%）、字段有限值、资源非负、固定活动与活动类型。当前不进行拓扑修复、重叠识别、地籍认证或来源自动核验。当前限制300主体/600地块是UI保护，不是性能/科研精度保证。

可直接从数据中心下载完整示例JSON作为模板。新增真实主体/地块请用完整模板，不会为缺失调查自动捏造经营预算。GeoJSON仅用于更新已存在ID的地块，保留完整属性。所有导入均先检查并确认替换。

## 项目备份

应用导出的文件含`application:'FarmSystemDesign'`、资源dataset、气候climate、方案plans、反馈observations与audit。导入完整备份会替换当前同类数据。单独导入资源JSON则保留历史方案，旧快照不自动更新。

## 公共气候

`records.month`: YYYY-MM；temperatureC为月平均气温°C；precipitationMmDay为月平均日降水mm/day；precipitationMmMonth为对应月总量mm；humidityPct为%；windMps为m/s。缺测保留null，不替换为“实测0”。

地理网格点109.17°E18.38°N只作演示气候背景。NASA返回几何里的高度值不是某个地块的测量高程。全区域使用同一网格气候，不能声称已表达地块微气候差异。
