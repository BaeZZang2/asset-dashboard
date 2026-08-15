/**
 * 자산지기 백엔드 (Google Apps Script)
 * ------------------------------------------------------------------
 * 이 코드는 AI(Claude)가 작성했습니다.
 *
 * 역할
 *  1) 브라우저 대신 서버에서 시세/환율을 조회한다 (CORS 우회)
 *  2) 포트폴리오 데이터를 구글 시트에 저장해 PC/폰 간 동기화한다
 *  3) 저장 시점(스냅샷)을 누적 보관해 통계 분석의 재료를 만든다
 *
 * ── 이번에 바뀐 곳 (시세 조회) ────────────────────────────────────
 * stooq / yahoo 가 HTTP 404 를 돌려준 것은 종목코드가 틀려서가 아닙니다.
 * UrlFetchApp 은 구글 데이터센터 IP 로 나가는데 두 곳 모두 그 대역을
 * 걸러내기 때문에, 멀쩡한 티커에도 404/401 이 옵니다.
 * (야후는 v7/quote 를 닫았고 v8/chart 도 쿠키+crumb 없이는 막습니다.)
 *
 * 그래서 밖으로 나가지 않는 경로를 1순위로 두었습니다.
 *   · 해외 → 시트의 GOOGLEFINANCE 함수 (구글 자체 데이터, 차단 없음)
 *   · 국내 → 네이버 금융 (지금도 잘 붙습니다. 환율이 되는 것과 같은 이유)
 * 서로가 서로의 예비 경로라 한쪽이 막혀도 값이 나옵니다.
 * 기존 stooq / yahoo / naver-world 는 마지막 보조로 그대로 남겨 두었습니다.
 *
 * 배포: 배포 > 배포 관리 > 기존 배포 수정 > 버전 '새 버전' > 배포
 *       (새 배포를 만들면 URL 이 바뀌므로 반드시 '배포 관리' 쪽으로 하세요)
 * ------------------------------------------------------------------
 */

// ▼▼ 반드시 본인만 아는 값으로 바꾸세요. 앱 설정 화면에도 같은 값을 넣습니다. ▼▼
// ※ 기존에 쓰던 값이 있으면 그 값을 그대로 유지하세요. 바꾸면 앱이 연결되지 않습니다.
var SECRET = 'change-me-1234';

// ▼▼ 데이터를 저장할 스프레드시트의 ID. 시트 주소 URL 중간의 긴 문자열입니다.
//    이 스크립트가 스프레드시트에 딸려 만들어진 경우(확장 프로그램 > Apps Script)는
//    비워둬도 됩니다. script.google.com에서 독립적으로 만든 경우에는 반드시 채워야 합니다.
// ※ 기존에 채워 두었다면 그 값을 그대로 유지하세요.
var SHEET_ID = '';

var SH_STATE = '_state';
var SH_SNAP  = '_snapshots';
var SH_QUOTE = '_quote';        // GOOGLEFINANCE 계산에만 쓰는 숨김 시트 (자동 생성)
var CHUNK    = 45000;

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
         '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* ================= 라우팅 ================= */

function doGet(e)  { return handle(e, (e && e.parameter) || {}); }

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  return handle(e, body);
}

