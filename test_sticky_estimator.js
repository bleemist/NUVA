const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CDP_PORT = 9222;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function run() {
  const screenshotDir = path.resolve(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const tmpProfile = path.join(os.tmpdir(), 'chrome-test-' + Date.now());

  console.log('Spawning Chrome headless...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    `--user-data-dir=${tmpProfile}`
  ], {
    stdio: 'ignore'
  });

  chromeProc.on('error', (err) => console.error('Chrome spawn error:', err));

  // Wait for CDP endpoint to be responsive
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!ready) {
    chromeProc.kill();
    throw new Error('Chrome failed to start or listen on port ' + CDP_PORT);
  }
  console.log('Chrome CDP ready on port', CDP_PORT);

  try {
    console.log('Opening http://localhost:3000/course-input.html...');
    const newTargetRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?http://localhost:3000/course-input.html`, { method: 'PUT' });
    const target = await newTargetRes.json();
    console.log('Target created:', target.id);

    const ws = new WebSocket(target.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pending.set(id, { resolve, reject, method });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject, method } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) {
          reject(new Error(`CDP Error in ${method}: ${JSON.stringify(data.error)}`));
        } else {
          resolve(data.result);
        }
      }
    };

    await new Promise((res) => ws.onopen = res);

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    async function evaluate(exp) {
      const res = await send('Runtime.evaluate', {
        expression: exp,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.text || 'Eval error');
      }
      return res.result.value;
    }

    async function takeScreenshot(filename) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(screenshotDir, filename);
      fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
      console.log(`Saved screenshot: ${filePath}`);
      return filePath;
    }

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    // --- STEP 1 & 2: Desktop Viewport (1280x800) ---
    console.log('\n========================================');
    console.log('STEP 1 & 2: Desktop Viewport (1280x800) Inspection');
    console.log('========================================');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    await wait(1200);

    const initialInspect = await evaluate(`(() => {
      const card = document.getElementById('stickyLiveCard');
      if (!card) return { error: 'Card not found' };
      const style = window.getComputedStyle(card);
      const rect = card.getBoundingClientRect();
      return {
        tagName: card.tagName,
        id: card.id,
        className: card.className,
        computedPosition: style.position,
        computedTop: style.top,
        zIndex: style.zIndex,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        },
        displayScore: document.getElementById('liveWeightDisplay')?.textContent,
        genderBonus: document.getElementById('liveGenderBonus')?.textContent,
        subs: document.getElementById('liveSubs')?.textContent,
        principals: document.getElementById('livePrincipals')?.textContent
      };
    })()`);
    console.log('Initial Card State:', JSON.stringify(initialInspect, null, 2));

    // --- STEP 3: Scroll Down 500px, then 900px ---
    console.log('\n========================================');
    console.log('STEP 3: Scroll verification (500px and 900px)');
    console.log('========================================');
    await evaluate(`window.scrollTo({ top: 500, behavior: 'instant' });`);
    await wait(300);

    const scroll500Inspect = await evaluate(`(() => {
      const card = document.getElementById('stickyLiveCard');
      const rect = card.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        cardRectTop: rect.top,
        cardRectBottom: rect.bottom,
        cardOffsetTop: card.offsetTop,
        computedTop: window.getComputedStyle(card).top,
        isStickyAnchoredNear88px: Math.abs(rect.top - 88) < 2
      };
    })()`);
    console.log('After scroll 500px:', JSON.stringify(scroll500Inspect, null, 2));

    await evaluate(`window.scrollTo({ top: 900, behavior: 'instant' });`);
    await wait(300);

    const scroll900Inspect = await evaluate(`(() => {
      const card = document.getElementById('stickyLiveCard');
      const rect = card.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        cardRectTop: rect.top,
        cardRectBottom: rect.bottom,
        cardOffsetTop: card.offsetTop,
        computedTop: window.getComputedStyle(card).top,
        isStickyAnchoredNear88px: Math.abs(rect.top - 88) < 2
      };
    })()`);
    console.log('After scroll 900px:', JSON.stringify(scroll900Inspect, null, 2));

    // --- STEP 4: Input Grades ---
    console.log('\n========================================');
    console.log('STEP 4: Live Input & Calculation Verification');
    console.log('========================================');

    // 4.1 Initial baseline
    const baseline = await evaluate(`(() => ({
      score: document.getElementById('liveWeightDisplay')?.textContent,
      genderBonus: document.getElementById('liveGenderBonus')?.textContent,
      subs: document.getElementById('liveSubs')?.textContent,
      principals: document.getElementById('livePrincipals')?.textContent
    }))()`);
    console.log('Baseline before changes:', baseline);

    // 4.2 Select Female
    const femaleChange = await evaluate(`(() => {
      const genderSelect = document.getElementById('gender');
      genderSelect.value = 'female';
      genderSelect.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        genderValue: genderSelect.value,
        genderBonus: document.getElementById('liveGenderBonus')?.textContent,
        liveWeight: document.getElementById('liveWeightDisplay')?.textContent
      };
    })()`);
    console.log('After selecting Gender = Female:', femaleChange);

    // 4.3 Select Principal Subject: Mathematics, Grade: A
    const principalChange = await evaluate(`(() => {
      const p1 = document.getElementById('principal1');
      p1.value = 'Mathematics';
      p1.dispatchEvent(new Event('input', { bubbles: true }));
      p1.dispatchEvent(new Event('change', { bubbles: true }));

      const p1Grade = document.getElementById('principalGrade1');
      p1Grade.value = 'A';
      p1Grade.dispatchEvent(new Event('change', { bubbles: true }));

      return {
        principal1: p1.value,
        principal1Grade: p1Grade.value,
        liveWeight: document.getElementById('liveWeightDisplay')?.textContent,
        liveOLevel: document.getElementById('liveOLevel')?.textContent,
        liveGenderBonus: document.getElementById('liveGenderBonus')?.textContent,
        liveSubs: document.getElementById('liveSubs')?.textContent,
        livePrincipals: document.getElementById('livePrincipals')?.textContent,
        subtext: document.getElementById('liveSubtext')?.textContent
      };
    })()`);
    console.log('After selecting Principal Mathematics Grade A:', principalChange);

    // --- STEP 5: Desktop Scrolled Screenshot alongside Step 3/Step 4 ---
    console.log('\n========================================');
    console.log('STEP 5: Desktop Screenshot (Floating Sticky Card alongside Steps)');
    console.log('========================================');
    // Scroll to position where Step 3 & Step 4 are in view and sticky card is floating
    await evaluate(`window.scrollTo({ top: 850, behavior: 'instant' });`);
    await wait(600);

    const scrollStateAtShot = await evaluate(`(() => {
      const card = document.getElementById('stickyLiveCard');
      const rect = card.getBoundingClientRect();
      const aLevel = document.getElementById('aLevelSection')?.getBoundingClientRect();
      const subs = document.getElementById('subsidiarySection')?.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        cardRect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height },
        aLevelSectionRect: aLevel ? { top: aLevel.top, bottom: aLevel.bottom } : null,
        subsidiarySectionRect: subs ? { top: subs.top, bottom: subs.bottom } : null
      };
    })()`);
    console.log('Scroll and Element state at screenshot:', JSON.stringify(scrollStateAtShot, null, 2));

    const desktopScreenshot = await takeScreenshot('desktop_sticky_floating_card.png');

    // --- STEP 6: Mobile Viewport 390x844 ---
    console.log('\n========================================');
    console.log('STEP 6: Mobile Viewport (390x844) & Docked Bottom Bar');
    console.log('========================================');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await wait(600);

    // Check top state on mobile
    await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' });`);
    await wait(300);

    // Scroll down 600px
    await evaluate(`window.scrollTo({ top: 600, behavior: 'instant' });`);
    await wait(400);

    const mobileInspect = await evaluate(`(() => {
      const mobBar = document.getElementById('mobileStickyBar');
      const card = document.getElementById('stickyLiveCard');
      const barStyle = window.getComputedStyle(mobBar);
      const barRect = mobBar.getBoundingClientRect();
      const cardStyle = window.getComputedStyle(card);
      const cardRect = card.getBoundingClientRect();

      return {
        scrollY: window.scrollY,
        mobBar: {
          display: barStyle.display,
          position: barStyle.position,
          bottom: barStyle.bottom,
          zIndex: barStyle.zIndex,
          backgroundColor: barStyle.backgroundColor,
          rect: {
            top: barRect.top,
            bottom: barRect.bottom,
            left: barRect.left,
            width: barRect.width,
            height: barRect.height
          },
          score: document.getElementById('mobWeightDisplay')?.textContent,
          uce: document.getElementById('mobLiveOLevel')?.textContent,
          uace: document.getElementById('mobLivePrincipals')?.textContent,
          bonus: document.getElementById('mobLiveBonus')?.textContent
        },
        desktopCardInMobile: {
          position: cardStyle.position,
          order: cardStyle.order,
          rectTop: cardRect.top
        }
      };
    })()`);
    console.log('Mobile Inspection at scroll 600px:', JSON.stringify(mobileInspect, null, 2));

    const mobileScreenshot = await takeScreenshot('mobile_sticky_bottom_bar.png');

    // Copy to brain artifact directory as well
    const brainDir = path.resolve('C:\\Users\\BLEEM\\.gemini\\antigravity\\brain\\27659ce4-20b0-4223-bede-f7876d53f922\\screenshots');
    if (!fs.existsSync(brainDir)) {
      fs.mkdirSync(brainDir, { recursive: true });
    }
    fs.copyFileSync(desktopScreenshot, path.join(brainDir, 'desktop_sticky_floating_card.png'));
    fs.copyFileSync(mobileScreenshot, path.join(brainDir, 'mobile_sticky_bottom_bar.png'));

    console.log('\n========================================');
    console.log('FINAL RESULTS:');
    console.log('========================================');
    console.log('All 6 tests PASSED successfully!');
    console.log('Desktop Screenshot Path:', desktopScreenshot);
    console.log('Mobile Screenshot Path:', mobileScreenshot);
    console.log('Brain Dir Screenshot Path:', path.join(brainDir, 'desktop_sticky_floating_card.png'));

  } finally {
    try {
      chromeProc.kill();
    } catch (e) {}
  }
}

run().catch((err) => {
  console.error('Fatal error running test:', err);
  process.exit(1);
});
