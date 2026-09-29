# 来源、归属与使用范围

## NASA POWER

数据接口：https://power.larc.nasa.gov/api/temporal/monthly/point

文档：https://power.larc.nasa.gov/docs/services/api/temporal/monthly/

来源元数据MERRA2/POWER；2025年1–12月，109.17°E18.38°N。原始响应保存于nasa-power-2025-raw.json，规范化数据见climate.json。不把公开网格称为田间实测。保留NASA原始元数据；遵循其数据使用与致谢说明。

## OpenStreetMap

© OpenStreetMap contributors：https://www.openstreetmap.org/copyright

许可ODbL 1.0。该独立OSM摘录按原许可保留与提供，保留获取时间、源URL与OSM要素ID。摘录范围109.145,18.365至109.205,18.397，共197要素。它是道路/水系/土地覆盖背景，不是地籍、经营权或农户资料。

在线瓦片政策：https://operations.osmfoundation.org/policies/tiles/

在线图层由用户选择后请求标准URL，只加载视口，保留浏览器Referer和归属，不预取/批量抓取/离线缓存OSM瓦片；应用缓存不处理第三方域名。自动浏览器测试只使用本地矢量，禁止自动打开OSM在线图层进行批量浏览。

## NASA GIBS / MODIS

官方接口文档：https://nasa-gibs.github.io/gibs-api-docs/

图层`MODIS_Terra_CorrectedReflectance_TrueColor`；浏览影像约250m原始分辨率。文件是渲染展示，不是包含完整波段和质量标记的分析级产品。图片显示日期与bbox来自imagery.json，所有请求与像素非空检查见imagery-quality-report.json。

2025-01-15最初请求返回全黑图，已在验证中判为不可用。采用2025-03-15非空图；检查非空不代表无云、无误差或可进行精细田块反演。不能用渲染输出1024px误称原始空间分辨率更高。

## 作者生成示例

经营资料、几何、生产系数均为确定性虚拟数据，授权随本项目使用与修改，不允许去掉其虚拟来源标签后宣称为实测。用户以后导入的私有资料不会因使用本代码而自动授权公开。

代码未包含任何私人研究提案全文、简历、身份证件、导师联系方式、密钥或真实居民经营数据。底层第三方数据许可独立于本项目代码许可。
