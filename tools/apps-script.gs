/**
 * Layered Club 4기 — 신청 접수 + 방문/이탈 기록 + 관리자 통계 API (구글 시트)
 * 사용법은 구글시트-설정.md 참고
 */
var SHEET_NAME = '신청';
var EVENT_SHEET = '이벤트';
var NOTIFY_EMAIL = '';   // 새 신청이 올 때 알림 메일을 받을 주소. 비워두면 알림 없음.
var ADMIN_KEY = '';      // 관리자 페이지 비밀번호. 반드시 길고 어려운 값으로 바꿔요. 비워두면 관리자 페이지가 꺼져요.
var TZ = 'Asia/Seoul';

var HEADERS = ['접수시각','구분','기수','트랙','참가비','성함/닉네임','이메일','연락처','계정 링크','신청 이유','얻어가고 싶은 것','나이','MBTI','독서모임','입금 완료 체크','입금 확인','메모'];
var EVENT_HEADERS = ['시각','방문자','세션','이벤트','상세','기기','유입','소스','화면폭'];

/* ---------- 접수 ---------- */
function doPost(e) {
  var ct = (e && e.postData && e.postData.type) || '';
  if (ct.indexOf('text/plain') === 0) return logEvents_(e);
  return saveApplication_(e);
}

function saveApplication_(e) {
  var p = (e && e.parameter) || {};
  if (!p.name || !p.email) return text_('invalid');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#f1f1f3');
      sh.getRange('H:H').setNumberFormat('@'); // 연락처는 텍스트로 저장
    }
    var row = sh.getLastRow() + 1;
    sh.getRange(row, 8).setNumberFormat('@');
    sh.getRange(row, 1, 1, HEADERS.length).setValues([[
      new Date(), p.memberType || '', p.gen || '', p.track || '', Number(p.price) || '',
      p.name, p.email, p.tel || '', p.link || '', p.why || '', p.goal || '',
      p.age || '', p.mbti || '', p.book || '', p.paid || '', '', ''
    ]]);
    sh.getRange(row, 5).setNumberFormat('#,##0"원"');

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(NOTIFY_EMAIL, '[레클 4기] 새 신청: ' + p.name,
        p.name + ' / ' + (p.track || '') + ' / ' + (p.gen || '') + ' / 입금자명 확인 필요\n' + ss.getUrl());
    }
  } finally {
    lock.releaseLock();
  }
  return text_('ok');
}

/* ---------- 방문/이탈 이벤트 기록 (익명) ---------- */
var EVENT_NAMES = {
  pageview: 1, cta_click: 1, apply_start: 1, gen_select: 1, track_select: 1, form_view: 1, form_start: 1,
  pay_view: 1, copy_account: 1, submit_try: 1, submit_invalid: 1, submit_success: 1
};
function validEvent_(name) {
  return !!EVENT_NAMES[name] || /^(scroll_(25|50|75|100)|section_[a-z]+)$/.test(name);
}

function logEvents_(e) {
  var data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return text_('invalid'); }
  if (!data || data.type !== 'events' || !data.events || !data.events.length) return text_('invalid');
  var vid = String(data.vid || ''), sid = String(data.sid || '');
  if (!/^[a-z0-9]{4,24}$/.test(vid) || !/^[a-z0-9]{4,24}$/.test(sid)) return text_('invalid');
  var meta = data.meta || {};
  var rows = [];
  data.events.slice(0, 50).forEach(function (x) {
    var name = String(x.e || '');
    if (!validEvent_(name)) return;
    rows.push([
      new Date(Number(x.t) || Date.now()), vid, sid, name, String(x.d || '').slice(0, 80),
      String(meta.device || '').slice(0, 12), String(meta.ref || '').slice(0, 60), String(meta.src || '').slice(0, 40), Number(meta.w) || ''
    ]);
  });
  if (!rows.length) return text_('ok');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(EVENT_SHEET) || ss.insertSheet(EVENT_SHEET);
    if (sh.getLastRow() === 0) {
      sh.appendRow(EVENT_HEADERS);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, EVENT_HEADERS.length).setFontWeight('bold').setBackground('#f1f1f3');
    }
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, EVENT_HEADERS.length).setValues(rows);
  } finally {
    lock.releaseLock();
  }
  return text_('ok');
}

