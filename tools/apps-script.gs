/**
 * Layered Club 4기 신청 접수 → 구글 시트
 * 사용법은 구글시트-설정.md 참고
 */
var SHEET_NAME = '신청';
var NOTIFY_EMAIL = ''; // 새 신청이 올 때 알림 메일을 받을 주소. 비워두면 알림 없음.

var HEADERS = ['접수시각','구분','기수','트랙','참가비','성함/닉네임','이메일','연락처','계정 링크','신청 이유','얻어가고 싶은 것','나이','MBTI','독서모임','입금 완료 체크','입금 확인','메모'];

function doPost(e) {
  var p = (e && e.parameter) || {};
  if (!p.name || !p.email) return ContentService.createTextOutput('invalid');

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
  return ContentService.createTextOutput('ok');
}

function doGet() {
  return ContentService.createTextOutput('Layered Club 신청 접수 중');
}
