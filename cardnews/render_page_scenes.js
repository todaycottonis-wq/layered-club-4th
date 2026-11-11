// 실제 배포 페이지(public/index.html)를 불러서 구간별로 4:5(1080×1350) 캡처/영상을 만들어요.
// 사용: node cardnews/render_page_scenes.js   (먼저 python3 tools/build.py 로 public/ 을 만들어 두세요)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'page-captures');
const TMP = process.env.TMPFRAMES || path.join(__dirname, '.frames');
fs.mkdirSync(OUT, { recursive: true });
const URL = 'file://' + path.join(ROOT, 'public/index.html') + '?notrack';
const FPS = 30;

const baseCss = (sec, pad) => `
#landing>nav,#landing footer,.hero,.tiles,#landing main>section:not(#${sec}),.toast,#flow,.lbox{display:none!important}
html,body{margin:0;overflow:hidden;background:#fff}
body::before{display:none!important}
#${sec}{position:fixed!important;inset:0;max-width:none!important;margin:0!important;padding:${pad}!important;display:flex;flex-direction:column;justify-content:center;background:#fff}
#${sec} .hd{margin-bottom:22px}
`;

async function open(browser, W, H) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1080 / W });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(URL);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(900);
  return { ctx, p };
}
async function fitCheck(p, sel, H, name) {
  const h = await p.evaluate(s => { const e = document.querySelector(s); return e.scrollHeight; }, sel);
  console.log(name, 'content height', h, 'of', H, h > H + 1 ? '  <-- OVERFLOW' : '');
}

async function still(browser, name, { W, H, sec, pad = '48px 32px', css = '', prep }) {
  const { ctx, p } = await open(browser, W, H);
  await p.addStyleTag({ content: baseCss(sec, pad) + css });
  if (prep) await p.evaluate(prep);
  await p.waitForTimeout(400);
  await fitCheck(p, '#' + sec, H, name);
  await p.screenshot({ path: path.join(OUT, name + '.png') });
  await ctx.close();
}
async function customStill(browser, name, { W, H, html, css = '' }) {
  const { ctx, p } = await open(browser, W, H);
  await p.addStyleTag({ content: `#landing>nav,#landing footer,.hero,.tiles,#landing main>section,.toast,#flow,.lbox{display:none!important} html,body{margin:0;overflow:hidden;background:#fff} body::before{display:none!important} #cs{position:fixed;inset:0;display:flex;flex-direction:column;justify-content:center;padding:48px 32px;background:#fff} #cs .badge{align-self:flex-start} ` + css });
  const markup = typeof html === 'function' ? await p.evaluate(html) : html;
  await p.evaluate(h => { const d = document.createElement('div'); d.id = 'cs'; d.innerHTML = h; document.body.appendChild(d); }, markup);
  await p.waitForTimeout(400);
  await fitCheck(p, '#cs', H, name);
  await p.screenshot({ path: path.join(OUT, name + '.png') });
  await ctx.close();
}
async function video(browser, name, { W, H, sec, pad = '48px 32px', css = '', secs, prep, anim }) {
  const { ctx, p } = await open(browser, W, H);
  await p.addStyleTag({ content: baseCss(sec, pad) + css });
  if (prep) await p.evaluate(prep);
  await p.waitForTimeout(400);
  await fitCheck(p, '#' + sec, H, name);
  const dir = path.join(TMP, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(secs * FPS);
  for (let i = 0; i < n; i++) {
    await p.evaluate(anim, { t: i / FPS, total: secs });
    await p.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93 });
  }
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%04d.jpg'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, name + '.mp4')]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('video', name, n, 'frames');
  await ctx.close();
}

async function customVideo(browser, name, { W, H, html, css = '', secs, anim }) {
  const { ctx, p } = await open(browser, W, H);
  await p.addStyleTag({ content: `#landing>nav,#landing footer,.hero,.tiles,#landing main>section,.toast,#flow,.lbox{display:none!important} html,body{margin:0;overflow:hidden;background:#fff} body::before{display:none!important} #cs{position:fixed;inset:0;display:flex;flex-direction:column;justify-content:center;padding:48px 32px;background:#fff} #cs .badge{align-self:flex-start} ` + css });
  await p.evaluate(h => { const d = document.createElement('div'); d.id = 'cs'; d.innerHTML = h; document.body.appendChild(d); }, html);
  await p.waitForTimeout(400);
  await fitCheck(p, '#cs', H, name);
  const dir = path.join(TMP, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(secs * FPS);
  for (let i = 0; i < n; i++) {
    await p.evaluate(anim, { t: i / FPS, total: secs });
    await p.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93 });
  }
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%04d.jpg'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, name + '.mp4')]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('video', name, n, 'frames');
  await ctx.close();
}