function handle(e, p) {
  var out;
  try {
    if (p.action !== 'ping' && String(p.secret || '') !== SECRET) {
      throw new Error('비밀키가 일치하지 않습니다. 앱 설정의 비밀키와 Code.gs의 SECRET을 같게 맞춰주세요.');
    }
    switch (p.action) {
      case 'ping':      out = { ok: true, version: '1.1', sheet: openSS().getName() }; break;
      case 'diag':      out = { ok: true, results: diagnose() }; break;
      case 'search':    out = { ok: true, items: searchSymbol(p.q) }; break;
      case 'quotes':    out = { ok: true, quotes: getQuotes(p.items || []) }; break;
      case 'fx':        out = { ok: true, fx: getFx() }; break;
      case 'load':      out = { ok: true, state: readState(), snapshots: listSnapshots() }; break;
      case 'save':      writeState(p.state); out = { ok: true, savedAt: nowStr() }; break;
      case 'snapshot':  out = { ok: true, savedAt: putSnapshot(p.key, p.summary, p.state), snapshots: listSnapshots() }; break;
      case 'getSnap':   out = { ok: true, state: getSnapshot(p.key) }; break;
      case 'delSnap':   delSnapshot(p.key); out = { ok: true, snapshots: listSnapshots() }; break;
      default:          throw new Error('알 수 없는 요청: ' + p.action);
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
                       .setMimeType(ContentService.MimeType.JSON);
}

/* ================= 시트 유틸 ================= */

function openSS() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  var ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('연결된 스프레드시트가 없습니다. Code.gs 상단의 SHEET_ID에 시트 ID를 넣어주세요.');
  return ss;
}

function sheet(name) {
  var ss = openSS();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function nowStr() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}

function readState() {
  var sh = sheet(SH_STATE);
  var last = sh.getLastRow();
  if (last < 1) return null;
  var vals = sh.getRange(1, 1, last, 1).getValues();
  var s = vals.map(function (r) { return r[0] || ''; }).join('');
  if (!s) return null;
  try { return JSON.parse(s); } catch (err) { return null; }
}

function writeState(state) {
  var sh = sheet(SH_STATE);
  sh.clear();
  var s = JSON.stringify(state || {});
  var rows = [];
  for (var i = 0; i < s.length; i += CHUNK) rows.push([s.substr(i, CHUNK)]);
  if (!rows.length) rows = [['']];
  sh.getRange(1, 1, rows.length, 1).setValues(rows);
}

function snapSheet() {
  var sh = sheet(SH_SNAP);
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, 9).setValues([[
      '시점(mmddyyyy)', '저장시각', '투자액', '평가액', '수익액', '수익률', '환율', '요약JSON', '전체JSON'
    ]]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function putSnapshot(key, summary, state) {
  if (!/^\d{8}$/.test(String(key || ''))) throw new Error('시점 키는 mmddyyyy 8자리여야 합니다.');
  var sh = snapSheet();
  var when = nowStr();
  var row = [
    String(key), when,
    summary.cost || 0, summary.value || 0, summary.profit || 0,
    summary.rate || 0, summary.fx || 0,
    JSON.stringify(summary || {}), JSON.stringify(state || {})
  ];
  var keys = sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().map(function (r) { return String(r[0]); })
    : [];
  var idx = keys.indexOf(String(key));
  if (idx >= 0) sh.getRange(idx + 2, 1, 1, 9).setValues([row]);   // 같은 날짜면 덮어쓰기
  else          sh.appendRow(row);
  return when;
}

function listSnapshots() {
  var sh = snapSheet();
  if (sh.getLastRow() < 2) return [];
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getDisplayValues();
  var raw = sh.getRange(2, 3, sh.getLastRow() - 1, 5).getValues();
  return v.map(function (r, i) {
    var sum = {};
    try { sum = JSON.parse(v[i][7] || '{}'); } catch (e) {}
    return {
      key: String(r[0]), savedAt: r[1],
      cost: Number(raw[i][0]) || 0, value: Number(raw[i][1]) || 0,
      profit: Number(raw[i][2]) || 0, rate: Number(raw[i][3]) || 0,
      fx: Number(raw[i][4]) || 0, summary: sum
    };
  }).sort(function (a, b) { return sortKey(a.key) - sortKey(b.key); });
}

function sortKey(k) { return Number(k.substr(4, 4) + k.substr(0, 2) + k.substr(2, 2)); }

function getSnapshot(key) {
  var sh = snapSheet();
  if (sh.getLastRow() < 2) return null;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getDisplayValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]) === String(key)) { try { return JSON.parse(v[i][8]); } catch (e) { return null; } }
  }
  return null;
}

function delSnapshot(key) {
  var sh = snapSheet();
  if (sh.getLastRow() < 2) return;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues();
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === String(key)) sh.deleteRow(i + 2);
}

