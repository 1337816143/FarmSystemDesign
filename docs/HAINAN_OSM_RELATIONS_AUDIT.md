# 三沙行政参考对象与海南具名岛礁对象审计

审计日期：2026-10-03。采用公开OSM来源；新增原始响应共2,185,289 bytes，并复用固定版本的Geofabrik海南提取。

发布文件仅保留科学字段白名单，过滤非必要来源注记、任意外链和贡献者账号元数据；原始未筛选快照不在公开包中。几何、名称、版本时间和代表点不变。详见[公开字段筛选与离线复现](../data/hainan/regional/administrative/README.md)。

## 可以补上的内容

已从 **OSM 官方 API** 取得三沙市父关系的真实几何。这里“官方 API”指 OpenStreetMap 自己的 API，不是政府官方行政数据。

| 对象 | OSM relation | 版本／源关系最后编辑日期 | 面片数 |
|---|---:|---|---:|
| 三沙市 | [2833102](https://www.openstreetmap.org/relation/2833102) | 280／2026-08-31T06:49:16Z | 12 |
| 西沙区 | [6753150](https://www.openstreetmap.org/relation/6753150) | 107／2026-05-28T03:09:55Z | 2 |
| 南沙区 | [6753263](https://www.openstreetmap.org/relation/6753263) | 100／2026-07-26T12:56:49Z | 8 |
| 中沙群岛的岛礁及其海域 | [6753119](https://www.openstreetmap.org/relation/6753119) | 55／2024-09-21T09:48:07Z | 2 |

四对象的外环引用均完整，几何有效、环闭合，输出所有坐标均逐点来自下载的源节点。三沙父关系20条 outer way，恰等于三个 OSM 子对象 outer way 的集合；父面与三子面并集的对称差为空。交付的三沙几何直接由父 relation 组装，并非自行拼成的 bbox 或猜测行政范围。

此前 Geofabrik 已组装缓存只含西沙和中沙两对象，其几何与本次 API 结果拓扑一致；南沙及三沙完整父关系的几何在该缓存中缺失。现在可补“有真实 OSM 父面可用”的技术缺口，但不能把这一补充写成“完整法定三沙行政界已解决”。

## 必须保留的范围说明

- 三个 OSM 子对象的源标签都把范围限制为贡献者所称“中国控制部分”。本审计没有独立核实该控制状态，也不据此判断主权；区域存在领土／管辖争议。OSMF 对争议地区的说明明确区分数据库表达与法律正确性：[OSMF 原始说明](https://osmfoundation.org/w/images/d/d8/DisputedTerritoriesInformation.pdf)
- 三沙父面的椭球面积约 **52,229.86 km²，包含海域**。此值只是所取 OSM 面积，不能当陆地面积、真实管辖海域统计、全海南陆地掩膜或岛屿面积总量
- 面片数是 OSM 几何组成数，不能当岛屿数。南沙8片不意味着完整南沙群岛、8个岛屿或已经取得其土地覆盖有效掩膜
- [民政部2020公告的政府网站转载](https://mzj.panjin.gov.cn/2020_04/20_14/content-63560.html)说明三沙设西沙区、南沙区，西沙区代管中沙岛礁及其海域。OSM 仍单列中沙旧名称／代码460323，不能据此创建第三个现行市辖区，也不能把这些下级对象同19个市县统计聚合行并列
- 下载日期、关系编辑日期和成员节点／线的编辑日期不是现势法定勘界日期
- 不启用县级分区着色、统计下推或面积分配，除非另有明确且通过核对的口径

前端标签：**“三沙 OSM 社区部分范围参考（2026-10-03获取，含海域；非官方完整行政界）”**。以无填充或淡边线的可选参考层呈现，并将法定完整行政界、完整岛礁清单和土地掩膜的状态继续保留为缺口。

## 具名岛礁对象清单

从已有 PBF 的 GDAL multipolygons 层筛选有名称且 place=island/islet 或 natural=reef 的对象，得到 **137条 OSM 对象、126种名称**。含海南岛主岛、近岸岛屿及部分离岛／礁盘。没有做行政归属推断，也没有把同名岛体、礁盘及多部件归并为真实岛屿。因此不能宣传为137个独立岛屿或完整岛礁普查。

135条源几何有效，交付有效几何层；两条源关系自相交：中建岛礁盘 relation 11169306、珊瑚岛礁盘 relation 19122386。它们仍在清单中并有来源链接，但从有效几何层排除，未做自动修面。名为中建岛的有效海岸线 way 14235138 是另一个对象，不受该礁盘关系失败影响。

该清单不含点状／无名对象，且 Geofabrik 此提取缺少南部南沙地理范围。南沙行政父面的新获取不补出岛礁本体。每项保留源对象ID、版本、时间、类型、源中文／英文名及 bbox；bbox 只用于定位审计，从未作为行政面。有效面另提供 OGR PointOnSurface 代表点 [lon,lat]，已验证落在源几何中，可供定位或抽样，不是行政中心或整个对象的像元统计；无效面代表点为 null。source_date 表示快照获取日，osm_timestamp 表示源对象编辑日。

## 文件与复现

- `sansha-osm-reference-20261003.geojson`：三沙父关系，1个Feature、12个面片
- `sansha-osm-subareas-20261003.geojson`：3个OSM子对象，带旧中沙层级说明
- `audit.json`：关系成员、源标签、坐标完整性、几何、范围和缺口审计
- `named-island-reef-object-inventory.json` / `.csv`：137条有来源的对象记录
- `named-island-reef-valid-reference.geojson`：135条有效源多边形，非完整陆地掩膜
- `raw/`：公开字段筛选后的 API 几何输入和 PBF 抽取子集；任意来源注记和贡献者账号元数据已移除，未筛选快照不包含于公开复现包
- `fetch-log.json`、`sha256-manifest.json`：取得时间、URL、bytes与SHA-256；`sources.json`：来源角色及核验结果
- `build_audit.py`：仅从包内净化输入无网络重建，需要GDAL/OGR、pyproj；`--reassemble` 从净化XML重新组装几何，不接受未筛选PBF或其他原始输入
- `verify_package.py`、`check_public_fields.py`、`verify_outputs.py`：核对包内哈希、公开字段白名单和7份重建输出
- `sanitization-input-manifest.json`：仅记录字段位置、删除原因、域名及值哈希，不保留被移除值或访问链接

所有派生 OSM 数据按 **ODbL-1.0** 提供，保留 **© OpenStreetMap contributors**，并链接[许可证](https://opendatacommons.org/licenses/odbl/1-0/)及[OSM版权说明](https://www.openstreetmap.org/copyright)。允许的数据库复用及相同许可义务不等于公共地图审查／官方地图表达许可已经满足。本来源审计没有核定官方地图表达要求。

仍需：版本明确、坐标基准明确、授权与发布范围明确的权威完整行政矢量；定义清楚的全岛礁参考名录及潮位／干陆口径；之后才能逐岛审查遥感有效像元与覆盖率。用户若已有这些资料，可在云环境导入并继续核对。

[下载便携复现包](../data/hainan/regional/administrative/reproduce-administrative-audit.zip)，包含净化几何输入、已抽取子集、参数化脚本与SHA清单，不含未筛选快照或整份PBF。