// 순서대로 나타나는 모션: 제목 → 카드들이 차례로 올라오고, 잠시 머문 뒤 사라져요.
const revealAnim = ({ t, total }) => {
  const els = window.__els || (window.__els = [document.querySelector('.hd')].concat(Array.from(document.querySelectorAll(window.__sel))));
  const ease = x => 1 - Math.pow(1 - x, 3);
  const step = 0.55, start0 = 0.2;
  els.forEach((el, i) => {
    const a = Math.max(0, Math.min(1, (t - (start0 + i * step)) / 0.7));
    const out = Math.max(0, Math.min(1, (t - (total - 0.7)) / 0.6));
    el.style.opacity = String(ease(a) * (1 - out));
    el.style.transform = 'translateY(' + ((1 - ease(a)) * 38 + out * -10) + 'px)';
  });
};

const want = k => { const a = process.argv.slice(2); return !a.length || a.includes(k); };
const SCHED_CSS = '#schedule h2{font-size:34px} #schedule .hd{margin-bottom:16px} #schedule .fine{display:none} #schedule .sub{display:none} #schedule .ctl{margin-bottom:10px;gap:8px} #schedule .cg>div{min-height:62px;padding:5px 7px} #schedule .cg .h{padding:6px 2px} #schedule .chip{padding:2px 5px;margin-top:3px} #schedule .bar{margin-top:4px;height:18px} #schedule .sp{height:20px}';

