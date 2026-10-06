from pathlib import Path
from playwright.sync_api import sync_playwright
import sys,os,json,platform,importlib.metadata
with sync_playwright() as p:
    opts={'headless':True}
    if os.getenv('CHROMIUM_EXECUTABLE'): opts['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
    browser=p.chromium.launch(**opts)
    info={'platform':platform.platform(),'python':sys.version,'playwright':importlib.metadata.version('playwright'),'browserVersion':browser.version,'executable':os.getenv('CHROMIUM_EXECUTABLE') or p.chromium.executable_path,'customBrowserFlags':[]}
    browser.close()
Path(sys.argv[1]).write_text(json.dumps(info,indent=2))
print(json.dumps(info))
