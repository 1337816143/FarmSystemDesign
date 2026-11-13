/**
 * Opt-in recovered-manure N/P allocation. No default P coefficients or field claims.
 * This is a homogeneous-material splitter, not a whole-farm P or soil process model.
 */
const EPS=1e-9;
const total=values=>values.reduce((a,b)=>a+b,0);
const fail=message=>{throw new Error(`Manure N/P contract: ${message}`);};
const nonnegative=(value,label)=>{
  if(!Number.isFinite(value)||value<0)fail(`${label} must be finite and nonnegative`);
};

/** Keep both elements together when limiting a fixed-composition material. */
export function splitManureByNP({nitrogen,phosphorus,availableNFraction,availableNCapacity,totalPCapacity}){
  for(const [key,value] of Object.entries({nitrogen,phosphorus,availableNCapacity,totalPCapacity}))nonnegative(value,key);
  if(!Number.isFinite(availableNFraction)||availableNFraction<=0||availableNFraction>1)fail('availableNFraction must be in (0,1]');
  // Short-circuit zero demand before division: tiny N * availability can underflow to 0.
  // Divide capacity by availability first. Its possible +Infinity means N is nonlimiting;
  // unlike capacity / N first, this order cannot underflow before the availability step.
  const fraction=nitrogen>0&&availableNCapacity>0
    ?Math.max(0,Math.min(1,(availableNCapacity/availableNFraction)/nitrogen,phosphorus>0?totalPCapacity/phosphorus:1)):0;
  const applied={nitrogen:nitrogen*fraction,phosphorus:phosphorus*fraction};
  const result={fraction,applied,remaining:{nitrogen:nitrogen-applied.nitrogen,phosphorus:phosphorus-applied.phosphorus},availableN:applied.nitrogen*availableNFraction};
  for(const [label,value] of Object.entries({fraction,...applied,remainingN:result.remaining.nitrogen,remainingP:result.remaining.phosphorus,availableN:result.availableN}))nonnegative(value,`split result ${label}`);
  return result;
}

function readContract(rows,contract,quarter){
  if(!contract||contract.schema!=='FarmSystemDesign.ManurePhosphorusContract'||contract.schemaVersion!==1||contract.unit!=='kg elemental P'
    ||contract.period!==`2025-Q${quarter+1}`||!Array.isArray(contract.bindings))fail('unsupported schema, unit or period');
  const byId=new Map();
  for(const b of contract.bindings){
    if(!b||typeof b.farmId!=='string'||!b.farmId||byId.has(b.farmId))fail('missing or duplicate farm binding');
    nonnegative(b.recoveredManureP,`${b.farmId}.recoveredManureP`);
    nonnegative(b.remainingApplicationCapacityP,`${b.farmId}.remainingApplicationCapacityP`);
    if(!['synthetic','user-unverified','observed','literature-transfer'].includes(b.provenance)||typeof b.source!=='string'||!b.source.trim())fail(`${b.farmId} requires provenance and source`);
    byId.set(b.farmId,b);
  }
  for(const row of rows)if(!byId.has(row.id))fail(`missing P binding for selected farm ${row.id}`);
  return byId;
}

/**
 * Match legacy own-first/group-order allocation while imposing an additional P cap.
 * Rows are ephemeral evaluation rows; inputs/dataset/contracts are never mutated.
 * The caller's N availability and transfer cost remain explicit existing assumptions.
 */
