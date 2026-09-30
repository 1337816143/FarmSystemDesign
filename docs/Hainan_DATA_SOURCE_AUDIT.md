# 海南空间数据源核验（2026-10-01）

本文件只审计可复现的数据来源与适用边界，不把候选数据等同于已完成的海南分析。建议第一版地图限定为**海南岛陆域的农业系统背景**；「海南省」在统计年鉴中还包含三沙等单元，不能用海南岛两个栅格瓦片代表整个省域。

## 可立即使用的最小组合

| 图层 | 首选来源及已核验入口 | 时间／分辨率 | 授权和网站署名 | 在平台中的正当用途与限制 |
| --- | --- | --- | --- | --- |
| 土地覆被 | [ESA WorldCover 数据页](https://esa-worldcover.org/en/data-access)；海南岛主岛跨 3° × 3° 的 `N18E108`、`N18E111` 两个瓦片。直接 HTTPS 对两瓦片均实测 HTTP 200：[`N18E108`](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N18E108_Map.tif)、[`N18E111`](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N18E111_Map.tif)。前者 Content-Length 43,115,466 字节。 | 2021 v200、10 m、EPSG:4326、11 类，COG。 | CC BY 4.0；地图署名使用发布方要求的 `© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium`，数据引用 Zanaga et al. (2022), DOI 10.5281/zenodo.7254221。 | 展示树木、耕地、建成区、水体、红树林等**覆被类别**。耕地类不等于法定耕地、地籍土地用途、作物种类、播种面积或实际经营面积。2020 v100 与 2021 v200 算法不同，不能直接把两图差分解释成土地变化。 |
| 表层土壤背景 | [ISRIC SoilGrids 2.0](https://docs.isric.org/globaldata/soilgrids/index.html) 的 [WCS](https://docs.isric.org/globaldata/soilgrids/wcs.html)。`phh2o` 服务的 GetCapabilities、海南小窗 GetCoverage 均实测 HTTP 200；具体请求见下文。 | 250 m 全球模型预测；六个深度段（0–5、5–15、15–30、30–60、60–100、100–200 cm）。 | CC BY 4.0，署名 ISRIC — World Soil Information；方法引用 Poggio et al. (2021), *SOIL* 7:217–240。 | 第一版可做 0–5 cm pH 和土壤有机碳（SOC）预测图，附预测分位区间。它们是模型预测，不是海南实测样点或地块施肥建议；不应当作为农场优化模型的已验证参数。ISRIC 当前明确称 REST API 暂停，网站不应依赖客户端逐点 REST 查询。 |
| 市县名称与统计单元 | [《海南统计年鉴 2024》](https://stats.hainan.gov.cn/tjj/tjsu/ndsj/2024/202412/P020250116308974141111.pdf) 表 1-1 列 2023 年 19 个市县／市辖区域的官方统计行与土地面积；[国家统计局区划代码编制规则](https://www.stats.gov.cn/sj/tjbz/gjtjbz/202302/t20230213_1902741.html)说明县以上采用国家标准行政区划代码。 | 年鉴 2023 年口径；代码必须按所用年份保存。 | 官方公开页面；引用年鉴、表号和年份，几何授权另行处理。 | 作为分析键和图表标签。**代码或市县名单并不提供可复用的边界几何**。年鉴 19 行中海口、三亚等地级市聚合其辖区，不能直接与 ADM2 县级多边形逐项连接。 |
| 边界草图候选 | [geoBoundaries CHN ADM2 元数据 API](https://www.geoboundaries.org/api/current/gbOpen/CHN/ADM2/) 实测返回 `CHN-ADM2-17275852`、`boundaryYearRepresented: 2017`、2391 个全国单元；其 [ZIP 下载地址](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/CHN/ADM2/geoBoundaries-CHN-ADM2-all.zip) 经 302 跳转后实测 HTTP 200，8,776,218 字节。 | 几何代表 2017 年，ADM2。 | 此层元数据给出的原始许可证为 PDDL v1.0；geoBoundaries 项目要求署名。网站标注 `Boundary illustration: geoBoundaries (2017), non-official geometry` 并指向版本化元数据。 | 只用于初期非官方、非现势的**位置示意**。必须先检查海南要素完整性、命名和拓扑，并建立人工核对的 `geometry_id ↔ 年鉴统计单元` 对照；多辖区市需依行政层级融合。若无法核对，不以填色图表达市县统计量，而用市县点位或列表。 |

### SoilGrids 已验证的小窗口请求

以下请求返回 HTTP 200、`image/tiff`（测试窗口的文件为 623 字节）。正式提取应按裁剪范围、输出 CRS 和目标分辨率调整，保存原始 TIFF、请求 URL、响应元数据及处理日志。服务实例按属性分开；换属性时同时替换 `map` 和 `COVERAGEID`。

```text
https://maps.isric.org/mapserv?map=/map/phh2o.map&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=phh2o_0-5cm_mean&FORMAT=GEOTIFF_INT16&SUBSET=X(109.50,109.51)&SUBSET=Y(19.00,19.01)&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/4326&OUTPUTCRS=http://www.opengis.net/def/crs/EPSG/0/4326
```

[ISRIC 属性与单位表](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html)要求把整数存储值除以转换因子，才得到常用单位：`phh2o ÷ 10 = pH`；`soc ÷ 10 = g/kg`；`clay/sand/silt ÷ 10 = %`；`bdod ÷ 100 = kg/dm³`。`Q0.05`、`Q0.5`、`Q0.95`、`mean` 是不同预测图层，必须明确图例具体使用哪一个。`Q0.05–Q0.95` 是模型预测区间，不是采样误差条。若用土壤数据校验模型，应另寻有使用权的实测样点，且检查其与 SoilGrids 建模样点是否独立。

## 其他数据的优先级与门槛

- **官方国土调查**：[自然资源部三调说明](https://www.mnr.gov.cn/dt/zb/2021/qggtdc/jiabin/)说明以 2019-12-31 为标准时点建立国家、省、地、县四级国土调查数据库；公开报道并不等于图斑库可下载或可在站点再发布。若日后取得授权的海南图斑，才可把 ESA 的“覆被”视图升级为经核对的土地利用视图。
- **官方基础地理边界**：[国家基础地理信息中心](https://www.ngcc.cn/dlxxzy/gjjcdlxxsjk/)列有「境界与政区」矢量数据集，但该简介不是免许可下载入口。取得具体文件及公开使用条件前，不把它列为已接入图层。政府底图服务还应按服务条款接入，不能抓取瓦片冒充本地开源数据。
- **海南实测土壤**：[海南省农业农村厅 2026 年三普进展](https://agri.hainan.gov.cn/hnsnyt/ywdt/zwdt/202604/t20260413_4058581.html)显示土壤类型图和属性图仍在抽核与整改阶段；该消息没有给出公开下载或再发布授权。它可成为未来本地校验资料的获取线索，不能现在标为已接入实测值。
- **更新的土地覆被**：[ESA 页面](https://esa-worldcover.org/en/copernicus-lcfm-operational-successor-esa-worldcover)指向 Copernicus LCFM 作为 WorldCover 的运营后继。未来需要 2021 之后年份时，先核对其具体产品年份、许可证、覆盖范围及分类体系；不要把不同产品直接差分。

## 建议的网站实施次序

1. **固定研究范围与年份**：`Hainan main island, land only, 2021` 作空间示意范围；官方 19 市县统计表另存各自年份。对离岛／三沙单列“未纳入海南岛陆域地图”，避免在省域标题下遗漏。
2. **预处理而非浏览器读原始全量**：下载两个 WorldCover COG，按明确边界或岛陆域掩膜裁剪；生成低缩放等级的分类瓦片／概览图和面积汇总表。保留分类编码与像元分辨率，面积统计用合适的等面积投影，不将经纬度像元数直接当面积。10 m 全分辨率数据不宜直接提交 GitHub Pages 仓库。
3. **土壤先做两层**：用 WCS 获取 pH、SOC 的 0–5 cm `mean` 与 `Q0.05/Q0.95`，按官方因子换算，预计算适于网页的可视化瓦片或分区摘要，同时显示深度、单位、预测性质与不确定度。土壤点值只在明确显示像元级预测时查询，不当作地块观测。
4. **边界分级处理**：第一步用非官方轮廓说明位置，避免统计量市县填色；第二步建立由年鉴单元、代码年份、几何版本构成的人工核对表；通过检查后才启用填色分级图。地图应有资料来源、年份、比例尺、图例、缺测标记和下载／再现说明。
5. **为每个衍生文件留溯源**：`source_url`、下载时间、源版本、许可、原始文件 SHA-256、投影、裁剪范围、转换公式、图例、处理脚本版本、统计单元匹配方法。将真实数据视图与现有合成农场示例分开标识；真实背景图不自动验证农场规划输出。

## 本次端点核验范围

- 2026-10-01：ESA `N18E108`、`N18E111` COG 的匿名 HTTPS HEAD 均为 200；`N18E108` 为 43,115,466 字节。尚未在本次审计中完成裁剪、分类频数或精度检验。
- 同日：ISRIC `phh2o` WCS GetCapabilities 为 HTTP 200，GetCoverage 小窗口为 HTTP 200、`image/tiff`；尚未完成全岛提取与坐标／无数据值检查。
- 同日：geoBoundaries CHN ADM2 元数据 API 和 ZIP 地址可访问，ZIP HEAD 为 HTTP 200；本次审计未确认其中海南各要素与 2023 年鉴 19 行是否匹配。该数据必须保持“2017 年第三方示意边界”标签。

## 本站已接入的派生文件（2026-10-01）

上述清单是接入前的来源审计。本节记录随后实际完成的处理：

- `data/hainan/landcover-preview.png` 是 ESA WorldCover 2021 v200 通过官方所列 Terrascope WMS 获取的 1200 × 1080 像素地图预览。范围为经度 108.5–111.5°E、纬度 17.8–20.5°N；该图是着色后的 RGB/PNG，**不能**用来计算分类面积或像元级类别。请求 URL、SHA-256 和图层身份保存在 `data/hainan/atlas-manifest.json`。页面中约 300 m/像素指的是这一预览图的显示采样量级，不是原始 10 m 分类数据的名义分辨率。
- `data/hainan/soil-ph-preview.png` 与 `soil-ph-values.png` 从 ISRIC `phh2o_0-5cm_mean` WCS GeoTIFF 生成。原始返回栅格 1327 × 1130 像素、EPSG:4326、531705 个非零像元；零值按本次海域／无覆盖背景处理。灰度 PNG 保留源整数，鼠标查询以整数除 10 显示 pH。本站裁剪窗非零值为 pH 4.1–7.1，**只是模型预测像元的范围**，不是海南实测统计或行政区均值。完整请求、源文件 SHA-256、编码规则和处理范围在 `soil-ph-metadata.json`；处理脚本为 `tools/build_hainan_soil.py`。
- `data/hainan/soil-soc-preview.png` 与 `soil-soc-values.png` 从同范围的 `soc_0-5cm_mean` WCS GeoTIFF 生成。源整数除以 10 后是 g/kg；PNG 的红、绿通道保存原整数的低、高字节。本站裁剪窗非零预测范围为 12.9–123.3 g/kg，**不是实测浓度分布统计**。完整源哈希、请求、编码及范围见 `soil-soc-metadata.json`。pH 与 SOC 均未接入农场模型。
- `data/hainan/county-reference-2017.geojson` 从 geoBoundaries CHN ADM2 ZIP 的简化文件筛出 18 个岛内历史单元，源 ZIP SHA-256 已写入该 GeoJSON。源文件包含 `Qiongshanshi`、`Shanyashi` 等旧称，足以证明它不能与现势市县统计表直接连接。页面默认关闭这层；开启仅显示历史位置参考，不据此算行政区面积。处理脚本为 `tools/build_hainan_reference_boundaries.py`。
- 原始 COG、WCS TIFF 和全国 ZIP 保存在被 `.gitignore` 排除的 `data/hainan/source/`；GitHub Pages 只发布小型派生图层。若复算，须先按上文 URL 重新取得原始文件，再运行相应脚本并核对哈希及产品版本。全省离岛和三沙**未纳入**本岛地图裁剪框。

本批图层先把“真实背景资料可视化”从候选变为已展示。后续 v0.3.8 增加主岛范围的探索性分类面积；市县统计单元匹配、市县覆被面积、土壤分区均值、实测样点核验及模型响应参数仍未完成。

## v0.3.7 复核结论

已将 [海南市县统计单元与边界连接审计](HAINAN_ADMIN_STAT_UNITS_AUDIT.md) 接到地图侧栏。2024 版年鉴中的 2023 年行政表有 19 行（含三沙），农业表有 18 行；网站历史几何也有 18 面，但含琼山市、缺五指山市，不能按相同数量做连接。现有地图继续只展示覆被、土壤预测和默认关闭的历史定位参考。

| 待办 | 状态 | 仍需的证据 |
| --- | --- | --- |
| 真实覆被与表层土壤地图 | 已接入网页预览；v0.3.8 补充主岛探索性类别面积 | 市县面积与海南本地分类精度检验仍未完成 |
| 现势市县统计单元及可复用边界 | 未完成；发现历史单元错配 | 获准使用的现势几何、代码年份和逐项人工核对 |
| 市县覆被面积与土壤分区统计 | 未完成 | 合法匹配的几何、等面积处理、无数据掩膜与不确定性 |
| 海南区域优化与跨尺度验证 | 未完成 | 经营、资源、措施响应、代表性样本和独立验证资料 |

## v0.3.8 主岛覆被面积：探索性产品汇总

`tools/build_hainan_landcover_summary.py` 读取 ESA WorldCover 2021 v200 的 `N18E108` 与 `N18E111` 两幅原始 10 m COG，源 URL 和 SHA-256 写入 `data/hainan/landcover-main-island-summary.json`。该脚本先以最邻近方式读取约 100 m 概览，选取包含 19.0°N、109.8°E 的四邻域连通**非水陆地**，填充被陆地包围的水面空洞，作为产品派生的海南主岛掩膜；再将掩膜应用于原始 10 m 分类值，以 WGS84 椭球经纬度像元面积逐行汇总。零值不计入分类面积，脚本报告掩膜内零值数。

本次得到的产品分类面积为 **33,856.70 km²**；树木覆盖 26,586.75 km²（78.53%）、耕地覆被 3,257.48 km²（9.62%）、草地 1,987.17 km²（5.87%）、建成区 1,138.64 km²（3.36%）、永久水体 570.46 km²（1.68%）。其余类别与精确像元数见 JSON。将主岛掩膜概览改为约 200 m 时，掩膜面积为 33,912.34 km²；100 m 掩膜为 33,856.70 km²，差 55.64 km²（约 0.16%）。此敏感性只反映掩膜采样，不是分类精度或总体不确定区间。

这些数值是**2021 年遥感分类产品的主岛探索性面积**。连通性和海岸均来自产品本身，不是法定岛屿或行政边界；不包括分离的小岛和三沙，也没有海南本地样点精度验证。耕地覆被面积不等于自然资源部门耕地面积、年鉴耕地面积、播种面积或农户经营面积。不得用这个结果替代市县法定统计或作为模型可分配土地约束。网站图幅仍是含邻近海陆的裁剪窗，图表则只使用上述主岛掩膜；两者范围不同。
