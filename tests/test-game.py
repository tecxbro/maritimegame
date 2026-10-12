"""Browser acceptance tests. Inject local HTML directly: the test environment blocks navigation.
Set-content injection changes only the test query flag, not the application logic.
The iframe tests use genuine srcdoc sandbox frames, including an opaque origin.
Run: python tests/test-game.py  (requires Playwright + Chromium)
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, time, math, html as html_lib, os, shutil
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'tests'; OUT.mkdir(exist_ok=True)
HTML = (ROOT/'dist/index.html').read_text()
checks=[]; errors=[]
def check(name, passed, detail=''):
    checks.append({'test':name,'passed':bool(passed),'detail':detail})
    print(('PASS' if passed else 'FAIL'), name, detail)
    if not passed: raise AssertionError(name + ': ' + str(detail))
def snapshot(page):return page.evaluate('window.__BUOY_TEST__.snapshot()')
def boot(page, embed=False):
    page.on('pageerror',lambda e:errors.append(str(e)))
    query='test=1&embed=1' if embed else 'test=1'
    page.wait_for_timeout(150)
    page.set_content(HTML.replace('new URLSearchParams(location.search)',f"new URLSearchParams('{query}')"),wait_until='load')
    page.wait_for_function('window.__BUOY_TEST__ !== undefined')
    page.wait_for_timeout(250)
with sync_playwright() as p:
    executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    options={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
    if executable: options['executable_path']=executable
    browser=p.chromium.launch(**options)
    context=browser.new_context(viewport={'width':1360,'height':980})
    page=context.new_page();boot(page)
    check('Intro renders and remains idle',snapshot(page)['mode']=='intro')
    page.locator('#callsign').fill('WASD CAPTAIN');page.keyboard.press('ArrowLeft');page.wait_for_timeout(100)
    check('Text input is real and does not start/move game',page.locator('#callsign').input_value()=='WASD CAPTAIN' and snapshot(page)['mode']=='intro')
    page.locator('#start').click();page.wait_for_timeout(150)
    check('Start button uses typed callsign without submitting a form',snapshot(page)['mode']=='playing' and snapshot(page)['name']=='WASD CAPTAIN')
    s0=snapshot(page);page.keyboard.down('w');page.keyboard.down('d');page.wait_for_timeout(1850);page.keyboard.up('w');page.keyboard.up('d');page.wait_for_timeout(160)
    s1=snapshot(page)
    check('Actual WASD controls move and collect first buoy',s1['gate']==1 and s1['ship']['x']>s0['ship']['x']+100 and s1['ship']['y']<s0['ship']['y']-100,str({'gate':s1['gate'],'score':s1['score']}))
    page.evaluate("window.__BUOY_TEST__.place(430,1550,0)");page.keyboard.down('d');page.keyboard.down('Space');page.wait_for_timeout(700)
    sb=snapshot(page);page.keyboard.up('Space');page.keyboard.up('d')
    check('Boost increases speed and spends energy',sb['energy']<90 and sb['boosting'] and math.hypot(sb['ship']['vx'],sb['ship']['vy'])>210,str({'energy':sb['energy'],'speed':math.hypot(sb['ship']['vx'],sb['ship']['vy'])}))
    e0=sb['energy'];page.wait_for_timeout(400);check('Boost recharges after release',snapshot(page)['energy']>e0)
    page.keyboard.press('p');sp=snapshot(page);page.wait_for_timeout(450)
    check('Pause freezes game time',snapshot(page)['mode']=='paused' and abs(snapshot(page)['time']-sp['time'])<.01)
    page.locator('#resume').click();page.wait_for_timeout(160)
    check('Resume continues without stuck keys',snapshot(page)['mode']=='playing' and snapshot(page)['keys']==[] and snapshot(page)['time']<sp['time'])
    page.evaluate("window.__BUOY_TEST__.setHealth(3);window.__BUOY_TEST__.place(1010,1020)");page.wait_for_timeout(170)
    sc=snapshot(page);check('Rock collision removes one hull point',sc['health']==2 and sc['invuln']>0)
    page.wait_for_timeout(220);check('Collision immunity prevents instant repeat death',snapshot(page)['health']==2)
    page.evaluate('window.__BUOY_TEST__.setTime(.01)');page.wait_for_timeout(120)
    check('Timeout shows loss and restart',snapshot(page)['mode']=='lost' and page.locator('#result-panel').is_visible())
    page.locator('#play-again').click();page.wait_for_timeout(100)
    check('Restart resets all game state',snapshot(page)['health']==3 and snapshot(page)['gate']==0 and snapshot(page)['score']==0 and snapshot(page)['energy']==100)
    page.evaluate('window.__BUOY_TEST__.setHealth(1);window.__BUOY_TEST__.place(1010,1020)');page.wait_for_timeout(150)
    check('Zero hull ends run',snapshot(page)['mode']=='lost' and 'Rock bottom.' in page.locator('#result-title').inner_text())
    page.locator('#play-again').click();page.wait_for_timeout(120)
    for i in range(7):
        page.evaluate('''() => {const t=window.__BUOY_TEST__.target();window.__BUOY_TEST__.place(t.x,t.y);}''')
        page.wait_for_timeout(140)
    sw=snapshot(page)
    check('All seven checkpoints complete and score',sw['mode']=='won' and sw['gate']==7 and sw['score']>1750,str({'score':sw['score'],'time':sw['time']}))
    page.screenshot(path=str(OUT/'desktop-victory.png'),full_page=True)
    page.locator('#share').click();page.wait_for_timeout(100)
    check('Sharing handles a non-public local origin safely','PUBLISH' in page.locator('#result-note').inner_text())
    page.locator('#play-again').click();page.wait_for_timeout(150)
    page.evaluate('window.__BUOY_TEST__.place(400,1500,0)');bb=page.locator('#game').bounding_box();sx=snapshot(page)['ship']['x']
    page.mouse.move(bb['x']+bb['width']*.82,bb['y']+bb['height']*.5);page.mouse.down();page.wait_for_timeout(600);page.mouse.up();page.wait_for_timeout(80)
    check('Pointer steering moves boat and releases',snapshot(page)['ship']['x']>sx+35 and not snapshot(page)['pointer']['down'])
    page.evaluate("window.dispatchEvent(new Event('blur'))");check('Losing focus auto-pauses',snapshot(page)['mode']=='paused')
    page.locator('#resume').click();page.wait_for_timeout(80)
    check('No runtime JavaScript errors in desktop run',not errors,str(errors))
    context.close()

    # Embedded viewport rendering, exactly 800x600.
    c=browser.new_context(viewport={'width':800,'height':600});page=c.new_page();boot(page,True)
    page.screenshot(path=str(OUT/'embed-intro.png'))
    check('Embedded layout fills viewport without scroll',page.evaluate('document.documentElement.scrollWidth===800 && document.documentElement.scrollHeight<=600'))
    page.locator('#start').click();page.wait_for_timeout(160)
    page.screenshot(path=str(OUT/'embed-playing.png'))
    c.close()

    # Mobile / real browser touch event dispatch (not just calling the game methods).
    c=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    page=c.new_page();boot(page,True);page.screenshot(path=str(OUT/'mobile-intro.png'))
    check('390px mobile has no horizontal scroll',page.evaluate('document.documentElement.scrollWidth===390'))
    page.locator('#callsign').fill('MOBILE');page.locator('#start').tap();page.wait_for_timeout(180)
    check('Mobile touch controls are shown',page.locator('.touch-ui').is_visible())
    page.evaluate('window.__BUOY_TEST__.place(400,1500,0)');startx=snapshot(page)['ship']['x']
    cdp=c.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':320,'y':430,'id':1}]});page.wait_for_timeout(400)
    boost=page.locator('#touch-boost').bounding_box();bx=boost['x']+boost['width']/2;by=boost['y']+boost['height']/2
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':320,'y':430,'id':1},{'x':bx,'y':by,'id':2}]});page.wait_for_timeout(400)
    st=snapshot(page)
    check('Two-finger steer plus boost works',st['ship']['x']>startx+35 and st['boosting'] and st['energy']<100,str({'energy':st['energy'],'dx':st['ship']['x']-startx}))
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(180)
    check('Touch release clears both inputs',not snapshot(page)['pointer']['down'] and not snapshot(page)['pointer']['boost'])
    page.screenshot(path=str(OUT/'mobile-playing.png'))
    c.close()

    # The same game is placed inside genuine sandboxed frames. No URL/network simulation.
    for sandbox in ['allow-scripts allow-same-origin','allow-scripts']:
        c=browser.new_context(viewport={'width':1024,'height':820});page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.wait_for_timeout(100)
        frame_html=HTML.replace('new URLSearchParams(location.search)',"new URLSearchParams('test=1')")
        outer='<html><body style="margin:0;background:#111"><iframe title="test" style="width:800px;height:600px;border:0" sandbox="'+sandbox+'" srcdoc="'+html_lib.escape(frame_html,quote=True)+'"></iframe></body></html>'
        page.set_content(outer,wait_until='load');frame=page.frames[1];frame.wait_for_function('window.__BUOY_TEST__ !== undefined')
        frame.locator('#callsign').fill('IN A FRAME');frame.locator('#start').click();page.wait_for_timeout(150)
        initial=frame.evaluate('window.__BUOY_TEST__.snapshot()')
        page.keyboard.down('d');page.wait_for_timeout(400);page.keyboard.up('d');page.wait_for_timeout(100)
        after=frame.evaluate('window.__BUOY_TEST__.snapshot()')
        check('Keyboard input inside sandbox: '+sandbox,after['name']=='IN A FRAME' and after['ship']['x']>initial['ship']['x']+10)
        frame.evaluate('window.__BUOY_TEST__.setTime(.01)');page.wait_for_timeout(120)
        check('Storage denial does not break game: '+sandbox,frame.evaluate('window.__BUOY_TEST__.snapshot().mode')=='lost')
        page.screenshot(path=str(OUT/('sandbox-opaque.png' if sandbox=='allow-scripts' else 'sandbox-normal.png')))
        c.close()
    check('No runtime errors across desktop, mobile, and sandbox tests',not errors,str(errors))
    browser.close()
report={'suite':'Buoy Run browser acceptance','passed':sum(t['passed'] for t in checks),'total':len(checks),'tests':checks,'runtimeErrors':errors,'notes':['Game loaded with Playwright set_content because browser navigation is blocked in this environment.','WebGL2 unavailable here; the animated 2D dither fallback was exercised.','Real X Player Card acceptance and public deployment are not tested.']}
(OUT/'test-results.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'passed':report['passed'],'total':report['total']}))
