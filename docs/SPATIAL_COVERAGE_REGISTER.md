# 海南覆盖清单 / Hainan coverage register

2026-10-03 · application v0.3.10 · public-source display evidence only

## What can be checked on the map

The coverage register contains 172 true Sentinel-2 raster footprints, 530 selected 2025 scenes, the existing main-island overview plus 10 named validation windows, and 137 named OSM polygon objects. These are different units. A scene grid is not an island; several OSM objects may overlap or represent an island group. The register is not an exhaustive Hainan island census and does not report a provincial or whole-island completeness percentage.

Use “View coverage register” below the map. The three lists show verified windows, all source grids and named OSM objects. Search by name or identifier, filter the geographic query group, then locate an entry. Footprint outlines load only when requested. Object dots show a source polygon’s representative point; the two invalid source geometries stay in the table without invented dots. CSV and full JSON downloads retain the underlying records.

查询分组只用于检索，不表示行政或主权归属。源图幅轮廓由真实投影、像元尺寸及栅格shape计算；它不是有效像元边界。对象点是有效源面内的PointOnSurface，不是岛屿中心、测站或完整面积验收。表中的日期区分OSM源编辑时间与影像实际读取日期。

## What was read

- All 530 SCL files were read at 25 regular points in their existing coarsest overview: 13,250 categorical samples. Every source CRS, transform and shape matched the frozen catalog. Accepted classes include water, so this alone proves neither RGB quality nor an island’s existence.
- One native 10 m RGB 3×3 window per grid was paired with native 20 m SCL. Of 172 tiny windows, 170 had nonzero RGB and an accepted SCL class, one was quality rejected and one was all zero. Each result applies only to those sampled cells.
- All 11 existing preview artifacts were read again. Their alpha, quality status, source-date, clear-count, contributing-source and checksum records agree. Preview pixel size differs: the main overview is about 143×152 m; named windows are about 10–20 m. The main rectangle contains sea and source margins; the earlier 99.122% result uses a separate inferred main-island mask and remains a display-grid statistic.
- Of 137 named OSM objects, 135 have valid source polygons. The initial audit tried up to three selected scenes per object. A bounded follow-up of nine explicit gaps added eight scenes and two grids: 134 representative points now have nonzero RGB and accepted SCL, Nan Island remains quality rejected, and two invalid geometries remain unsampled. Eight repaired points also passed the map’s 60 m cloud guard. The two identified catalog omissions now have actual source values. Seven of the 134 have a 10 m RGB or 20 m SCL pixel center outside the small source polygon. They are highlighted as possible coastal mixing. Partial source-request failures are retained even where a different scene yielded a value.

The audit’s categorical SCL samples do not apply the map renderer’s separate 60 m cloud/shadow guard. Therefore a table’s accepted sample can still appear transparent in the stricter rendered map. RGB values may depict reef water, mixed coasts or haze. The 2026 OSM snapshot and 2025 imagery also differ in time. None of these checks establishes actual crop identity, ownership or local classification accuracy.

Detailed method and source evidence: [imagery audit](HAINAN_COVERAGE_AUDIT_METHODS.md), [full record](../data/hainan/regional/coverage/coverage-audit.json).

The portable replay is delivered in two lossless parts: [part 1](../data/hainan/regional/coverage/coverage-audit-repro.tar.xz.part001), [part 2](../data/hainan/regional/coverage/coverage-audit-repro.tar.xz.part002). Save both parts, the [checksum manifest](../data/hainan/regional/coverage/coverage-audit-repack.json) and the [offline joining script](../data/hainan/regional/coverage/join-coverage-replay.py) in one folder. Run `python3 join-coverage-replay.py`, then `python3 -m tarfile -e coverage-audit-repro.tar.xz replay` and follow the archive's README. The script checks each part and the complete archive before writing it. All 2,054 member files retain the exact verified bytes; only the outer compression and transport packaging changed.

## Why an area can look blank

The live line below the map now reports the currently visible tiles separately from a selected window’s historical audit. It distinguishes no local overview, no selected source footprint, SCL/cloud rejection, source no-value, unread quality flags, source request/decoder failure and a 45-second read deadline. A retry action is available for read failures. Moving away removes old tile evidence; a selected-window summary is explicitly labeled as staying with its selection.

从12级起，影像按当前视窗读取原始COG，最多尝试12个候选源；15–18级放大显示。达到候选上限仍透明的像元不宣称查全。低缩放离岛区域没有整组概览时会说明原因，具名预览并不限制高缩放任意平移读取。概览透明原因直接读取现成质量PNG；质量PNG读取失败时保留有效RGB并单列未知原因。

Live counts are rendered tile pixels, including view edges and sea. They are not a land area, a unique count of native source pixels or a provincial coverage percentage. A source-service failure is never evidence that the source lacks data. Mainland-China connection performance remains untested.

## Administrative reference and remaining gaps

The existing 18 main-island OSM aggregates remain available. A separate toggle adds the actual OSM Sansha parent relation 2833102, source version 280 edited 2026-08-31, with 12 valid polygon parts. Its original outer ways match the three OSM child objects for Xisha, Nansha and Zhongsha. Coordinates come directly from source nodes, without invented boundaries or geometry repairs. The source-defined polygons include sea and describe only partial reference scope. The Zhongsha child retains an old administrative label; it is not a third current district. [Relation audit and license](HAINAN_OSM_RELATIONS_AUDIT.md).

可继续解决的具体事项：按本清单的失败记录重试服务、对仍未通过质量规则的南岛检查后续来源、对2个无效OSM对象等待上游修正或补合法有效来源。南岛本轮已额外检查12个2025候选，不放宽质量规则。这些不能通过把邻近陆地值填进海域或补画行政面解决。

仍需权威可转载资料才能闭环的事项：完整、去重且带几何与时间的岛礿名录；官方现势行政辖界及适用转载许可；可按岛划定分母的海岸/陆地面。当前OSM提取不是南部南沙完整地物普查，不据其缺项认定某岛不存在。DSM原生约30 m、降水原生0.05°约5.5 km、土壤模型250 m仍按各自来源支持范围显示；小岛源无值、零值未解析、粗网格无法单岛解析等限制不因影像补全而消失。

## Source rights and separation from the farm model

Imagery: modified Copernicus Sentinel data (2025), Earth Search / Element 84 public COG, Copernicus free, full and open policy. OSM-derived objects and administrative references: © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), with source identifiers and changes retained. Product-specific environmental licenses and time/resolution records remain in [the phase-two audit](SPATIAL_COVERAGE_PHASE2.md).

All additions are regional evidence displays. The original 110 FTW geometries, scenario attributes, optimizer, farm data version and model version are unchanged.

[本轮9处定向核验及真实RGB快视](TARGETED_OFFSHORE_COVERAGE_FIX.md)：8处代表点通过，1处保留质量缺口。公开派生OSM资料仅保留科学所需标签；非必要任意来源/评论链接未纳入公开回放包，原始与净化来源哈希分别记录。