/* ================= 외부 조회 공통 ================= */

function fetchText(url, extra) {
  var opt = {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' }
  };
  if (extra) for (var k in extra) opt.headers[k] = extra[k];
  var r = UrlFetchApp.fetch(url, opt);
  if (r.getResponseCode() >= 400) throw new Error('HTTP ' + r.getResponseCode());
  return r.getContentText();
}

function num(x) {
  if (x === null || x === undefined) return NaN;
  var n = parseFloat(String(x).replace(/,/g, '').trim());
  return isFinite(n) ? n : NaN;
}

function isKrCode(c) { return /^\d{6}$/.test(String(c).trim()); }

/* ================= 종목 검색 ================= */

function searchSymbol(q) {
  q = String(q || '').trim();
  if (!q) return [];
  var out = [];

  // 1순위: 네이버 통합 자동완성
  try {
    var u = 'https://m.stock.naver.com/front-api/search/autoComplete?query='
          + encodeURIComponent(q) + '&target=stock,index,marketindicator';
    var j = JSON.parse(fetchText(u, { 'Referer': 'https://m.stock.naver.com/' }));
    var items = (j.result && j.result.items) || j.items || [];
    items.forEach(function (it) {
      var code = it.code || it.cd || '';
      var nation = (it.nationCode || it.nationName || '').toUpperCase();
      out.push({
        code: code,
        name: (it.name || it.nm || '').replace(/<\/?[^>]+>/g, ''),
        market: isKrCode(code) ? 'KR' : 'US',
        reuters: it.reutersCode || '',
        nation: nation,
        src: 'naver-ac'
      });
    });
  } catch (e) {}

  // 2순위: 구형 자동완성 엔드포인트
  if (!out.length) {
    try {
      var u2 = 'https://ac.stock.naver.com/ac?q=' + encodeURIComponent(q) + '&target=stock,index';
      var j2 = JSON.parse(fetchText(u2, { 'Referer': 'https://finance.naver.com/' }));
      (j2.items || []).forEach(function (grp) {
        (grp || []).forEach(function (it) {
          out.push({
            code: it.code, name: it.name,
            market: isKrCode(it.code) ? 'KR' : 'US',
            reuters: it.reutersCode || '', nation: it.nationCode || '', src: 'naver-ac2'
          });
        });
      });
    } catch (e) {}
  }

  // 3순위: 미국 티커 직접 입력으로 간주
  if (!out.length && /^[A-Za-z.\-]{1,6}$/.test(q)) {
    out.push({ code: q.toUpperCase(), name: q.toUpperCase(), market: 'US', reuters: '', nation: 'USA', src: 'raw' });
  }

  var seen = {}, dedup = [];
  out.forEach(function (o) { if (o.code && !seen[o.code]) { seen[o.code] = 1; dedup.push(o); } });
  return dedup.slice(0, 12);
}

/* ================= 시세 조회 ================= */

/**
 * 앱이 보낸 코드 목록을 한 번에 처리합니다.
 *   해외 : GOOGLEFINANCE 일괄 → 실패분만 stooq/yahoo/naver-world
 *   국내 : 네이버 3단계      → 실패분만 GOOGLEFINANCE(KRX:)
 */
