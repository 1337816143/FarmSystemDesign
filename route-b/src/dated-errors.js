/** Bilingual explanations. Machine values/source JSON remain untouched. */
import {preserveText} from './i18n.js';
export function datedErrorSource(error){
 const raw=String(error?.message??error);let key;
 if(error instanceof SyntaxError)key='日期 JSON 解析失败';
 else if(raw==='日期文件超过5 MiB；读取前拒绝')return raw;
 else if(/parent menu\/dataset/.test(raw))key='父菜单版本、来源或资源单位上下文不匹配；请先显式移除日期关联';
 else if(/source\/audit|source\/menu vectors/.test(raw))key='原始事件、重算审计与菜单资源向量不一致';
 else if(/identical period calendar/.test(raw))key='多个关联菜单必须使用相同日历定义';
 else if(/invalid calendar date|ISO calendar date/.test(raw))key='日期格式或真实日历日期无效';
 else if(/synthetic-only|evidence|event evidence/.test(raw))key='只接受明确标为合成的日期事件';
 else if(/coverage declaration/.test(raw))key='必须声明所列区间内事件完整覆盖';
 else if(/metric\/unit/.test(raw))key='单位必须明确为劳动 h 或水 m3';
 else if(/ordered, contiguous/.test(raw))key='日期时期必须按顺序连续且不重叠';
 else if(/outside horizon|nonpositive period/.test(raw))key='事件日期或区间超出所列时期，或区间非正';
 else if(/finite nonnegative|explicit zero|aggregate exceeds|invalid allocated/.test(raw))key='每种资源必须有明确的有限非负值；缺值不补零';
 else if(/allocation|event.source|parameterVersion/.test(raw))key='必须说明分配规则、来源、参数版本和理由';
 else if(/integrity|summary\/recomputed/.test(raw))key='内容摘要或独立重算摘要不一致';
 else if(/exceeds 5 MiB/.test(raw))key='恢复快照超过5 MiB；未下载';
 else if(/Dated .* contract:/.test(raw))key='日期合同字段、版本或绑定不匹配';
 else key='日期合同检查失败';
 return `${key} (${preserveText(raw)})`;
}
