#!/usr/bin/python3
import json,time,concurrent.futures,multiprocessing,traceback
from pathlib import Path
from paths import parser,activate

def worker(tile):
 from build_tiles import build
 return build(tile,debug=True)
if __name__=='__main__':
 ap=parser('Generate native Sentinel-2 window tiles');ap.add_argument('--limit',type=int,default=0);ap.add_argument('--workers',type=int,default=2);args=ap.parse_args();activate(args)
 from build_tiles import ROOT,GRID,META,build,atomic_json,METHOD_VERSION
 start=time.time();targets=GRID['records'];done={}
 for tile in targets:
  p=META/(tile['id']+'.json')
  if p.exists():
   m=json.load(open(p))
   if m.get('complete') and m.get('method_version')==METHOD_VERSION:done[tile['id']]=m
 pending=[t for t in targets if t['id'] not in done]
 if args.limit:pending=pending[:args.limit]
 requested_count=len(pending)
 for attempt in range(3):
  if not pending:break
  failures=[];workers=max(1,min(3,args.workers)) if attempt==0 else 1
  print('ROUND',attempt,'pending',len(pending),'workers',workers,flush=True)
  with concurrent.futures.ProcessPoolExecutor(max_workers=workers,max_tasks_per_child=1,mp_context=multiprocessing.get_context('spawn')) as ex:
   future={ex.submit(worker,t):t for t in pending}
   for fut in concurrent.futures.as_completed(future):
    tile=future[fut]
    try:
     m=fut.result()
     if m.get('complete') and m.get('method_version')==METHOD_VERSION:done[tile['id']]=m
     else:failures.append(tile)
    except Exception as e:print('TILE FAILURE',tile['id'],str(e),flush=True);failures.append(tile)
    atomic_json(ROOT/'progress.json',{'method_version':METHOD_VERSION,'expected_tiles':len(targets),'completed_tiles':len(done),'complete':len(done)==len(targets),'last_tile':tile['id'],'elapsed_seconds':round(time.time()-start,1),'image_bytes':sum(m['image_bytes'] for m in done.values()),'audit_bytes':sum(m['status_bytes']+m['source_date_bytes'] for m in done.values())})
    print('PROGRESS',len(done),'/',len(targets),flush=True)
  pending=failures
 if pending:raise RuntimeError('Unfinished tiles:'+','.join(t['id'] for t in pending))
 print('NATIVE GRID COMPLETE' if len(done)==len(targets) else 'BOUNDED BATCH COMPLETE',len(done),'/',len(targets),'requested',requested_count,'elapsed',round(time.time()-start,1),flush=True)