function getQuotes(items) {
  var list = (items || []).map(function (it) { return String((it && it.code) || '').trim(); });
  var uniq = [];
  list.forEach(function (c) { if (c && uniq.indexOf(c) < 0) uniq.push(c); });

  var krCodes = uniq.filter(isKrCode);
  var usCodes = uniq.filter(function (c) { return !isKrCode(c); });
  var out = {}, errs = {};

  // ── 해외 ──
  if (usCodes.length) {
    var gf = gfBatch(usCodes);
    usCodes.forEach(function (c) {
      var g = gf[c];
      if (g && g.ok) { out[c] = g; return; }
      errs[c] = (g && g.error) || 'googlefinance: 값 없음';
      try { out[c] = quoteUS(c); }
      catch (e) { errs[c] += ' / ' + e.message; }
    });
  }

  // ── 국내 ──
  var krFail = [];
  krCodes.forEach(function (c) {
    try { out[c] = quoteKR(c); }
    catch (e) { errs[c] = e.message; krFail.push(c); }
  });
  if (krFail.length) {
    var gk = gfBatch(krFail.map(function (c) { return 'KRX:' + c; }));
    krFail.forEach(function (c) {
      var g = gk['KRX:' + c];
      if (g && g.ok) { out[c] = g; delete errs[c]; }
      else errs[c] += ' / ' + ((g && g.error) || 'googlefinance: 값 없음');
    });
  }

  return list.map(function (c) {
    if (!c) return { code: '', ok: false, error: '코드 없음' };
    var q = out[c];
    if (q) { q.code = c; q.ok = true; return q; }
    return { code: c, ok: false, error: errs[c] || '조회 실패' };
  });
}

/**
 * GOOGLEFINANCE 로 여러 심볼을 한 번에 조회합니다.
 * 시트 함수라 외부로 나가지 않으므로 IP 차단의 영향을 받지 않습니다.
 * symbols 예: ['AAPL', 'NASDAQ:NVDA', 'KRX:005930', 'CURRENCY:USDKRW']
 * 반환: { 심볼: {price, name, src, ok} 또는 {ok:false, error} }
 */
