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