(async () => {
  const b = await chromium.launch();

  if (want('fit')) await video(b, '01_지금 이런 고민이 있다면_모션', {
    W: 600, H: 750, sec: 'fit', pad: '40px 34px', secs: 7.5,
    css: '#fit .fl{min-height:176px;padding:22px 24px 18px;gap:18px} #fit .flow{gap:14px} #fit .hd{margin-bottom:26px} #fit h2{font-size:30px} #fit .tx{font-size:19.5px}',
    prep: () => { window.__sel = '#fit .fl'; }, anim: revealAnim
  });
  if (want('rec')) await video(b, '02_이런 분에게 레클을 추천해요_모션', {
    W: 600, H: 750, sec: 'rec', pad: '40px 34px', secs: 8,
    css: '#rec h2{font-size:30px} #rec .hd{margin-bottom:26px} #rec .rec{gap:14px} #rec .rc{padding:20px 22px}',
    prep: () => { window.__sel = '#rec .rc'; }, anim: revealAnim
  });
  if (want('program')) await still(b, '03_4기에서 이런 활동을 해요', {
    W: 760, H: 950, sec: 'program', pad: '56px 40px', css: '#program h2{font-size:36px} #program .hd{margin-bottom:30px}'
  });
  if (want('buddy')) {
    await still(b, '04_고봉밥 짝꿍 피드백', {
      W: 560, H: 700, sec: 'buddy', pad: '44px 34px',
      css: '#buddy .bshots,#buddy .fine{display:none!important} #buddy .buddy{grid-template-columns:1fr!important} #buddy .bpts{grid-template-columns:1fr!important;gap:14px} #buddy h2{font-size:34px} #buddy .sub{font-size:17px} #buddy .hd{margin-bottom:30px} #buddy .bpt{padding:24px 26px} #buddy .bpt h3{font-size:20px;margin-bottom:8px} #buddy .bpt p{font-size:16px;line-height:1.65}'
    });
    for (const [n, img, label] of [['04b_고봉밥 짝꿍 피드백_예시 1', 's2', '예시 1'], ['04c_고봉밥 짝꿍 피드백_예시 2', 's3', '예시 2']]) {
      await customStill(b, n, { W: 1080, H: 1350,
        css: '#cs{padding:70px 40px;align-items:center} #cs .hd2{align-self:flex-start;display:flex;align-items:center;gap:18px;margin-bottom:34px} #cs .hd2 h2{font-size:42px;font-weight:800;letter-spacing:-.05em;margin:0} #cs .pill2{display:inline-flex;align-items:center;height:48px;padding:0 22px;border-radius:99px;background:#e0ffba;color:#3b6300;font-size:25px;font-weight:800} #cs .shot{width:1000px;border:2px solid #e8e8ea;border-radius:26px;overflow:hidden;box-shadow:0 14px 40px rgba(0,0,0,.08);background:#fff} #cs .shot img{display:block;width:100%;height:auto}',
        html: `<div class="hd2"><h2>고봉밥 짝꿍 피드백</h2><span class="pill2">${label}</span></div><div class="shot"><img src="img/${img}.jpg" alt=""></div>` });
    }
  }
  if (want('reviews')) await video(b, '05_지난 LC 멤버들의 후기_모션', {
    W: 600, H: 750, sec: 'reviews', pad: '40px 30px 0', secs: 22,
    css: '#reviews{justify-content:flex-start!important} #reviews .masonry{columns:2!important;column-gap:12px} #reviews .rv{padding:16px;margin-bottom:12px} #reviews h2{font-size:30px} #reviews .sub{font-size:14.5px} #wrapR{flex:1;min-height:0;overflow:hidden;position:relative;-webkit-mask-image:linear-gradient(to bottom,transparent,#000 4%,#000 94%,transparent);mask-image:linear-gradient(to bottom,transparent,#000 4%,#000 94%,transparent)}',
    prep: () => { const m = document.querySelector('#reviews .masonry'); const w = document.createElement('div'); w.id = 'wrapR'; m.parentNode.insertBefore(w, m); w.appendChild(m); },
    anim: ({ t, total }) => { const m = document.querySelector('#reviews .masonry'), w = document.getElementById('wrapR'); const dist = Math.max(0, m.scrollHeight - w.clientHeight + 24); const k = Math.max(0, Math.min(1, (t - 1.2) / (total - 2.4))); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; m.style.transform = 'translateY(' + (-dist * (0.5 * k + 0.5 * e)) + 'px)'; }
  });
  if (want('schedule')) {
    await still(b, '06_5주 활동 한눈에 보기', { W: 760, H: 950, sec: 'schedule', pad: '28px 36px', css: SCHED_CSS });
    await still(b, '06b_5주 활동 한눈에 보기_비즈니스 트랙 포함', { W: 840, H: 1050, sec: 'schedule', pad: '30px 38px', css: SCHED_CSS, prep: () => { document.querySelector('#cal .seg button[data-view="biz"]').click(); } });
  }

  if (want('tracks')) {
    // 7a 개요 (변경 없음)
    await customStill(b, '07a_레클에는 2-track이 있어요_개요', { W: 600, H: 750, css: '#cs h2{font-size:30px;font-weight:800;letter-spacing:-.04em;margin:0 0 22px} #cs .trk{gap:14px} #cs .tk{padding:26px 28px} #cs .tk h3{font-size:24px;margin:10px 0 6px} #cs .tk>p{font-size:15px} #cs .chk{margin-top:12px;gap:6px} #cs .chk li{font-size:14.5px}',
      html: `<h2>레클에는 2-track이 있어요</h2><div class="trk">
      <div class="tk"><span class="badge req">비기너 / 빌더</span><h3>일반 트랙</h3><p>내 이야기를 콘텐츠로 만들고, 꾸준히 운영할 방향을 잡는 5주예요.</p><ul class="chk"><li>주 2~3회 콘텐츠 업로드</li><li>퍼스널 브랜딩 워크북</li><li>1:1 커피챗 · 짝꿍 피드백</li><li>매주 클럽장 콘텐츠 피드백</li></ul></div>
      <div class="tk biz2"><span class="badge new">NEW</span><h3>비즈니스 트랙</h3><p>5주 안에 내 상품 하나를 만들고, 판매를 열어봅니다. 소수로 진행해요.</p><ul class="chk"><li>상품 구성 · 가격 설계</li><li>판매 콘텐츠 · 구매/신청 페이지</li><li>4주차 판매 시작</li><li>첫 판매 회고 · 다음 액션 정리</li></ul></div></div>` });

    // 7b 일반 트랙: 간결하게(추천 대상 + 활동만, 커리큘럼 제외)
    const col = (name, tag, rec, act) => `<div class="gcol"><h3>${name}</h3><p class="gt">${tag}</p><p class="gl">이런 분께 추천해요</p><ul class="chk">${rec.map(x => `<li>${x}</li>`).join('')}</ul><p class="gl">5주 동안</p><div class="pills">${act.map(x => `<span>${x}</span>`).join('')}</div></div>`;
    await customStill(b, '07b_레클에는 2-track이 있어요_일반 트랙', { W: 640, H: 800,
      css: '#cs{padding:44px 32px} #cs .top{margin-bottom:22px} #cs .top h2{font-size:34px;font-weight:800;letter-spacing:-.045em;margin:10px 0 8px} #cs .top p{font-size:16px;color:#4a4a52;margin:0;line-height:1.55} #cs .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px} #cs .gcol{background:#f6f6f7;border-radius:22px;padding:24px 22px 22px} #cs .gcol h3{font-size:26px;margin:0 0 6px;letter-spacing:-.04em} #cs .gt{font-size:14.5px;font-weight:700;line-height:1.45;margin:0 0 18px;color:#4a4a52} #cs .gl{font-size:13px;font-weight:700;color:#8a8a90;margin:0 0 10px} #cs .chk{margin:0 0 22px;gap:9px} #cs .chk li{font-size:15.5px;line-height:1.5;padding-left:18px;color:#111} #cs .chk li::before{width:7px;height:7px;top:.7em} #cs .pills{display:flex;flex-wrap:wrap;gap:7px} #cs .pills span{background:#fff;border-radius:99px;padding:7px 13px;font-size:14px;font-weight:700}',
      html: `<div class="top"><span class="badge req">비기너 / 빌더</span><h2>일반 트랙</h2><p>내 이야기를 콘텐츠로 만들고,<br>꾸준히 운영할 방향을 잡는 5주예요.</p></div><div class="g2">`
        + col('비기너', '처음 시작하는 사람을 위한<br>방향 설정형', ['계정을 만들고 싶지만 무엇부터 할지 모르는 분', '주제와 타깃이 명확하지 않은 분', '콘텐츠 제작 경험이 많지 않은 분', '마케팅 포트폴리오가 필요한 취준생/인턴'], ['주 2회 업로드', '퍼스널 브랜딩 워크북', '1:1 커피챗', '짝꿍 · 클럽장 피드백'])
        + col('빌더', '이미 운영 중인 사람을 위한<br>실행형', ['계정을 1달 이상 운영 중인 분', '업로드 루틴을 되찾고 싶은 분', '데이터로 콘텐츠를 개선하고 싶은 분', '퍼스널브랜딩을 수익화로 넓히고 싶은 분'], ['주 2~3회 업로드', '콘텐츠 진단 워크북', '1:1 커피챗 1회(선택)', '짝꿍 · 클럽장 피드백']) + '</div>' });

    // 7c 비즈니스 트랙: 간결하게
    await customStill(b, '07c_레클에는 2-track이 있어요_비즈니스 트랙', { W: 600, H: 750,
      css: '#cs{padding:44px 36px} #cs h2{font-size:34px;font-weight:800;letter-spacing:-.045em;margin:10px 0 14px} #cs .lead{font-size:19px;line-height:1.5;font-weight:800;margin:0 0 20px;letter-spacing:-.03em} #cs .ex{font-size:14.5px;font-weight:700;color:#3b6300;background:#e0ffba;border-radius:12px;padding:10px 14px;margin:-10px 0 22px;align-self:flex-start} #cs .sm{font-size:15px;color:#8a8a90;margin:0 0 26px;font-weight:600} #cs .gh{font-size:14px;font-weight:700;color:#8a8a90;margin:0 0 10px} #cs .chk{margin:0 0 22px;gap:8px} #cs .chk li{font-size:16px;line-height:1.5;color:#111} #cs .chk li::before{top:.68em} #cs .tline{margin:4px 0 0} #cs .tline li{padding:0 0 11px 32px} #cs .tline li:last-child{padding-bottom:0} #cs .tline h4{font-size:17.5px;margin:1px 0 0;letter-spacing:-.03em} #cs .tline .wl{font-size:12.5px} #cs .tline li::after{top:20px;left:5px} #cs .tline li::before{width:12px;height:12px;border-width:2.5px}',
      html: `<span class="badge new">NEW</span><h2>비즈니스 트랙</h2><p class="lead">5주 안에 나만의 상품을 하나 만들어서<br>판매까지 이어봐요.</p>
      <p class="gh">이런 분께 추천해요</p><ul class="chk"><li>내 경험·노하우를 상품(템플릿, 전자책, 컨설팅)으로 만들고 싶은 분</li><li>콘텐츠는 꾸준히 만들고, 이제 판매 흐름을 만들어보고 싶은 분</li><li>5주 동안 매주 만들고, 공개하고, 함께 회고할 수 있는 분</li></ul><span class="ex">상품 예시) 전자책, 템플릿, 커뮤니티, 컨설팅</span>
      <p class="gh">5주 커리큘럼</p><ol class="tline"><li><span class="wl">1주차</span><h4>OT · 상품 정의서 작성</h4></li><li><span class="wl">2주차</span><h4>상품 초안 구성</h4></li><li><span class="wl">3주차</span><h4>상품 기획 완료 · 판매 준비</h4></li><li><span class="wl">4주차</span><h4>판매 시작</h4></li><li><span class="wl">5주차</span><h4>첫 판매 회고 · 다음 액션 정리</h4></li></ol>` });
  }

  // 8 마지막 장표 (모션): 글자 단위 등장 + 레이어 카드가 쌓이는 배경 + 형광펜 + 흐르는 모토 띠 + 느린 줌
  const chars = (txt, s0, step) => Array.from(txt).map((c, i) => c === ' ' ? ' ' : `<span class="c" data-s="${(s0 + i * step).toFixed(2)}">${c}</span>`).join('');
  const line = (txt, s) => `<span class="m"><span class="ln" data-s="${s}">${txt}</span></span>`;
  if (want('last')) await customVideo(b, '08_마지막 장표_모션', { W: 540, H: 675, secs: 11,
    css: '#cs{align-items:center;text-align:center;padding:0 34px;overflow:hidden} #cs .world{position:absolute;inset:0;transform-origin:50% 45%} #cs .lay{position:absolute;left:50%;top:50%;width:420px;height:400px;margin:-215px 0 0 -210px;border-radius:34px;opacity:0} #cs .blob{position:absolute;border-radius:50%;filter:blur(46px);opacity:.75} #cs .fg{position:relative;z-index:2;transform-origin:50% 45%} #cs .brand{position:absolute;top:34px;left:0;right:0;justify-content:center;font-size:15px;z-index:3;display:flex;opacity:0} #cs .big{font-size:31px;line-height:1.38;font-weight:800;letter-spacing:-.05em;margin:0 0 30px} #cs .big .row{display:block;white-space:nowrap} #cs .c{display:inline-block;opacity:0} #cs .hl{background:linear-gradient(#e0ffba,#e0ffba) no-repeat 0 90%;background-size:0% 40%;display:inline} #cs .m{display:block;overflow:hidden;padding:2px 0} #cs .ln{display:block;opacity:0} #cs .t{font-size:15.5px;line-height:1.7;color:#4a4a52;margin:0 0 20px;font-weight:500} #cs .tick{position:absolute;left:-20px;right:-20px;bottom:48px;height:54px;background:#111;color:#fff;transform:rotate(-3deg);overflow:hidden;z-index:3;opacity:0;display:flex;align-items:center} #cs .tick div{white-space:nowrap;font-size:17px;font-weight:800;letter-spacing:.14em;will-change:transform}',
    html: `<div class="world"><div class="blob" style="width:260px;height:260px;left:-80px;top:-60px;background:#e0ffba"></div><div class="blob" style="width:240px;height:240px;right:-90px;top:200px;background:#ffd9e8"></div><div class="blob" style="width:260px;height:260px;left:-60px;bottom:-40px;background:#d8e8ff"></div>
      <div class="lay" id="l1" style="background:#d8e8ff"></div><div class="lay" id="l2" style="background:#ffd9e8"></div><div class="lay" id="l3" style="background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.10);border:1.5px solid #ececef"></div></div>
    <span class="brand" id="br"><span class="logo"></span>Layered Club</span>
    <div class="fg" id="fg"><p class="big"><span class="row">${chars('우리는 빠른 성장보다', 0.7, 0.05)}</span><span class="row"><span class="hl">${chars('지속 가능한 꾸준함', 1.9, 0.045)}</span>${chars('을 믿어요.', 2.75, 0.05)}</span></p>
    <p class="t">${line('내 이야기를 부담 없이 꺼내고,', 3.9)}${line('그 이야기가 누군가에게 가치가 되고,', 4.2)}${line('기록이 나다운 삶으로 이어지는 걸 지향해요.', 4.5)}</p>
    <p class="t">${line('혼자였다면 포기했을 순간을 함께 넘으며,', 5.9)}${line('각자의 속도로 다음 레이어를 쌓아가요.', 6.2)}</p></div>
    <div class="tick" id="tk"><div id="tkt">${'MOVE AT YOUR OWN PACE, JUST KEEP GOING!  ·  '.repeat(4)}</div></div>`,
    anim: ({ t, total }) => {
      const cl = x => Math.max(0, Math.min(1, x));
      const ease = x => 1 - Math.pow(1 - x, 3);
      const back = x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
      const $ = s => document.querySelector(s);
      const out = cl((t - (total - 0.6)) / 0.5);
      // 레이어 카드: 하나씩 튀어나와 쌓이고, 이후 천천히 떠다녀요
      [['#l1', 0.1, -14, -150, 8], ['#l2', 0.35, 9, -80, -7], ['#l3', 0.6, -4, -10, 4]].forEach(([id, s, rot, y, ph], i) => {
        const k = cl((t - s) / 0.9), e = back(k);
        const fl = Math.sin(t * 0.9 + ph) * 8, dr = Math.cos(t * 0.6 + ph) * 6;
        const el = $(id); el.style.opacity = String(cl(k * 2) * (0.8 - i * 0.05) * (1 - out));
        el.style.transform = 'translate(' + (dr + (1 - e) * (i % 2 ? 160 : -160)) + 'px,' + (y * 0.2 + fl + (1 - e) * 120) + 'px) rotate(' + (rot * e + Math.sin(t * 0.5 + ph) * 1.5) + 'deg) scale(' + (0.6 + 0.4 * e) + ')';
      });
      document.querySelectorAll('.blob').forEach((el, i) => { el.style.transform = 'translate(' + Math.sin(t * 0.7 + i * 2) * 30 + 'px,' + Math.cos(t * 0.6 + i * 2) * 30 + 'px)'; });
      // 브랜드
      $('#br').style.opacity = String(ease(cl((t - 0.2) / 0.6)) * (1 - out));
      // 글자 단위: 아래서 올라오며 블러가 풀리고 살짝 튕겨요
      document.querySelectorAll('.c').forEach(el => { const k = cl((t - parseFloat(el.dataset.s)) / 0.55), e = back(k); el.style.opacity = String(cl(k * 2) * (1 - out)); el.style.transform = 'translateY(' + ((1 - e) * 40) + 'px) scale(' + (0.8 + 0.2 * e) + ')'; el.style.filter = 'blur(' + ((1 - ease(k)) * 7) + 'px)'; });
      // 형광펜 쓸기
      $('.hl').style.backgroundSize = (ease(cl((t - 3.05) / 0.8)) * 100) + '% 40%';
      // 문단: 마스크 안에서 올라와요
      document.querySelectorAll('.ln').forEach(el => { const k = cl((t - parseFloat(el.dataset.s)) / 0.8), e = ease(k); el.style.opacity = String(cl(k * 3) * (1 - out)); el.style.transform = 'translateY(' + ((1 - e) * 110) + '%)'; });
      // 모토 띠: 아래서 올라와 오른쪽→왼쪽으로 계속 흘러요
      const tk = ease(cl((t - 7.5) / 0.8)); const T = $('#tk'); T.style.opacity = String(tk * (1 - out)); T.style.transform = 'rotate(-3deg) translateY(' + ((1 - tk) * 90) + 'px)';
      $('#tkt').style.transform = 'translateX(' + (-(Math.max(0, t - 7.5)) * 110) + 'px)';
      // 전체 카메라: 아주 천천히 다가가요
      $('#fg').style.transform = 'scale(' + (1 + t / total * 0.05) + ')';
      $('.world').style.transform = 'scale(' + (1 + t / total * 0.08) + ')';
    } });

  await b.close();
  console.log('done');
})();
