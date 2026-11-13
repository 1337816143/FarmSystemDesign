import frozenStress from './fixtures/large-record-counterexample-input.json' with {type:'json'};
export const stressInput=()=>structuredClone(frozenStress);
import {defaultInput} from '../src/fixture.js';
/** Same legal high-issue-count recipe as the independent 13,420-byte counterexample. */
export function independentStressInput(){
 const x=defaultInput(),template=x.strata[0];x.periods=Array.from({length:24},(_,i)=>`P${i+1}`);
 x.strata=Array.from({length:6},(_,i)=>{const s=structuredClone(template);s.id=`s${i}`;s.label=`Synthetic stratum ${i}`;s.landClass=`land${i}`;s.count=1;s.laborCapacity=Array(24).fill(0);s.waterAccess=Array(24).fill(1000);s.menus=s.menus.map((m,j)=>({...m,id:`m${i}-${j}`,landClass:s.landClass,laborHours:Array(24).fill(1),waterM3:Array(24).fill(1)}));return s});
 x.waterSources.forEach(s=>s.capacity=Array(24).fill(1000));x.constraints={minProductsKg:{grain:0,vegetable:0},maxExternalN:100000,maxExternalP:100000};return x;
}
