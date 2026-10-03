# 海南影像覆盖证据审计 / Hainan imagery coverage evidence audit

本包把“来源图幅已索引”“实际质量层抽样”“实际 RGB 小窗读取”和“现有预览像素核对”分开。522 景、170 个 MGRS 栅格不是 170 座岛，也不能推出海南全省陆地已覆盖。

## 文件

- `coverage-audit.json`：完整逐网格/逐景/逐预览证据与限制
- `grid-index.geojson`：由真实 EPSG、affine transform、shape 推出的 170 个栅格图幅；保留投影坐标下的精确角点，WGS84 边每 1 km 加密转换；不是 bbox 冒充陆地边界
- `grid-audit.csv`：170 网格简表；SCL 状态和 RGB 状态分列
- `scene-audit.csv`：522 景、日期、原生分辨率、源 URL 和 SCL 抽样结果
- `preview-audit.csv`：main 与 10 个具名预览的人可读记录，含中英名、窗口边界、日期、实际有效/透明/无源像素数
- `preview-audit-table.md`：简洁的预览证据表与解读
- `sample-records/*.json`：可复查的真实分类值、RGB 值、读取时间、实际尺寸/投影检查或错误；用于可恢复运行
- `build_audit.py`：重现脚本；只写指定输出目录

## 重现

使用已安装有 GDAL/OSR、NumPy、Pillow 的 Python（本环境为 `/usr/bin/python3`），无需另装依赖。

离线重建已有抽样和预览审计：

```sh
/usr/bin/python3 build_audit.py --input /path/to/frozen/imagery --output /path/to/audit
```

重新读取尚未缓存的有界源样本并重建：

```sh
/usr/bin/python3 build_audit.py --input /path/to/frozen/imagery --output /path/to/audit --sample --sample-rgb --workers 12
```

若需要全新复验，指定一个新的空输出目录。脚本不会重新抓目录，也不会请求全分辨率整景栅格。HTTP Range 服务为小窗读取传输压缩 COG 块；块可能大于请求的 1 像素或 3×3 像素。网络传输字节量未做独立计量，不应把输出像素数当成网络数据量。

## 方法及状态

SCL：每景在已存在的最低分辨率 overview 上取 5×5 规则点，行列分数为 0.1、0.3、0.5、0.7、0.9，每景请求输出 25 个分类值。类别 2/4/5/6 记为可接受；1/3/7/8/9/10/11 为质量拒绝；0 为该样点无源。`sampled_accepted` 只表示至少一个 SCL 样点类别可接受，不表示 RGB 已核验。水体类别 6 也可接受，绝不等于岛存在。`sampled_quality_rejected` / `sampled_no_source` 也仅描述被抽样的点。读取失败单独为 `network_failure`，未读取为 `unverified`。

RGB：每网格选择已有候选里 `cloud_percent + 0.35*nodata_percent` 最低的一景，读取原生 10 m TCI 中心 3×3 像素，并通过真实投影像素中心坐标配对原生 20 m SCL。非零值只证明小窗包含显示值，不能认证清晰地物、岛或整景。`sampled_rgb_zero` 只表示该小窗全零，不表示该网格无影像。SCL-only 与 RGB 状态均保留。

预览：逐像素重读 alpha、status PNG、clear-count PNG、source-day PNG 与 QA NPZ，检查相互一致、元数据计数、贡献景索引、日期和 WebP SHA-256。原生 RGB 10 m / SCL 20 m 与输出 display 分辨率分开；main 约 143×152 m，五个主岛城市/山地样窗及黄岩约 20 m，其余具名近岸/岛礁样窗约 10 m。

现有元数据里的 `used_by` 仅覆盖有贡献像素的一部分来源；审计另核对预览 `sources` 全部读取记录。`has_rgb_preview_evidence` 是已有预览读取记录；`has_contributing_rgb_preview_evidence` 才表示该网格确有预览贡献像素。新的 RGB 读取另看 `rgb_source_read_verified_this_audit`。

所有范围包括海水，部分图幅可能包括范围之外陆地。10 个具名样窗不是完整岛屿清单；不据此划定行政区或主权范围。没有权威岛界、完整岛名清单以及逐岛核验分母，因此不输出全省面积统计或全省覆盖率。稀疏样点可能完全错过小岛，不能据此判断某岛不存在。

## 具名 OSM 对象扩展

新增 `named-object-audit.json` / `.csv`、`named-object-points.geojson`。135个有效源面使用 GEOS PointOnSurface，逐点确认在源面内；用实际面与栅格 footprint 相交列候选，代表点再经原生投影 transform 检查确实落在源栅格内。2个无效对象保留为无效，未修补或静默删去。

每对象最多选择3个既有2025候选景，读取包含代表点的1个原生10m RGB像元和1个原生20m SCL像元。已读到非零RGB+可接受SCL后停止新增景。瞬时失败仅对尚无可接受点值的对象作过一次低并发同景重读，原失败证据保留。先前已读的后续候选也保留，避免成功后隐藏不利观测。

有效面内的代表点不保证10/20m像元中心也落在小岛面内，因此逐次记录 `pixel_centers_inside_object`。礁盘、海水、混合海岸像元、OSM2026边界与2025影像的时间差均限制解读。对象总数不是独立岛屿数，重复名字及岛/礁叠置均保留。`query_groups` 仅用于按相交源图幅的查询组过滤，不断言行政归属。

完整重建顺序（首步重建基础审计会覆盖旧的对象扩展，后两步重新补齐）：

```sh
/usr/bin/python3 build_audit.py --input /path/to/frozen/imagery --output /path/to/audit
/usr/bin/python3 audit_named_objects.py --catalog /path/to/frozen/imagery/scene-catalog.json --inventory /path/to/named-island-reef-object-inventory.json --geometry /path/to/named-island-reef-valid-reference.geojson --audit-dir /path/to/audit
/usr/bin/python3 build_register.py --audit-dir /path/to/audit
/usr/bin/python3 verify_audit.py --audit-dir /path/to/audit --inventory /path/to/named-island-reef-object-inventory.json --geometry /path/to/named-island-reef-valid-reference.geojson
```

对象复验需要重新读未缓存点值时，为第二步增加 `--sample`；只对尚无可接受点值对象的既有失败尝试作一次重试时，再增加 `--retry-unresolved-failures`。选择新的空输出目录可避免复用旧读证据。

UI使用 `coverage-register.json` 的紧凑记录以及按需加载的 `grid-footprints.geojson`。它们不内嵌全部522景。完整来源、失败及像素证据保留在 `coverage-audit.json` / `grid-index.geojson` 以及两个 `*-sample-records` 缓存目录。OSM 数据归属 © OpenStreetMap contributors，ODbL-1.0：<https://opendatacommons.org/licenses/odbl/1-0/>。

轻量对象的 `sample_evidence` 必须与对象汇总 `status` 一致，例如质量拒绝对象展示相应质量拒绝的真实记录，不能展示另一日期的全零记录。`attempted_sample_dates` 列出全部尝试对应的影像日期（含失败）；`successful_sample_dates` 只列确实读出 RGB/SCL 像元的日期；`failed_sample_dates` 单列失败日期。来源输入参数为必填，脚本不再假定特定云端 scratch 路径。
