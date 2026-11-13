"""A real native launch must survive a redraw while its HTTP response is pending."""
from pathlib import Path
import argparse,asyncio,json
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',required=True);parser.add_argument('--output',required=True,type=Path);args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
document=json.loads((ROOT/'data/farmdesign/author-cases-2019.json').read_text(encoding='utf-8'))['cases'][0];document['optimization']['settings'].update(MultiFactor=8,Generations=2)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True);page=await browser.new_page(viewport={'width':1500,'height':1050});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(args.url.rstrip('/')+'/#farmdesign');await page.wait_for_selector('[data-fd-tab=original]')
  await page.evaluate('(value)=>{localStorage.setItem("farmsystem-language-v1","en");localStorage.setItem("farmsystem-farmdesign-native-v1",value);}',json.dumps({'document':document,'plans':[],'originalSession':None}));await page.reload();await page.locator('[data-fd-tab=original]').click()
  launched=[]
  async def delayed(route):
   launched.append(route.request.url);response=await route.fetch(timeout=120000);await asyncio.sleep(3);await route.fulfill(response=response)
  await page.route('**/api/farmdesign/original/start',delayed)
  async with page.expect_request('**/api/farmdesign/original/start'):await page.locator('[data-original=browser]').click()
  await page.locator('[data-fd-tab=inputs]').click();await page.locator('[data-fd-tab=original]').click()
  await page.wait_for_function('document.querySelector(".fd-original-surface img")?.naturalWidth>100',timeout=120000)
  saved=json.loads(await page.evaluate('localStorage.getItem("farmsystem-farmdesign-native-v1")'));assert len(launched)==1;assert saved['originalSession']['id'];assert saved['document']['tables']==document['tables'];print('Browser errors:',errors,flush=True);assert not errors
  await page.screenshot(path=str(args.output/'launch-survives-redraw.png'),full_page=True)
  sid=saved['originalSession']['id'];await page.locator('[data-original=close]').click();await page.wait_for_function('document.querySelector(".fd-original-status")?.textContent.includes("Saved and closed")');await asyncio.sleep(1);closed=json.loads(await page.evaluate('localStorage.getItem("farmsystem-farmdesign-native-v1")'));assert closed['originalSession']['running'] is False;assert not await page.locator('.fd-original-error').inner_text()
  (args.output/'checks.json').write_text(json.dumps({'passed':5,'checks':['Real original window opens after navigation during delayed response','Only one native session is launched','Original session is saved without changing input tables','No browser JavaScript errors','Save and close retains the session without polling a dead process'],'sessionId':sid},ensure_ascii=False,indent=2),encoding='utf-8');await browser.close();print('PASS: 5 real-launch lifecycle checks')
asyncio.run(main())