function gfBatch(symbols) {
  var res = {};
  if (!symbols || !symbols.length) return res;

  var sh;
  try { sh = quoteSheet(); }
  catch (e) {
    symbols.forEach(function (s) { res[s] = { ok: false, error: 'googlefinance: ' + e.message }; });
    return res;
  }

  try {
    sh.clear();
    var rows = symbols.map(function (s) {
      var q = '"' + String(s).replace(/"/g, '') + '"';
      return [s,
              '=IFERROR(GOOGLEFINANCE(' + q + ',"price"),"")',
              '=IFERROR(GOOGLEFINANCE(' + q + ',"name"),"")'];
    });
    sh.getRange(1, 1, rows.length, 3).setValues(rows);
    SpreadsheetApp.flush();

    // GOOGLEFINANCE 는 값이 늦게 채워집니다. 다 찰 때까지 잠깐 기다립니다.
    var vals = sh.getRange(1, 1, rows.length, 3).getValues();
    for (var t = 0; t < 15; t++) {
      var pending = 0;
      for (var i = 0; i < vals.length; i++) {
        if (vals[i][1] === '' && String(vals[i][2]) === '') pending++;
      }
      if (!pending) break;
      Utilities.sleep(400);
      vals = sh.getRange(1, 1, rows.length, 3).getValues();
    }

    vals.forEach(function (r) {
      var p = num(r[1]);
      res[r[0]] = (isFinite(p) && p > 0)
        ? { price: p, name: String(r[2] || ''), src: 'googlefinance', ok: true }
        : { ok: false, error: 'googlefinance: 모르는 심볼입니다. 해외는 티커(AAPL) 또는 NASDAQ:AAPL, 국내는 KRX:005930 형태여야 합니다.' };
    });
    sh.clear();
  } catch (e) {
    symbols.forEach(function (s) {
      if (!res[s]) res[s] = { ok: false, error: 'googlefinance: ' + e.message };
    });
  }
  return res;
}

function quoteSheet() {
  var ss = openSS();
  var sh = ss.getSheetByName(SH_QUOTE);
  if (!sh) {
    sh = ss.insertSheet(SH_QUOTE);
    try { sh.hideSheet(); } catch (e) {}   // 시트가 하나뿐이면 숨길 수 없습니다
  }
  return sh;
}

/** 국내 상장 종목·ETF (6자리 코드) */
function quoteKR(code) {
  var errs = [];

  try { // 1) 네이버 모바일 API
    var j = JSON.parse(fetchText('https://m.stock.naver.com/api/stock/' + code + '/basic',
                                 { 'Referer': 'https://m.stock.naver.com/' }));
    var p = num(j.closePrice);
    if (isFinite(p) && p > 0) {
      return { price: p, name: j.stockName || '', prev: num(j.closePrice) - num(j.compareToPreviousClosePrice),
               change: num(j.fluctuationsRatio), src: 'naver-basic' };
    }
    errs.push('naver-basic: 가격 없음');
  } catch (e) { errs.push('naver-basic: ' + e.message); }

  try { // 2) 네이버 폴링 API
    var j2 = JSON.parse(fetchText('https://polling.finance.naver.com/api/realtime/domestic/stock/' + code,
                                  { 'Referer': 'https://finance.naver.com/' }));
    var d = (j2.datas && j2.datas[0]) || {};
    var p2 = num(d.closePrice || d.nv);
    if (isFinite(p2) && p2 > 0) {
      return { price: p2, name: d.stockName || d.nm || '', prev: num(d.previousClose || d.pcv),
               change: num(d.fluctuationsRatio || d.cr), src: 'naver-polling' };
    }
    errs.push('naver-polling: 가격 없음');
  } catch (e) { errs.push('naver-polling: ' + e.message); }

  try { // 3) 네이버 금융 HTML 파싱
    var html = fetchText('https://finance.naver.com/item/main.naver?code=' + code);
    var m = html.match(/<p class="no_today">[\s\S]*?<span class="blind">([\d,\.]+)<\/span>/);
    var nm = html.match(/<div class="wrap_company">\s*<h2>\s*<a[^>]*>([^<]+)</);
    if (m) return { price: num(m[1]), name: nm ? nm[1].trim() : '', src: 'naver-html' };
    errs.push('naver-html: 패턴 불일치');
  } catch (e) { errs.push('naver-html: ' + e.message); }

  throw new Error(errs.join(' / '));
}

/**
 * 해외(미국) 티커 — GOOGLEFINANCE 가 실패했을 때만 여기로 옵니다.
 * 아래 세 곳은 구글 데이터센터 IP 를 막고 있어 대개 실패합니다.
 * 그래도 언젠가 풀릴 수 있으니 남겨 둡니다.
 */
function quoteUS(sym) {
  var errs = [];
  var s = sym.toUpperCase();

  try { // 1) Stooq CSV — 전일 종가
    var csv = fetchText('https://stooq.com/q/l/?s=' + encodeURIComponent(s.toLowerCase())
                        + '.us&f=sd2t2ohlcv&h&e=csv');
    var lines = csv.trim().split('\n');
    if (lines.length > 1) {
      var c = lines[1].split(',');
      var p = num(c[6]);
      if (isFinite(p) && p > 0) return { price: p, name: s, date: c[1], src: 'stooq' };
    }
    errs.push('stooq: 데이터 없음');
  } catch (e) { errs.push('stooq: ' + e.message); }

  try { // 2) Yahoo Finance chart
    var j = JSON.parse(fetchText('https://query1.finance.yahoo.com/v8/finance/chart/'
                                 + encodeURIComponent(s) + '?range=5d&interval=1d'));
    var meta = j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
    if (meta) {
      var p2 = num(meta.regularMarketPrice || meta.chartPreviousClose || meta.previousClose);
      if (isFinite(p2) && p2 > 0) {
        return { price: p2, name: meta.shortName || s, prev: num(meta.chartPreviousClose), src: 'yahoo' };
      }
    }
    errs.push('yahoo: 가격 없음');
  } catch (e) { errs.push('yahoo: ' + e.message); }

  try { // 3) 네이버 해외주식
    var suf = ['.O', '.K', '.N'];
    for (var i = 0; i < suf.length; i++) {
      try {
        var j3 = JSON.parse(fetchText('https://api.stock.naver.com/stock/' + s + suf[i] + '/basic',
                                      { 'Referer': 'https://m.stock.naver.com/' }));
        var p3 = num(j3.closePrice);
        if (isFinite(p3) && p3 > 0) return { price: p3, name: j3.stockName || s, src: 'naver-world' + suf[i] };
      } catch (e2) {}
    }
    errs.push('naver-world: 전 시장 실패');
  } catch (e) { errs.push('naver-world: ' + e.message); }

  throw new Error(errs.join(' / '));
}

/* ================= 환율 ================= */

function getFx() {
  var errs = [];

  try { // 1) 네이버 (지금도 잘 됩니다)
    var j = JSON.parse(fetchText(
      'https://api.stock.naver.com/marketindex/exchange/FX_USDKRW/prices?page=1&pageSize=2',
      { 'Referer': 'https://m.stock.naver.com/' }));
    var arr = j.result || j;
    if (arr && arr.length) {
      var p = num(arr[0].closePrice);
      if (isFinite(p) && p > 0) return { usdkrw: p, date: arr[0].localTradedAt || '', src: 'naver-fx' };
    }
    errs.push('naver-fx: 데이터 없음');
  } catch (e) { errs.push('naver-fx: ' + e.message); }

  try { // 2) GOOGLEFINANCE — 외부로 나가지 않는 경로
    var g = gfBatch(['CURRENCY:USDKRW'])['CURRENCY:USDKRW'];
    if (g && g.ok) return { usdkrw: g.price, src: 'googlefinance' };
    errs.push((g && g.error) || 'googlefinance-fx: 값 없음');
  } catch (e) { errs.push('googlefinance-fx: ' + e.message); }

  try {
    var j2 = JSON.parse(fetchText('https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X?range=5d&interval=1d'));
    var m = j2.chart.result[0].meta;
    var p2 = num(m.regularMarketPrice || m.chartPreviousClose);
    if (isFinite(p2) && p2 > 0) return { usdkrw: p2, src: 'yahoo-fx' };
    errs.push('yahoo-fx: 가격 없음');
  } catch (e) { errs.push('yahoo-fx: ' + e.message); }

  try {
    var csv = fetchText('https://stooq.com/q/l/?s=usdkrw&f=sd2t2ohlcv&h&e=csv');
    var c = csv.trim().split('\n')[1].split(',');
    var p3 = num(c[6]);
    if (isFinite(p3) && p3 > 0) return { usdkrw: p3, date: c[1], src: 'stooq-fx' };
    errs.push('stooq-fx: 데이터 없음');
  } catch (e) { errs.push('stooq-fx: ' + e.message); }

  throw new Error(errs.join(' / '));
}

/* ================= 진단 ================= */

function diagnose() {
  var tests = [
    ['국내 시세 (삼성전자 005930)',      function () { return quoteKR('005930'); }],
    ['해외 시세 GOOGLEFINANCE (NVDA)',   function () {
      var g = gfBatch(['NVDA'])['NVDA'];
      if (!g || !g.ok) throw new Error(g ? g.error : '결과 없음');
      return g;
    }],
    ['해외 시세 예비경로 (NVDA)',        function () { return quoteUS('NVDA'); }],
    ['원/달러 환율',                     function () { return getFx(); }],
    ['종목 검색 (TIGER 200)',            function () { return { found: searchSymbol('TIGER 200').length }; }],
    ['시트 쓰기',                        function () { snapSheet(); return { sheet: openSS().getName() }; }]
  ];
  return tests.map(function (t) {
    try { return { name: t[0], ok: true, detail: JSON.stringify(t[1]()) }; }
    catch (e) { return { name: t[0], ok: false, detail: String(e.message || e) }; }
  });
}

/**
 * 편집기에서 직접 눌러 확인하는 용도입니다.
 * 실행 후 왼쪽 '실행 기록' 또는 하단 로그에서 결과를 보세요.
 */
function testQuotes() {
  var samples = ['005930', '360750', 'AAPL', 'NVDA'];   // 삼성전자, TIGER 미국S&P500, 애플, 엔비디아
  Logger.log('시세: ' + JSON.stringify(getQuotes(samples.map(function (c) { return { code: c }; })), null, 2));
  try { Logger.log('환율: ' + JSON.stringify(getFx())); }
  catch (e) { Logger.log('환율 실패: ' + e.message); }
}
