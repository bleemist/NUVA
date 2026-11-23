const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CDP_PORT = 9222;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const screenshotDir = path.resolve(__dirname, 'screenshots');

async function main() {
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const tmpProfile = path.join(os.tmpdir(), 'chrome-anim-test-' + Date.now());

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

  // Wait for CDP endpoint
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

  const results = {};

  try {
    // 1. Open index.html
    console.log('\n--- Navigating to http://localhost:3000/index.html ---');
    const newTargetRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?http://localhost:3000/index.html`, { method: 'PUT' });
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
        throw new Error(res.exceptionDetails.text || JSON.stringify(res.exceptionDetails));
      }
      return res.result.value;
    }

    async function takeScreenshot(filename, clip = null) {
      const params = { format: 'png' };
      if (clip) params.clip = clip;
      const shot = await send('Page.captureScreenshot', params);
      const filePath = path.join(screenshotDir, filename);
      fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
      console.log(`Saved screenshot: ${filePath}`);
      return filePath;
    }

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    // Set viewport: 1280x800
    console.log('Setting viewport to 1280x800...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    await wait(1000);

    // 2. Inspect Hero Title & Rotator
    console.log('\n--- Inspecting #heroWordRotator ---');
    const rotatorInfo = await evaluate(`(() => {
      const el = document.getElementById('heroWordRotator');
      if (!el) return { found: false };
      const words = Array.from(el.querySelectorAll('.hero-rotator-word')).map(w => ({
        text: w.textContent.trim(),
        index: w.dataset.index,
        classes: Array.from(w.classList),
        opacity: window.getComputedStyle(w).opacity,
        transform: window.getComputedStyle(w).transform
      }));
      const activeWord = el.querySelector('.hero-rotator-word.active');
      return {
        found: true,
        wordCount: words.length,
        phrases: words.map(w => w.text),
        words: words,
        activeText: activeWord ? activeWord.textContent.trim() : null
      };
    })()`);
    console.log('Hero Word Rotator Initial State:', JSON.stringify(rotatorInfo, null, 2));
    results.rotatorInitial = rotatorInfo;

    // Take initial Hero screenshot
    const heroBox = await evaluate(`(() => {
      const hero = document.querySelector('.hero-container');
      const rect = hero.getBoundingClientRect();
      return { x: 0, y: 0, width: 1280, height: Math.min(Math.round(rect.bottom + 20), 800), scale: 1 };
    })()`);
    const heroShot1 = await takeScreenshot('hero_word_rotator_initial.png', heroBox);
    results.heroShot1 = heroShot1;

    // Wait 3.5 seconds and observe word rotator change
    console.log('\nWaiting 3.5s for dynamic rotation flip animation...');
    await wait(3500);

    const rotatorAfter35s = await evaluate(`(() => {
      const el = document.getElementById('heroWordRotator');
      const activeWord = el.querySelector('.hero-rotator-word.active');
      const leavingWord = el.querySelector('.hero-rotator-word.leaving');
      const words = Array.from(el.querySelectorAll('.hero-rotator-word')).map(w => ({
        text: w.textContent.trim(),
        classes: Array.from(w.classList),
        opacity: window.getComputedStyle(w).opacity,
        transform: window.getComputedStyle(w).transform
      }));
      return {
        activeText: activeWord ? activeWord.textContent.trim() : null,
        leavingText: leavingWord ? leavingWord.textContent.trim() : null,
        words: words
      };
    })()`);
    console.log('Hero Word Rotator after 3.5s:', JSON.stringify(rotatorAfter35s, null, 2));
    results.rotatorAfter35s = rotatorAfter35s;

    // Take second Hero screenshot showing rotated word
    const heroShot2 = await takeScreenshot('hero_word_rotator_rotated.png', heroBox);
    results.heroShot2 = heroShot2;

    // Wait another 3 seconds to see third rotation
    console.log('\nWaiting another 3s for 3rd word rotation...');
    await wait(3000);
    const rotatorAfter65s = await evaluate(`(() => {
      const el = document.getElementById('heroWordRotator');
      const activeWord = el.querySelector('.hero-rotator-word.active');
      return {
        activeText: activeWord ? activeWord.textContent.trim() : null
      };
    })()`);
    console.log('Hero Word Rotator after 6.5s:', JSON.stringify(rotatorAfter65s, null, 2));
    results.rotatorAfter65s = rotatorAfter65s;

    // 3. Inspect Word Movement Marquee (.word-ticker-strip)
    console.log('\n--- Inspecting .word-ticker-strip & .word-ticker-track ---');
    const tickerInfo = await evaluate(`(() => {
      const strip = document.querySelector('.word-ticker-strip');
      const track = document.querySelector('.word-ticker-track');
      if (!strip || !track) return { found: false };
      const stripStyle = window.getComputedStyle(strip);
      const trackStyle = window.getComputedStyle(track);
      const stripRect = strip.getBoundingClientRect();
      const heroRect = document.querySelector('.hero-container').getBoundingClientRect();
      const items = Array.from(track.querySelectorAll('.word-ticker-item')).map(it => it.textContent.trim());
      return {
        found: true,
        stripVisible: stripRect.height > 0 && stripStyle.display !== 'none',
        stripRect: { top: stripRect.top, bottom: stripRect.bottom, height: stripRect.height, width: stripRect.width },
        heroBottom: heroRect.bottom,
        distanceFromHero: stripRect.top - heroRect.bottom,
        trackAnimationName: trackStyle.animationName,
        trackAnimationDuration: trackStyle.animationDuration,
        trackAnimationTimingFunction: trackStyle.animationTimingFunction,
        trackAnimationIterationCount: trackStyle.animationIterationCount,
        itemCount: items.length,
        sampleItems: items.slice(0, 8)
      };
    })()`);
    console.log('Ticker Marquee Info:', JSON.stringify(tickerInfo, null, 2));
    results.tickerInfo = tickerInfo;

    // Screenshot of ticker strip
    // Scroll so ticker strip is clearly centered in view
    await evaluate(`(() => {
      const strip = document.querySelector('.word-ticker-strip');
      strip.scrollIntoView({ block: 'center' });
    })()`);
    await wait(500);

    const tickerBox = await evaluate(`(() => {
      const strip = document.querySelector('.word-ticker-strip');
      const rect = strip.getBoundingClientRect();
      return {
        x: 0,
        y: Math.max(0, Math.round(rect.top - 60)),
        width: 1280,
        height: Math.round(rect.height + 120),
        scale: 1
      };
    })()`);
    const tickerShot = await takeScreenshot('word_marquee_ticker_strip.png', tickerBox);
    results.tickerShot = tickerShot;

    // 4. Inspect Floating Badges (floating-badge-3 and floating-badge-4)
    console.log('\n--- Inspecting Floating Badges 3 & 4 ---');
    await evaluate(`window.scrollTo(0, 0);`);
    await wait(500);

    const badgeInfo = await evaluate(`(() => {
      const b3 = document.querySelector('.floating-badge-3');
      const b4 = document.querySelector('.floating-badge-4');
      const b1 = document.querySelector('.floating-badge-1');
      const b2 = document.querySelector('.floating-badge-2');
      function inspect(el, name) {
        if (!el) return { name, found: false };
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          name,
          found: true,
          text: el.textContent.trim().replace(/\\s+/g, ' '),
          display: cs.display,
          opacity: cs.opacity,
          visibility: cs.visibility,
          animationName: cs.animationName,
          animationDuration: cs.animationDuration,
          animationTimingFunction: cs.animationTimingFunction,
          transform: cs.transform,
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        };
      }
      return {
        badge1: inspect(b1, 'floating-badge-1'),
        badge2: inspect(b2, 'floating-badge-2'),
        badge3: inspect(b3, 'floating-badge-3'),
        badge4: inspect(b4, 'floating-badge-4')
      };
    })()`);
    console.log('Floating Badges Info:', JSON.stringify(badgeInfo, null, 2));
    results.badgeInfo = badgeInfo;

    // 5. Inspect Section Titles (.highlight-shimmer and .word-brush-accent)
    console.log('\n--- Inspecting Section Titles (.highlight-shimmer and .word-brush-accent) ---');
    const sectionTitlesInfo = await evaluate(`(() => {
      const titles = Array.from(document.querySelectorAll('.section-title')).map(st => {
        const shimmer = st.querySelector('.highlight-shimmer');
        const brush = st.querySelector('.word-brush-accent');
        const sStyle = shimmer ? window.getComputedStyle(shimmer) : null;
        return {
          fullTitle: st.textContent.trim().replace(/\\s+/g, ' '),
          hasShimmer: !!shimmer,
          shimmerText: shimmer ? shimmer.textContent.trim() : null,
          shimmerAnimation: sStyle ? sStyle.animationName : null,
          hasBrushAccent: !!brush,
          brushText: brush ? brush.textContent.trim() : null
        };
      });
      return titles;
    })()`);
    console.log('Section Titles:', JSON.stringify(sectionTitlesInfo, null, 2));
    results.sectionTitlesInfo = sectionTitlesInfo;

    // Screenshot of one section title (e.g. Quick Weight Simulator)
    await evaluate(`(() => {
      const sec = document.querySelector('.simulator-section') || document.querySelector('#quick-simulator') || document.querySelector('.section-title');
      if (sec) sec.scrollIntoView({ block: 'start' });
    })()`);
    await wait(500);
    const sectionShot = await takeScreenshot('section_title_shimmer.png');
    results.sectionShot = sectionShot;

    // 6. Open course-input.html
    console.log('\n--- Navigating to http://localhost:3000/course-input.html ---');
    await send('Page.navigate', { url: 'http://localhost:3000/course-input.html' });
    await wait(1500);

    const courseInputInfo = await evaluate(`(() => {
      const formTitle = document.querySelector('.form-title');
      if (!formTitle) return { found: false };
      const shimmer = formTitle.querySelector('.highlight-shimmer');
      const brush = formTitle.querySelector('.word-brush-accent');
      const sStyle = shimmer ? window.getComputedStyle(shimmer) : null;
      return {
        found: true,
        fullText: formTitle.textContent.trim().replace(/\\s+/g, ' '),
        hasShimmer: !!shimmer,
        shimmerText: shimmer ? shimmer.textContent.trim() : null,
        shimmerAnimation: sStyle ? sStyle.animationName : null,
        hasBrushAccent: !!brush,
        brushText: brush ? brush.textContent.trim() : null,
        backgroundClip: sStyle ? (sStyle.backgroundClip || sStyle.webkitBackgroundClip) : null,
        webkitTextFillColor: sStyle ? sStyle.webkitTextFillColor : null
      };
    })()`);
    console.log('Course Input Title Info:', JSON.stringify(courseInputInfo, null, 2));
    results.courseInputInfo = courseInputInfo;

    // Screenshot of course-input.html header
    const courseHeaderBox = await evaluate(`(() => {
      const header = document.querySelector('.course-input-header') || document.querySelector('.form-header') || document.querySelector('.header') || document.querySelector('.form-title').parentElement;
      const rect = header.getBoundingClientRect();
      return {
        x: 0,
        y: 0,
        width: 1280,
        height: Math.min(Math.round(rect.bottom + 80), 800),
        scale: 1
      };
    })()`);
    const courseInputShot = await takeScreenshot('course_input_header.png', courseHeaderBox);
    results.courseInputShot = courseInputShot;

    // Save summary json
    fs.writeFileSync(path.join(screenshotDir, 'verification_summary.json'), JSON.stringify(results, null, 2));
    console.log('\nVerification completed successfully!');
  } finally {
    console.log('Killing Chrome...');
    chromeProc.kill();
  }
}

main().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
