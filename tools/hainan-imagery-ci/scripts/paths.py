"""Portable path selection; no workstation-specific paths or credentials."""
import argparse,os
from pathlib import Path
KIT=Path(__file__).resolve().parents[1]
def parser(description):
 p=argparse.ArgumentParser(description=description)
 p.add_argument('--inputs',type=Path,default=KIT/'inputs')
 p.add_argument('--output',type=Path,default=KIT/'generated')
 p.add_argument('--work',type=Path,default=KIT/'work')
 return p
def activate(args):
 inp=args.inputs.resolve();out=args.output.resolve();work=args.work.resolve()
 os.environ['IMAGERY_INPUT_DIR']=str(inp);os.environ['IMAGERY_OUTPUT_DIR']=str(out);os.environ['IMAGERY_WORK_DIR']=str(work)
 out.mkdir(parents=True,exist_ok=True);work.mkdir(parents=True,exist_ok=True)
 return inp,out,work
