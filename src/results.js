import {hash} from './data.js';

// This limit belongs to the view only. Never use the page as a search/export/save source.
export const CANDIDATES_PER_PAGE=36;
export function candidatePage(candidates,index=0){
  const pageCount=Math.max(1,Math.ceil(candidates.length/CANDIDATES_PER_PAGE));
  const page=Math.max(0,Math.min(pageCount-1,Number.isFinite(index)?Math.trunc(index):0));
  const offset=page*CANDIDATES_PER_PAGE;
  return {page,pageCount,offset,total:candidates.length,candidates:candidates.slice(offset,offset+CANDIDATES_PER_PAGE)};
}
export function selectedPage(candidates,id){
  return Math.floor(Math.max(0,candidates.findIndex(c=>c.id===id))/CANDIDATES_PER_PAGE);
}
export function searchIsStale(result,data,farmIds,config,climate){
  // Preserve the original input hash and config. Ranking preference is not a search input.
  return Boolean(result&&result.inputHash!==hash({data,farmIds,config:{...config,objective:result.config.objective},climate}));
}
