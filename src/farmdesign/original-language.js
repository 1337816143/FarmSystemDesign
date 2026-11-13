// Display translations never rename native columns, tree identities or user data.
import {FIELD_ZH,OUTPUT_ZH,humanize,pair,unitLabel} from './i18n.js';
import {request} from './api.js';
import {watchLanguage} from '../display-language.js';
const words=Object.fromEntries(`
About|关于
AboutBox|关于
Accent color|强调色
Add|添加
Add a note|添加备注
Add from repository|从资料库添加
Add new|新建组件
Add/change a photo|添加或更换照片
Allow value|允许值
AllowValue|允许值
Amount consumed|食用量
Amplitude|变异幅度
Analyse multiple farms|分析多个农场
Animal whereabouts|牲畜所在位置
Animals|畜群
Ash content|灰分含量
At site|在场时间
Attributes|属性
Baseline emission factor for continuously flooded|持续淹水基准排放因子
Belongs to|所属对象
Buildings|建筑
Buttons|按钮
C:N ration of micro-organism biomass (g/g)|微生物生物量碳氮比（克/克）
Calculate DMD from energy value|由能量值计算干物质消化率
Calculations|计算设置
Cancel|取消
Caption text|图题文字
Category number|类别编号
Check legume products in the box below|在下方勾选豆科产品
Clean|清除
Close|关闭
Colors|颜色
Column names|列名
Company Name|机构名称
Compare|比较
Completed optimization|优化已完成
Complex|复杂网络
Component type|组件类型
Constraint|约束
Context|背景
Copy all|全部复制
Copy sel|复制所选
Copy to repository|复制到资料库
Copyright|版权
Crop Marketing Survey|作物销售调查
Crop groups|作物组
Crop residue emission factor|作物残体排放因子
Crop rotations|轮作
Crops|作物
Crude protein (CP)|粗蛋白（CP）
Cultivation conditions|栽培条件
Cultivation period (days)|栽培期（天）
Current EOM value (kg/ha)|当前有效有机质（千克/公顷）
Current estimation of N fixation (kg/ha)|当前固氮估计量（千克/公顷）
Current farm|当前农场
DE parameters|差分进化参数
DM content|干物质含量
DM yield|干物质产量
Data|数据
DataInconsistent|数据不一致
Define the food pattern of the household on the basis of food groups, and their consumption. Expressed in g fresh weight per consumer unit per day.|按食物组及消费量定义家庭膳食模式。单位为克鲜重/消费单位/天。
Delete|删除
Deselect All|全部取消选择
Describe|输入描述
DesignForm|设计
Details|详细信息
Deutsch|德语
Deviation|偏差
Dietary diversity|膳食多样性
Directories|文件夹
Display fraction|显示比例
DisplayVariableForm|显示变量
Down|下移
Dry matter intake (DMI)|干物质采食量（DMI）
Dutch system (VEM/DVE)|荷兰饲料评价体系（VEM/DVE）
DvrForm|决策变量
Edit|编辑
Edit axis|编辑坐标轴
Edit/compare data|编辑或比较数据
Effective organic matter (kg/ha)|有效有机质（千克/公顷）
Efficiency of the micro-organisms (g/g)|微生物转化效率（克/克）
Emission factors|排放因子
Energy production parameters|能源生产参数
Energy production|能源生产
English|英语
Enter data|输入数据
Enter name|输入名称
Espanol|西班牙语
Estimated N fixation (kg/ha)|估计固氮量（千克/公顷）
Estimation of Effective Organic Matter (EOM)|有效有机质估算（EOM）
Estimation of N fixation|固氮估算
Evaluate|评价与约束
EvaluateForm|评价与约束
Evaluation system|评价体系
Explain|核算解释
ExplainForm|核算解释
Explore|探索优化
Explore Dietary Diversity|探索膳食多样性
ExploreForm|探索优化
Export|导出
Export farm data|导出农场数据
Factor|系数
Farm|农场
Farm data|农场数据
Feed evaluation system|饲料评价体系
Feed evaluation|饲料评价
FeedEvaluationForm|饲料评价
Font|字体
Font size|字号
Food pattern|膳食模式
FormLaborProfile|劳动时序分配
FormMain|主窗口
Fraction of fixed N in aboveground biomass N|地上部生物量氮中的固氮比例
Francais|法语
Fresh yield|鲜重产量
Functional diversity product mapping|功能多样性产品映射
Functional diversity|功能多样性
GHG parameters|温室气体参数
General|一般设置
Graphs vertical|图表纵向排列
Greenhouse gases|温室气体
Household|家庭
Households|家庭
Labor|劳动
Human nutrition settings|家庭营养设置
Human nutrition|家庭营养
Humification coefficient (per year)|年腐殖化系数
Humification coefficient of digestate (g/g)|沼液沼渣腐殖化系数（克/克）
Import|导入
Import farm data|导入农场数据
In closed barn: XXX h|封闭畜舍：XXX 小时
In open yard: XXX h|露天畜栏：XXX 小时
In pasture/stubble: XXX h|牧场或茬地：XXX 小时
Inorganic N loss during digestion (g/g)|厌氧消化期间无机氮损失比例（克/克）
Inorganic N loss from digestate after application (g/g)|沼液沼渣施用后无机氮损失比例（克/克）
Input|输入
InputForm|输入描述
Insert|插入
Insert data|插入数据
Insert or update data|插入或更新数据
Inspect|查看
Intake|采食量
Intestinally digestible protein (DVE)|小肠可消化蛋白（DVE）
Italiano|意大利语
Item name ==>|条目名称 →
Language|语言
LanguageChanged|语言已切换
Legume product N (kg/ha)|豆科产品氮量（千克/公顷）
Location|地点
Lower boundary for inclusion of dietary diversity score (DDS)|计入膳食多样性评分的下限（DDS）
Lower boundary for inclusion of nutritional functional diversity (NFD)|计入营养功能多样性的下限（NFD）
Lower heating value of CH4 (MJ/m3)|甲烷低位热值（兆焦/立方米）
Machines|机械
Fertilizers|肥料
Groups|作物组
Rotations|轮作
Main color|主色
Major division|主刻度间隔
Managed by farmer|由农户管理
Manual|使用手册
Manures|粪肥
Map entities|映射数据对象
MaxLow|最大值下限
Maximize|最大化
Maximum display|显示上限
Maximum in data|数据最大值
Maximum|最大值
Metabolizable Energy (ME)|代谢能（ME）
Methane emission|甲烷排放
Methane emission factor for crop cultivation (kg CH4/ha)|作物栽培甲烷排放因子（千克甲烷/公顷）
MinLow|最小值下限
Minimize|最小化
Minimum display|显示下限
Minimum in data|数据最小值
Minimum|最小值
Minor division|次刻度间隔
Missing|缺失
ModelInitilized|模型已初始化
Modules|模块
N content|氮含量
N yield|氮产量
Nederlands|荷兰语
Net Energy (NE)|净能（NE）
Network metrics type|网络指标类型
Network metrics|网络指标
New farm|新建农场
New item|新建条目
New|新建
Next|下一步
Nitrogen deposition emission factor|氮沉降排放因子
Nitrogen fixation emission factor|固氮排放因子
None|无
None (generic)|无（通用）
Notes|备注
Number displayed (of total)|显示数量（占总数）
Number of food items in the diet|膳食中的食物种类数
Number of iterations of optimization|优化迭代次数
Number of solutions|方案数量
OK|确定
OM yield|有机质产量
Objective|目标
Objective name (kg/ha)|目标名称（千克/公顷）
Off-farm grazing: XXX h|场外放牧：XXX 小时
Open farm|打开农场
Open|打开
Organic amendments|有机物料施用
Other N fixation as fraction of shoot N fixation|其他固氮量占地上部固氮量的比例
Other details|其他信息
Output folder|输出文件夹
Output type|输出类型
Output|输出
OuvForm|输出指标
Parameters|参数
Paste column names here (remove instruction text)|在此粘贴列名（先删除此提示）
Paste the data here from excel, copy-paste using the clipboard (remove this instruction text). The first column should contain the entity names. You can add comments in the second tab in this window.|从 Excel 复制数据并粘贴到这里（先删除此提示）。第一列填写对象名称；可在第二个选项卡添加备注。
Picture|照片
Pre-season conditions|季前条件
Pre-season water regime|季前水分状况
Probability|交叉概率
Process|处理
Product|产品
Product OM (kg/ha)|产品有机质（千克/公顷）
Proportion of CH4 in the biogas (-)|沼气中甲烷比例
Protein|蛋白质
Quantity of organic amendments applied (Mg/ha)|有机物料施用量（吨/公顷）
Ready|就绪
Farm data and model completely initialized|农场数据与模型已完成初始化
Redo|重做
Reference Intake (DRI)|膳食营养素参考摄入量（DRI）
Reference|参考值
Relate the data columns to attributes of the enitities in the database|将数据列对应到数据库对象的属性
Relative to original|相对于原方案
Release notes|版本说明
Remove|移除
Remove farm|移除农场
Reporter|报告生成
Repository|资料库
Repository - add component|资料库：添加组件
Repository - find component|资料库：查找组件
Residue OM (kg/ha)|残体有机质（千克/公顷）
Residue to product (R/P) ratio|残体与产品比（R/P）
Retention Factor (DRF)|食物保留因子（DRF）
Run|运行
Saturation Value (SV)|饱和采食值（SV）
Save|保存
Save as|另存为
Save farm as|农场另存为
Scaling factor for soil type, cultivar etc.|土壤类型、品种等的修正系数
Screen colors|界面颜色
Search in names|搜索名称
Search in notes|搜索备注
Select|选择
Select All|全选
Select a font|选择字体
Select and order the modules for the Explain window|选择并排列核算解释窗口的模块
Select farm ==>|选择农场 →
Select feed evaluation system|选择饲料评价体系
Select item ==>|选择条目 →
Select solutions|选择方案
Select the entity type|选择对象类型
Select the target farm|选择目标农场
SelectForm|选择
Selected (crop areas in ha)|已选作物面积（公顷）
Selected animals for replacement|已选替代畜群
Selected manures and fertilizers (kg)|已选粪肥与肥料（千克）
Selected pesticides (kg or L)|已选农药（千克或升）
Set display variable settings|设置显示变量
Settings|设置
Simple|简化网络
Start|开始
Surveys|调查
Text Import|文本导入
Text data|文本数据
To Excel|导出到 Excel
To file|导出到文件
Total Digestible Nutrients, or digestibility (TDN)|可消化养分总量或消化率（TDN）
Total hours|总小时数
Type of network calculations|网络计算类型
Type of organic amendment|有机物料类型
Undo|撤销
Undo all|全部撤销
Unit|单位
Up|上移
Update|更新
Value outside the range|数值超出范围
Version|版本
X axis|横坐标
Y axis|纵坐标
fields without organic amendments (kg CH4/ha/day)|未施用有机物料的田块（千克甲烷/公顷/天）
is constraint|作为约束
is objective|作为目标
kg fresh matter|千克鲜重
Yes|是
No|否
Are you sure you want to close the program?|确定关闭程序吗？
Not ready for exploration|未满足探索优化条件
Switch off network metrics calculations before starting the exploration (see menu: settings/calculations/network metrics)|开始探索优化前，请在“设置 → 计算 → 网络指标”中关闭网络指标计算。
The defined farm is not yet consistent|农场定义尚未通过一致性检查
Not all decision variables are within the selected limits (check the Variables tab in the Evaluate window)|部分决策变量超出设定范围，请检查“评价与约束”窗口中的“变量”页。
Not all objective/constraint variables are within the selected limits (check the Outcomes tab in the Evaluate window)|部分目标或约束变量超出设定范围，请检查“评价与约束”窗口中的“输出指标”页。
The number of objectives is too low (>=2 is required; can be selected in the Explain window)|目标数量不足，至少需要两个。可在“核算解释”窗口中选择目标。
Save change?|保存修改吗？
Save changes?|保存修改吗？
Data incomplete|数据不完整
Data processed|数据已处理
Error in data|数据错误
File not found|未找到文件
Confirm change|确认修改
Are you sure?|确定继续吗？
You entered less than 2 columns of data|输入数据不足两列
You have not selected a target farm|尚未选择目标农场
You have not selected an entity type|尚未选择对象类型
Component name missing|缺少组件名称
Please provide a name for the new component|请填写新组件的名称
Invalid tree node label.|树节点名称无效
Run optimization|运行优化
Do you want to save changes?|是否保存修改？
Do you want to save the changes?|是否保存修改？
Do you want to discard changes?|是否放弃修改？
Confirm change|确认修改
Confirm removal|确认移除
File name|文件名
Data Written|数据已导出
Data Read|数据已读取
Current farm data is exported to files: Text files and|当前农场数据已导出为文本文件及 XML：
Current repository data is exported to files: Text files and|当前资料库已导出为文本文件及 XML：
Browse For Folder|浏览文件夹
Select intput directory|选择输入目录
Select input directory|选择输入目录
Select output directory|选择输出目录
Choose an existing absolute folder path|请填写已存在文件夹的完整路径
Choose an open original folder dialog|请先打开原版的文件夹选择窗口
Original database is still saving. Wait for it to finish, then pull or export again.|原版数据库仍在保存，请稍候再取回或导出
Complete the active original dialog before pulling or exporting inputs|请先完成原版当前打开的对话框，再取回或导出输入
Complete the active original dialog before closing the session|请先完成原版当前打开的对话框，再关闭会话
Complete the active original dialog first|请先完成原版当前打开的对话框
Original control changed; refresh the view|原版控件已经变化，请刷新后重试
Original control is disabled|此原版控件当前不可用
Original menu item unavailable|此原版菜单当前不可用
Original UI is closed; its files are retained|原版窗口已关闭，会话文件仍保留
Choose a file listed in this original session|请选择当前原版会话文件列表中的文件
File name:|文件名
Save in|保存位置
Look in|查找位置
Open file|打开文件
Save file|保存文件
Save as type|保存类型
Files of type|文件类型
Organize|整理
New folder|新建文件夹
January|一月
February|二月
March|三月
April|四月
May|五月
June|六月
July|七月
August|八月
September|九月
October|十月
November|十一月
December|十二月
days|天
h|小时
xxx days|xxx 天
`.trim().split('\n').map(row=>row.split('|')));
const normalize=s=>String(s).replaceAll('&','').replace(/\.{3}$|…$/,'').replace(/[:：]\s*$/,'').trim();
export function originalDictionary(catalog){
 const map=new Map(Object.entries(words).map(([en,zh])=>[normalize(en).toLowerCase(),zh]));
 for(const [key,zh] of Object.entries({...OUTPUT_ZH,...FIELD_ZH})){for(const en of [key,humanize(key)])if(!map.has(normalize(en).toLowerCase()))map.set(normalize(en).toLowerCase(),zh);}
 for(const section of Object.values(catalog?.labels||{}))for(const [key,row] of Object.entries(section)){const zh=FIELD_ZH[key]||OUTPUT_ZH[key],description=normalize(row.Description).toLowerCase();if(zh&&!map.has(description))map.set(description,zh);}
 map.set('name','名称');map.set('description','说明');
 for(const section of Object.values(catalog?.labels||{}))for(const row of Object.values(section)){if(row.SIUnit&&unitLabel(row.SIUnit,'zh')!==row.SIUnit)map.set(normalize(row.SIUnit).toLowerCase(),unitLabel(row.SIUnit,'zh'));}
 return map;
}
export function originalText(text,language,map){
 if(language==='en')return text;
 const en=String(text??''),key=normalize(en).toLowerCase(),count=en.match(/^(.+?)\s+\((\d+)\)$/),zh=map.get(key)||(count&&map.has(normalize(count[1]).toLowerCase())?map.get(normalize(count[1]).toLowerCase())+' ('+count[2]+')':null);
 if(en.trimStart().startsWith('| Selected: '))return pair('| 已选：'+en.trimStart().slice(12),en,language);
 if(zh)return pair(zh,en.replaceAll('&',''),language);
 for(const prefix of ['Current farm data is exported to files: Text files and','Current repository data is exported to files: Text files and'])if(en.startsWith(prefix)&&map.has(normalize(prefix).toLowerCase()))return pair(map.get(normalize(prefix).toLowerCase())+en.slice(prefix.length),en,language);
 const unit=unitLabel(en,'zh');if(unit!==en)return pair(unit,en,language);
 return en;
}
export function originalMessage(message,language,map){
 const first=String(message??'').split(/\r?\n/)[0].replace(/^System\.[\w.]+Exception:\s*/,'');
 const directory=first.match(/^Original (Input|Output) directory is unavailable\. Restore its saved folder before reopening this session: (.+)$/);
 if(directory)return pair(`原版${directory[1]==='Input'?'输入':'输出'}目录不可用。请恢复该文件夹后重新打开会话：${directory[2]}`,first,language);
 return originalText(first,language,map);
}
export function paintOriginalLanguage(root,window,language,map){
 root.replaceChildren();if(language==='en'||window.state!=='native')return;
 for(const label of window.labels||[]){const translated=originalText(label.text,language,map);if(translated===label.text)continue;const b=label.bounds;if(!b||b[2]<8||b[3]<8)continue;
  const element=document.createElement('span');element.textContent=translated;element.title=translated;
  Object.assign(element.style,{left:b[0]+'px',top:b[1]+'px',width:b[2]+'px',height:b[3]+'px',background:label.background||'#f0f0f0',color:label.foreground||'#111',fontSize:(language==='both'?Math.min(label.fontSize||12,b[3]<24?9:11):label.fontSize||12)+'px',textAlign:label.align||'left'});
  root.append(element);
 }
}
export function setOriginalLanguage(sessionId,language,catalog){return request('original/presentation',{sessionId,language,translations:Object.fromEntries(originalDictionary(catalog))});}
let watching=false;
export function installOriginalLanguageSync(){
 if(watching)return;watching=true;
 let revision=0;watchLanguage(async language=>{const version=++revision;try{const [{sessions},response]=await Promise.all([request('original/sessions'),fetch('./data/farmdesign/author-cases-2019.json')]);const catalog=await response.json();if(version!==revision)return;await Promise.allSettled(sessions.filter(s=>s.running&&s.available!==false).map(s=>setOriginalLanguage(s.id,language,catalog)));}catch{ /* No running local original interface. */ }});
}