export function distributeManureNP(rows,mode,contract,quarter,{availableNFraction,transferCostPerKgN}){
  if(!['independent','cooperative','centralized'].includes(mode))fail('unsupported sharing mode');
  if(new Set(rows.map(r=>r.id)).size!==rows.length)fail('duplicate selected farm');
  nonnegative(transferCostPerKgN,'transferCostPerKgN');
  const bindings=readContract(rows,contract,quarter),groups=new Map(),transfers=[];
  for(const row of rows){
    const b=bindings.get(row.id);
    for(const field of ['manureRecovered','nNeed','transferCost','nTransferIn','nTransferOut'])nonnegative(row[field],`${row.id}.${field}`);
    row.manureRecoveredP=b.recoveredManureP;row.manureApplicationCapacityP=b.remainingApplicationCapacityP;
    row.manureApplied=0;row.manureRemaining=row.manureRecovered;
    row.manureAppliedP=0;row.manureRemainingP=row.manureRecoveredP;
    row.pTransferIn=0;row.pTransferOut=0;
    const key=mode==='independent'?row.id:mode==='cooperative'?row.villageId:'region';
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }
  function apply(donor,receiver){
    const portion=splitManureByNP({nitrogen:donor.manureRemaining,phosphorus:donor.manureRemainingP,availableNFraction,
      availableNCapacity:Math.max(0,receiver.nNeed-receiver.manureApplied*availableNFraction),
      totalPCapacity:Math.max(0,receiver.manureApplicationCapacityP-receiver.manureAppliedP)});
    const {nitrogen:n,phosphorus:p}=portion.applied;
    let nextTransferCost=receiver.transferCost;
    if(donor.id!==receiver.id&&n>0){
      const charge=n*transferCostPerKgN;
      nonnegative(charge,`${receiver.id} transfer charge overflow`);
      nextTransferCost=receiver.transferCost+charge;
      nonnegative(nextTransferCost,`${receiver.id} accumulated transfer cost overflow`);
    }
    donor.manureRemaining=portion.remaining.nitrogen;donor.manureRemainingP=portion.remaining.phosphorus;
    receiver.manureApplied+=n;receiver.manureAppliedP+=p;
    if(donor.id!==receiver.id&&n>0){
      receiver.transferCost=nextTransferCost;receiver.nTransferIn+=n;donor.nTransferOut+=n;
      receiver.pTransferIn+=p;donor.pTransferOut+=p;
      // quantity remains kg N for legacy consumers; P stays attached to this same physical flow.
      transfers.push({from:donor.id,to:receiver.id,resource:'回收粪肥氮',quantity:n,unit:'kg N',phosphorusQuantity:p,phosphorusUnit:'kg elemental P'});
    }
  }
  for(const group of groups.values()){
    for(const row of group)apply(row,row);
    for(const receiver of group)for(const donor of group)if(donor.id!==receiver.id)apply(donor,receiver);
  }
  for(const r of rows)for(const [key,value] of Object.entries(r))if(typeof value==='number'&&!Number.isFinite(value))fail(`${r.id}.${key} overflow`);
  const budget={schema:'FarmSystemDesign.RecoveredManureNPResult',schemaVersion:1,period:contract.period,
    scope:'recovered-manure allocation only; not whole-farm P balance',unit:'kg elemental P',
    recoveredP:total(rows.map(r=>r.manureRecoveredP)),appliedP:total(rows.map(r=>r.manureAppliedP)),
    remainingP:total(rows.map(r=>r.manureRemainingP)),applicationCapacityP:total(rows.map(r=>r.manureApplicationCapacityP)),
    recoveredN:total(rows.map(r=>r.manureRecovered)),appliedN:total(rows.map(r=>r.manureApplied)),remainingN:total(rows.map(r=>r.manureRemaining)),
    provenance:rows.map(r=>({farmId:r.id,provenance:bindings.get(r.id).provenance,source:bindings.get(r.id).source}))};
  for(const [key,value] of Object.entries(budget))if(typeof value==='number'&&!Number.isFinite(value))fail(`${key} overflow`);
  // Scale-aware roundoff checks, not a tolerance permitting extra material application.
  for(const element of ['N','P'])if(Math.abs(budget[`recovered${element}`]-budget[`applied${element}`]-budget[`remaining${element}`])>EPS*Math.max(1,budget[`recovered${element}`]))fail(`${element} conservation failed`);
  for(const r of rows)if(r.manureAppliedP>r.manureApplicationCapacityP+EPS*Math.max(1,r.manureApplicationCapacityP))fail(`${r.id} P application cap exceeded`);
  return {transfers,budget};
}
