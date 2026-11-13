/** UI copy only. Identifiers, dates, source JSON and amounts remain opaque. */
export const DATED_EN={
'已取消文件选择；已采用输入与未采用草稿保留':'File selection cancelled; adopted input and unapplied drafts retained',
'未采用JSON草稿已保留；结果与下载只基于已采用输入':'Unapplied JSON draft retained; results and downloads use only the adopted input',
'丢弃未采用草稿并显示已采用输入':'Discard unapplied draft and show adopted input',
'已明确丢弃未采用草稿并显示已采用输入':'Unapplied draft explicitly discarded; adopted input displayed',
'恢复初始合成例并丢弃未采用草稿':'Restore the initial synthetic example and discard unapplied drafts',

'原菜单与数据版本绑定':'Original menu and dataset-version binding',
'父菜单版本、来源或资源单位上下文不匹配；请先显式移除日期关联':'Parent menu version, provenance or resource-unit context mismatch; explicitly remove the date attachment first',
'当前显示所列时段汇总结果：允许时期之间虚拟抵消，不能视为逐期可实施。':'Declared-horizon aggregate results are displayed: virtual offsets between periods are allowed and do not imply period-by-period implementability.',

'日期覆盖区间':'Date horizon',
'；“年度”引擎模式只汇总所列时段，不推算实际年用量。仍为合成日期资源诊断。':'; the “annual” engine mode only sums the declared horizon and does not estimate actual annual use. This remains a synthetic resource-timing diagnostic.',

'日期事件 → 逐期资源入口':'Dated events → period-resource input',
'纯合成日期示例；不是作物日历、实测、校准或适应策略回放':'Invented synthetic dates; not a crop calendar, observations, calibration or adaptive-strategy replay',
'选择层':'Select stratum','选择菜单':'Select menu','生成当前菜单的合成日期样例':'Generate invented dates for the selected menu','载入日期事件 JSON':'Load dated-event JSON','日期事件原始 JSON':'Original dated-event JSON','验证并预览':'Validate and preview','关闭并取消待处理操作':'Close and cancel pending operations','清除预览':'Cancel preview','确认替换所选菜单的劳动和水向量':'I confirm replacing the selected menu labor and water vectors','采用日期向量并运行全部组合':'Apply dated vectors and run all combinations','移除当前菜单的日期关联':'Remove date attachment from selected menu','日期合同尚未预览':'Date contract has not been previewed','正在验证日期合同与内容摘要':'Validating date contract and content digest','日期预览已就绪；尚未修改菜单':'Date preview is ready; the menu has not changed','请先勾选确认，再采用日期向量':'Select the confirmation checkbox before applying dated vectors','日期事件已采用并按当前模式重算':'Dated events applied and recalculated in the current mode','已显式移除日期关联；现有资源向量保留':'Date attachment explicitly removed; current resource vectors retained','当前菜单没有日期关联':'The selected menu has no date attachment','日期文件超过5 MiB；读取前拒绝':'Date file exceeds 5 MiB; rejected before reading','已载入原始日期 JSON；请验证并预览':'Original date JSON loaded; validate and preview it','当前日期操作已取消':'Current date operation cancelled','日期输入无效；详细合同原因':'Invalid date input; detailed contract reason','合成样例已生成；日期人为指定，请核对覆盖声明':'Synthetic example generated; dates are invented, review the coverage declaration','所有时期为连续半开区间 [start,end)，按本地日历日期处理；只接受 h 和 m3。必须明确完整覆盖，缺值不补零。':'Periods must be contiguous half-open intervals [start,end), using local calendar dates; only h and m3 are accepted. Explicit complete coverage is required; missing values are never zero-filled.',
'日期原输入、规则、来源和重算审计随完整归档及恢复快照保存；导入时重新核对。修改已关联资源或时期须先显式移除关联。关闭或清除预览不会移除已采用的日期记录。':'Original date input, rules, sources and recomputed audits are saved in full archives and recovery snapshots, then checked again on import. Explicitly remove an attachment before changing its resources or periods. Closing or cancelling a preview does not remove applied date records.',
'半开日期区间':'Half-open date interval','劳动 h':'Labor h','水 m3':'Water m3','守恒检查通过':'Conservation checks passed','原始来源与分配审计':'Original sources and allocation audit','数据版本':'Dataset version','日期模块版本':'Date module version','合成标记':'Synthetic evidence','内容摘要（非可信签名）':'Content digest (not a trusted signature)','完整覆盖声明':'Complete-coverage declaration','已关联菜单数量':'Attached menu count','合成日期合同检查未通过':'Synthetic date contract check failed','日期关联不一致；请先显式移除关联或修正日期输入':'Date attachment is inconsistent; explicitly remove the attachment or correct the dated input',
'日期 JSON 尚未采用。关闭或取消只取消待处理操作，已采用关联仍保留。':'Date JSON has not been applied. Closing or cancelling only cancels pending operations; applied attachments remain.',
'已准备完整结果归档并交给浏览器下载；请确认本地文件已保存':'Full audit archive prepared and handed to the browser; confirm the local file was saved',
'浏览器未能接收下载；请重试并检查下载权限':'The browser could not receive the download; retry and check download permissions',
'确认移除当前菜单的日期关联':'I confirm removing the selected menu date attachment',
'请先勾选移除确认':'Select the removal confirmation checkbox first',
};

export const DATE_ERROR_EN={
'日期格式或真实日历日期无效':'Invalid ISO format or calendar date',
'日期合同字段、版本或绑定不匹配':'Date contract fields, version or binding mismatch',
'只接受明确标为合成的日期事件':'Only explicitly synthetic date events are accepted',
'必须声明所列区间内事件完整覆盖':'Complete event coverage within the declared horizon must be asserted',
'单位必须明确为劳动 h 或水 m3':'Units must be explicit labor h or water m3',
'日期时期必须按顺序连续且不重叠':'Date periods must be ordered, contiguous and nonoverlapping',
'事件日期或区间超出所列时期，或区间非正':'Event date/interval is outside the horizon, or the interval is nonpositive',
'每种资源必须有明确的有限非负值；缺值不补零':'Each resource requires an explicit finite nonnegative amount; missing values are not zero-filled',
'必须说明分配规则、来源、参数版本和理由':'Allocation rule, source, parameter version and reason must be explicit',
'原始事件、重算审计与菜单资源向量不一致':'Original events, recomputed audit and menu resource vectors disagree',
'多个关联菜单必须使用相同日历定义':'Attached menus must use identical calendar definitions',
'内容摘要或独立重算摘要不一致':'Content digest or independently recomputed summary mismatch',
'恢复快照超过5 MiB；未下载':'Recovery snapshot exceeds 5 MiB; no download was dispatched',
'日期 JSON 解析失败':'Date JSON parsing failed',
'日期合同检查失败':'Date contract validation failed',
};
