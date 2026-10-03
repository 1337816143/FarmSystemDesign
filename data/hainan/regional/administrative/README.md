# 海南／三沙公开科学字段审计：净化复现包

冻结数据日期：2026-10-03。此包仅含经字段筛选的OSM输入、必要的PBF抽取子集、重建脚本和哈希。原始未筛选快照、旧ZIP与原PBF均未包含，也不提供私有原始材料的下载路径。

## 字段筛选

保留源标签：`name`、`name:zh`、`name:zh-Hans`、`name:zh-Hant`、`name:en`、`place`、`natural`、`type`、`boundary`、`admin_level`、`division_code`、`old_name`、`alt_name`。即使在此列表中，含URL或域名形式的标签值也被删除。

任意source、comment、note及其他非许可标签和贡献者账号元数据均已去掉。主输出中的来源链接由OSM对象类型与数字ID构成，指向正式OpenStreetMap对象页面。名称、版本时间、许可、几何、坐标、135个有效面代表点完全保留；2个无效源面仍无代表点，未修复。

`sanitization-input-manifest.json` 记录每份输入／发布数据的 `original_source_sha256` 与 `sanitized_sha256`，以及删除字段位置、域名、被删除值的SHA-256。重复删除值按文件／字段／值SHA分组，但保留全部字段位置。**日志不含被删除的原始值或分享URL。** 哈希用于来源追踪，不代表原始未筛选文件也可公开下载。

## 完全离线复现

需要Python 3、GDAL/OGR Python bindings和pyproj；从净化XML重组装时还需本地 `ogr2ogr`。

```bash
python3 verify_package.py
python3 check_public_fields.py
python3 build_audit.py --reassemble --output-dir ./output
python3 verify_outputs.py --output-dir ./output
```

`build_audit.py` 只读取包内净化输入；参数仅控制输出目录和是否从净化XML重组装行政面。省略 `--reassemble` 会复用包内已经净化的组装GeoJSON。没有网络请求，不接收原始PBF或未筛选材料，也不重新访问任何源注记链接。

此包制作时，在独立输出目录执行了上面的重组装路径。7份输出与交付的统一净化版本逐字节一致。环境：Python3.13.5、GDAL3.10.3、pyproj3.7.1。其他版本的几何引擎或序列化可能影响字节哈希，应明确核查差异。

`expected-output-sha256.json` 是7份统一发布文件的哈希；`package-sha256.json` 是包内输入和脚本的哈希；ZIP整体哈希另行提供。输出里重建的 `sha256-manifest.json` 清点该输出目录，不属于7份固定业务比较。

## 科学与行政范围

- 三沙父关系为OSM relation2833102，共12个面片，西沙6753150为2片、南沙6753263为8片、中沙6753119为2片。四者有效，环闭合，父面与三个OSM子对象的并集相等；没有bbox补画
- OSM是社区参考数据。源几何仅涉及源贡献者定义的部分范围，且含海域，不是官方完整行政边界、陆地掩膜或主权认定。三沙面面积约52,229.86km²含海域，不能当岛屿面积或官方海域统计
- 中沙是旧OSM单列层级，不能当第三个现行市辖区。民政部2020公告的政府网站转载说明西沙、南沙两区及西沙代管中沙：https://mzj.panjin.gov.cn/2020_04/20_14/content-63560.html
- 137条是具名OSM对象、126种名称，含主岛、岛群、岛体、礁盘及重复名称，不是137个独立岛屿。135条有效面可供定位／点抽样；2条无效保留表中。南部南沙岛礁本体、点状／无名对象与完整岛礁普查仍未解决
- 日期与源对象编辑时间不是官方勘界日期。经字段筛选不改变几何、数值、覆盖事实或这些限制

## 许可

© OpenStreetMap contributors。OSM与本包派生数据库按ODbL-1.0提供：
https://opendatacommons.org/licenses/odbl/1-0/
https://www.openstreetmap.org/copyright

重用时应保留归属、许可说明及适用的相同许可要求。ODbL不等于公共地图审查、官方行政界或统计分配口径已验收。OSMF对争议地区的说明：https://osmfoundation.org/w/images/d/d8/DisputedTerritoriesInformation.pdf
