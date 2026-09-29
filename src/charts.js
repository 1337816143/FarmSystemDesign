import {esc,fmt} from './utils.js';
import {CROPS} from './data.js';
export function climateChart(climate,quarter=0){
 const rows=climate?.records||[];if(!rows.length)return '<div class="empty compact">尚无公开气候数据。数据中心可尝试获取 NASA POWER；不会展示伪造气象曲线。</div>';
 const w=710,h=210,l=40,r=36,t=18,b=32,W=w-l-r,H=h-t-b,max=Math.ceil(Math.max(100,...rows.map(x=>x.precipitationMmMonth||0))/100)*100;
 let shapes='';for(let i=0;i<4;i++){const y=t+H-i*H/3;shapes+=`<path d="M${l} ${y}H${w-r}" class="chart-grid"/><text x="${l-8}" y="${y+4}" text-anchor="end">${Math.round(max*i/3)}</text>`;}
 const pts=[];rows.forEach((v,i)=>{const x=l+(i+.5)*W/12,y=t+H-(v.precipitationMmMonth||0)/max*H,height=t+H-y;if(Number.isFinite(v.precipitationMmMonth))shapes+=`<rect x="${x-12}" y="${y}" width="24" height="${height}" rx="3" fill="${Math.floor(i/3)===quarter?'#649681':'#d4e1d8'}"><title>${esc(v.month)}：${fmt(v.precipitationMmMonth,2)} mm；${fmt(v.temperatureC,2)} °C</title></rect>`;if(Number.isFinite(v.temperatureC))pts.push([x,t+H-(v.temperatureC-10)/25*H]);shapes+=`<text x="${x}" y="${h-11}" text-anchor="middle">${i+1}月</text>`;});
 const line=pts.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' ');shapes+=`<path d="${line}" fill="none" stroke="#caa46c" stroke-width="2.5"/>`+pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#caa46c"/>`).join('');
 for(const temp of [10,20,30]){const y=t+H-(temp-10)/25*H;shapes+=`<text x="${w-r+7}" y="${y+4}">${temp}</text>`;}
 return `<div class="chart-key"><span><i style="background:#649681"></i>降水量 mm / 月</span><span><i style="background:#caa46c"></i>气温 °C</span><small>2025 年历史网格数据 · 非站点观测</small></div><svg viewBox="0 0 ${w} ${h}" class="climate-chart" role="img" aria-label="2025年12个月降水和平均气温，原始数值见数据中心">${shapes}</svg>`;
}
export function composition(plots){
 const total=plots.reduce((s,p)=>s+p.areaHa,0),groups=Object.keys(CROPS).map(k=>({k,area:plots.filter(p=>p.crop===k).reduce((s,p)=>s+p.areaHa,0)})).filter(x=>x.area>0);let offset=0;
 const arcs=groups.map(g=>{const v=g.area/total*100,s=`<circle r="39" cx="50" cy="50" fill="none" stroke="${CROPS[g.k].color}" stroke-width="12" pathLength="100" stroke-dasharray="${v} ${100-v}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)"/>`;offset+=v;return s;}).join('');
 return `<div class="composition"><svg viewBox="0 0 100 100" role="img" aria-label="虚拟地块生产活动面积构成">${arcs}<text x="50" y="48" text-anchor="middle" class="donut-number">${fmt(total,1)}</text><text x="50" y="61" text-anchor="middle" class="donut-unit">公顷 · 演示</text></svg><div class="composition-legend">${groups.map(g=>`<div><span><i style="background:${CROPS[g.k].color}"></i>${CROPS[g.k].name}</span><b>${fmt(g.area,1)} <small>ha</small></b></div>`).join('')}</div></div>`;
}
export function capacityChart(balances,resource){
 const monthly={};for(const b of balances.filter(b=>b.resource===resource)){monthly[b.month]??={demand:0,capacity:0};monthly[b.month].demand+=b.demand;monthly[b.month].capacity+=b.capacity;}
 return `<div class="capacity-chart">${Object.entries(monthly).map(([m,b])=>{const ratio=b.capacity?b.demand/b.capacity:(b.demand?Infinity:0);return `<div class="capacity-row"><span>${m}月</span><div class="capacity-track"><span class="${ratio>1?'over':''}" style="width:${Math.min(100,ratio*100)}%"></span></div><strong>${fmt(b.demand)} / ${fmt(b.capacity)}</strong></div>`;}).join('')}<p class="micro">需求 / 配额 · ${resource==='水'?'m³':'工日'}；这里汇总显示，实际约束按决策单元逐月检查。</p></div>`;
}
export function paretoChart(results,selectedId){
 const points=results.candidates;if(!points.length)return '<div class="empty compact">当前约束下未找到可行候选方案。</div>';
 const all=[...points,results.baseline],xs=all.map(p=>p.totals.water),ys=all.map(p=>p.totals.margin/10000),minX=Math.min(...xs)*.9,maxX=Math.max(...xs)*1.06,minY=Math.min(...ys)-.5,maxY=Math.max(...ys)+.5;
 const w=720,h=275,l=55,r=28,t=20,b=48,x=v=>l+(v-minX)/(maxX-minX||1)*(w-l-r),y=v=>h-b-(v-minY)/(maxY-minY||1)*(h-t-b);let shapes='';
 for(let i=0;i<=4;i++){const yp=t+i*(h-t-b)/4;shapes+=`<path d="M${l} ${yp}H${w-r}" class="chart-grid"/><text x="${l-9}" y="${yp+4}" text-anchor="end">${fmt(maxY-i*(maxY-minY)/4,1)}</text>`;const xp=l+i*(w-l-r)/4;shapes+=`<text x="${xp}" y="${h-b+22}" text-anchor="middle">${fmt(minX+i*(maxX-minX)/4)}</text>`;}
 for(const p of points){const active=p.id===selectedId;shapes+=`<circle data-candidate="${esc(p.id)}" cx="${x(p.totals.water)}" cy="${y(p.totals.margin/10000)}" r="${active?7:4.5}" fill="${active?'#ca994e':'#699d88'}" stroke="white" stroke-width="1.6" role="button" tabindex="0" aria-label="候选${esc(p.id)},收益${fmt(p.totals.margin)}元，用水${fmt(p.totals.water)}立方米"><title>${esc(p.id)} · 收益 ${fmt(p.totals.margin)}元 / 水 ${fmt(p.totals.water)}m³</title></circle>`;}
 const bs=results.baseline;shapes+=`<rect x="${x(bs.totals.water)-5}" y="${y(bs.totals.margin/10000)-5}" width="10" height="10" fill="#8b9294"><title>同情景基准安排${bs.feasible?'':'（资源约束不满足）'}</title></rect><text x="${l}" y="12">收益 / 万元</text><text x="${w-r}" y="${h-4}" text-anchor="end">用水量 / m³ →</text>`;
 return `<div class="chart-key"><span><i style="background:#699d88"></i>候选集非支配方案</span><span><i style="background:#ca994e"></i>当前查看</span><span><i style="background:#8b9294"></i>同情景基准</span></div><svg class="pareto-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="收益与用水权衡散点图，点可选择；完整数值见方案表">${shapes}</svg><p class="micro">图中仅画出两个指标；非支配筛选同时考虑收益、水、氮收支余量绝对值、能量与劳动。最多展示36个排序后的方案。</p>`;
}