/* ---------- 관리자 통계 API ---------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'stats') {
    if (!ADMIN_KEY || p.key !== ADMIN_KEY) return json_({ ok: false, error: 'forbidden' });
    return json_(buildStats_(Math.max(1, Math.min(365, Number(p.days) || 30))));
  }
  return text_('Layered Club 신청 접수 중');
}

function buildStats_(days) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var since = new Date(now.getTime() - days * 86400000);
  var fmt = function (d, f) { return Utilities.formatDate(d, TZ, f); };

  /* 이벤트 */
  var events = [];
  var evSh = ss.getSheetByName(EVENT_SHEET);
  if (evSh && evSh.getLastRow() > 1) {
    var vals = evSh.getRange(2, 1, evSh.getLastRow() - 1, EVENT_HEADERS.length).getValues();
    vals.forEach(function (r) {
      var ts = r[0] instanceof Date ? r[0] : new Date(r[0]);
      if (isNaN(ts.getTime()) || ts < since) return;
      events.push({ ts: ts, vid: String(r[1]), sid: String(r[2]), e: String(r[3]), d: String(r[4]), device: String(r[5]), ref: String(r[6]), src: String(r[7]) });
    });
  }

  var visitors = {}, sessions = {}, dailyPv = {}, dailyUv = {}, dailyUvSet = {};
  var cta = {}, applyMode = {}, tracks = {}, gens = {};
  events.forEach(function (x) {
    var v = visitors[x.vid] || (visitors[x.vid] = { steps: {}, device: x.device, ref: x.ref, src: x.src });
    v.steps[x.e] = true;
    sessions[x.sid] = true;
    var day = fmt(x.ts, 'yyyy-MM-dd');
    if (x.e === 'pageview') {
      dailyPv[day] = (dailyPv[day] || 0) + 1;
      dailyUvSet[day] = dailyUvSet[day] || {};
      dailyUvSet[day][x.vid] = true;
    }
    if (x.e === 'cta_click') cta[x.d || 'other'] = (cta[x.d || 'other'] || 0) + 1;
    if (x.e === 'apply_start') applyMode[x.d || '-'] = (applyMode[x.d || '-'] || 0) + 1;
    if (x.e === 'track_select') tracks[x.d || '-'] = (tracks[x.d || '-'] || 0) + 1;
    if (x.e === 'gen_select') gens[x.d || '-'] = (gens[x.d || '-'] || 0) + 1;
  });

  var vids = Object.keys(visitors);
  var count = function (pred) { var n = 0; vids.forEach(function (k) { if (pred(visitors[k].steps)) n++; }); return n; };

  var daily = [];
  for (var i = days - 1; i >= 0; i--) {
    var d = fmt(new Date(now.getTime() - i * 86400000), 'yyyy-MM-dd');
    daily.push({ d: d, pv: dailyPv[d] || 0, uv: dailyUvSet[d] ? Object.keys(dailyUvSet[d]).length : 0 });
  }

  var funnel = [
    { k: 'visit', label: '방문', n: count(function (s) { return s.pageview; }) },
    { k: 'apply_area', label: '신청 영역까지 내려옴', n: count(function (s) { return s.section_apply || s.cta_click || s.apply_start; }) },
    { k: 'apply_start', label: '신규/기존 선택 (신청 시작)', n: count(function (s) { return s.apply_start; }) },
    { k: 'track_select', label: '트랙 선택', n: count(function (s) { return s.track_select; }) },
    { k: 'form_start', label: '신청서 입력 시작', n: count(function (s) { return s.form_start; }) },
    { k: 'pay_view', label: '입금 안내까지 도달', n: count(function (s) { return s.pay_view; }) },
    { k: 'submit', label: '신청 완료', n: count(function (s) { return s.submit_success; }) }
  ];

  /* 신청을 시작했지만 완료하지 않은 방문자: 마지막으로 도달한 단계별 */
  var drop = { apply_start: 0, track_select: 0, form_start: 0, pay_view: 0 }, invalidOnly = 0, started = 0;
  vids.forEach(function (k) {
    var s = visitors[k].steps;
    if (!s.apply_start || s.submit_success) return;
    started++;
    if (s.pay_view) drop.pay_view++;
    else if (s.form_start) drop.form_start++;
    else if (s.track_select) drop.track_select++;
    else drop.apply_start++;
    if (s.submit_invalid) invalidOnly++;
  });
  var dropoff = [
    { k: 'apply_start', label: '기수·트랙 선택 화면에서 이탈', n: drop.apply_start },
    { k: 'track_select', label: '신청서를 열고 입력하지 않고 이탈', n: drop.track_select },
    { k: 'form_start', label: '신청서 작성 중 이탈', n: drop.form_start },
    { k: 'pay_view', label: '입금 안내까지 보고 이탈', n: drop.pay_view }
  ];

  var scroll = {}, sections = {};
  [25, 50, 75, 100].forEach(function (m) { scroll[m] = count(function (s) { return s['scroll_' + m]; }); });
  ['fit', 'people', 'rec', 'program', 'buddy', 'reviews', 'past', 'schedule', 'tracks', 'apply', 'last'].forEach(function (id) {
    sections[id] = count(function (s) { return s['section_' + id]; });
  });

  var devices = {}, refs = {}, srcs = {};
  vids.forEach(function (k) {
    var v = visitors[k];
    devices[v.device || '-'] = (devices[v.device || '-'] || 0) + 1;
    var r = v.ref || '(직접 접속)'; refs[r] = (refs[r] || 0) + 1;
    if (v.src) srcs[v.src] = (srcs[v.src] || 0) + 1;
  });
  var top = function (o, n) {
    return Object.keys(o).map(function (k) { return { k: k, n: o[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, n);
  };

  /* 신청 목록 */
  var apps = [], paid = 0, sumAll = 0, sumPaid = 0, byTrack = {}, byType = {};
  var apSh = ss.getSheetByName(SHEET_NAME);
  if (apSh && apSh.getLastRow() > 1) {
    var rows = apSh.getRange(2, 1, apSh.getLastRow() - 1, HEADERS.length).getValues();
    rows.forEach(function (r) {
      var ts = r[0] instanceof Date ? r[0] : new Date(r[0]);
      var price = Number(r[4]) || 0;
      var ok = String(r[15] || '').replace(/\s/g, '') !== '';
      if (ok) { paid++; sumPaid += price; }
      sumAll += price;
      byTrack[r[3] || '-'] = (byTrack[r[3] || '-'] || 0) + 1;
      byType[r[1] || '-'] = (byType[r[1] || '-'] || 0) + 1;
      apps.push({
        ts: isNaN(ts.getTime()) ? '' : fmt(ts, 'yyyy-MM-dd HH:mm'), type: r[1], gen: r[2], track: r[3], price: price,
        name: r[5], email: r[6], tel: String(r[7] || ''), link: r[8], why: r[9], goal: r[10], age: r[11], mbti: r[12],
        book: r[13], paidCheck: r[14], confirmed: ok, memo: r[16]
      });
    });
    apps.reverse();
  }

  return {
    ok: true, generatedAt: fmt(now, 'yyyy-MM-dd HH:mm'), days: days,
    totals: { pv: events.filter(function (x) { return x.e === 'pageview'; }).length, uv: funnel[0].n, sessions: Object.keys(sessions).length },
    daily: daily, funnel: funnel, started: started, dropoff: dropoff, invalid: invalidOnly,
    applyMode: applyMode, tracks: tracks, gens: gens, cta: cta, scroll: scroll, sections: sections,
    devices: devices, refs: top(refs, 8), srcs: top(srcs, 8),
    applications: { total: apps.length, confirmed: paid, sumAll: sumAll, sumConfirmed: sumPaid, byTrack: byTrack, byType: byType, rows: apps.slice(0, 500) }
  };
}

function text_(s) { return ContentService.createTextOutput(s); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
