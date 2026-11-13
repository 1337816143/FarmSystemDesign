# FarmSystemDesign Windows 便携版

把本文件夹整体复制到另一台 Windows 10/11 的 Intel/AMD 64 位电脑，双击 **启动Farm.cmd**。网页会自动打开；结束使用时双击 **停止Farm.cmd**。无需安装 Python、Node、Office 或 FarmDESIGN，也无需联网。不要只复制 HTML。

## 文件夹和数据

- `app/`：完整网页、地图数据、A/B 路线和 FarmDESIGN 工作台。
- `engine/`：原作者 FarmDESIGN 4.21.5.0、数据库、资源和手册。原始 DLL 与数据库按来源哈希保留。
- `runtime/python/`：Python 官方嵌入式环境，包含许可证。
- `UserData/workspace.json`：路线 A 工作区、FarmDESIGN 当前项目、已保存方案和语言设置。应用每次持久保存时同步写入此文件；`workspace.previous.json` 保留前一次成功版本。
- `UserData/Projects/`：可在浏览器“另存为”时选择此目录保存导出的 JSON/XML/ZIP。浏览器默认下载目录不会自动变成该目录。
- `UserData/Logs/`：启动、环境检查和计算错误记录。
- `UserData/OriginalInterface/`：原版窗体的独立会话、MDB 输入、输出和取回前备份。

进入 FarmDESIGN → **原版界面**，可选择“在浏览器中打开原版”或“打开原版软件窗口”。两种入口使用同一会话数据库，能够切换。点击“取回原版项目输入”后，网页项目才采用原版中的修改；取回前自动保留网页输入备份。详细范围和验收见 `app/docs/FARMDESIGN_ORIGINAL_INTERFACE.md`。

原版切换输入、输出文件夹后，网页的取回、下载、导出会跟随实际目录。浏览器内的原版文件夹选择窗口提供完整路径输入。保存或关闭会话会把外部目录内容保留在会话的 `DirectoryCopies/` 中；复制整个便携版后，从这些随行副本继续使用。原位置重开则保留所选的外部路径。复制前请先保存并关闭会话或正常停止本地服务。

便携版网页右下角显示“已保存到本文件夹”，表示文件写入成功。复制前结束优化、保存项目并运行“停止Farm.cmd”，再复制整个文件夹，数据即可一起带走。同一份文件夹不要同时由两台电脑在共享盘上运行。

顶部中文、英文、中英同显为全局显示偏好，覆盖输入标签、结果、优化、提示、B 路线与离线页，并跟随 `UserData` 保存。便携状态提示也按所选语言显示；它是界面提示，不是额外的计算结果。原始数据、项目名称和机器字段代码保持原样。语言修复更新只替换应用文件，不覆盖已有 `UserData`。

旧本地网址 `127.0.0.1:4174` 的浏览器存档不会自动迁入：请先从旧工作台导出项目 JSON，然后在便携版导入并保存。便携版不会读取其他浏览器配置或擅自覆盖原工作区。路线 B 原本只在页面内存保留的临时操作仍按原设计处理，需要时使用其已有导出功能。

## 电脑条件和启动故障

目标电脑需要 Windows 10/11 x64、.NET Framework 4.8 或更高版本、系统自带的 32 位 Windows PowerShell 与 Jet 4.0，以及可用的 Edge/Chrome 等现代浏览器。正常 Windows 11 和较新 Windows 10 通常具备这些系统组件；精简版、企业策略受限版或较早 Windows 10 需要先检查。启动时会实际读取数据库进行检查，不会自动安装软件或修改注册表。

本包不适用于 macOS、Linux、手机或 Windows ARM。请放在可写的本地文件夹，不要在压缩包内部直接运行。无需管理员身份。

默认使用 `http://127.0.0.1:4184/#farmdesign`，只允许本机访问。端口被其他程序占用时会自动选择空闲端口，项目数据仍从本文件夹恢复。重复启动会打开本文件夹已有服务；不会结束其他 Farm 实例。

双击“检查运行环境.cmd”会执行原版作者案例并检查预算黄金值和 20 组核算结果。若启动失败，查看 `UserData/Logs/server.log`。若需要恢复损坏的存档，请先保留原文件，再从 `workspace.previous.json` 或自行导出的项目恢复，不要直接删除原数据。

## 来源与范围

原模型来自 Ditzler et al. 2019 作者公开软件与数据，DOI：<https://doi.org/10.17632/n3sk27ggwf.1>。出处、版本和哈希见“来源与构建信息.json”。本包是本地适配与便携包装，作者程序身份保持不变。

软件测试不构成海南实测校准。原版引擎需要本包的本地服务保持运行；GitHub Pages 静态网页不能执行原程序。当前交付不推送 GitHub、不连接外部计算服务。

系统组件参考：<https://learn.microsoft.com/en-us/dotnet/framework/install/on-windows-and-server>。Python 嵌入式分发参考：<https://docs.python.org/3/using/windows.html#the-embeddable-package>。
