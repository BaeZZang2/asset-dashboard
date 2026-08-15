/**
 * 자산지기 — 시세 조회 모듈 (Google Apps Script)
 * 이 코드는 AI(Claude)가 작성했습니다.
 *
 * ── 왜 이 파일이 필요한가 ────────────────────────────────────────────────
 * stooq / yahoo 가 HTTP 404 를 돌려주는 것은 종목코드가 틀려서가 아닙니다.
 * Apps Script 의 UrlFetchApp 은 구글 데이터센터 IP 로 나가는데,
 * 두 곳 모두 그 대역을 걸러내고 있어서 코드가 멀쩡해도 404/401 이 옵니다.
 * (특히 야후는 v7/quote 를 닫았고, v8/chart 도 쿠키+crumb 없이는 막습니다.)
 *
 * 그래서 밖으로 나가지 않는 경로를 씁니다.
 *   · 해외 종목 → 스프레드시트의 GOOGLEFINANCE 함수 (구글 자체 데이터, 차단 없음)
 *   · 국내 종목 → 네이버 금융 (Apps Script 에서 잘 붙습니다)
 * 서로가 서로의 예비 경로라서 한쪽이 막혀도 값이 나옵니다.
 *
 * ── 붙이는 방법 ──────────────────────────────────────────────────────────
 * 1. Apps Script 편집기에서 파일을 하나 추가하고 이 내용을 그대로 붙여넣습니다.
 * 2. 기존 Code.gs 에서 quotes 액션을 처리하던 부분을 handleQuotes_(payload) 로,
 *    fx 액션을 handleFx_() 로 바꿉니다. 예:
 *        if (action === 'quotes') return json_(handleQuotes_(body));
 *        if (action === 'fx')     return json_(handleFx_());
 * 3. 편집기에서 testQuotes 를 한 번 실행해 보고 (실행 기록에 결과가 찍힙니다)
 *    값이 나오면 웹앱을 새 버전으로 배포합니다.
 *
 * ※ 이 스크립트는 스프레드시트에 연결된(bound) 프로젝트여야 합니다.
 *    GOOGLEFINANCE 를 계산시키려면 시트가 필요하기 때문입니다.
 * ※ GOOGLEFINANCE 시세는 실시간이 아니라 약 20분 지연입니다.
 */

var QUOTE_SHEET = '_quote';   // GOOGLEFINANCE 계산에만 쓰는 숨김 시트

/* ─────────── 프런트가 부르는 진입점 ─────────── */

/** {items:[{code}]} → {ok:true, quotes:[{code, ok, price, src, name, err}]} */
function handleQuotes_(payload) {
  var codes = ((payload && payload.items) || [])
    .map(function (x) { return String((x && x.code) || '').trim(); })
    .filter(function (c) { return c; });
  return { ok: true, quotes: fetchQuotes_(codes) };
}

/** → {ok:true, fx:{usdkrw, src}} */
function handleFx_() {
  var g = quoteGoogleFinance_(['CURRENCY:USDKRW'])['CURRENCY:USDKRW'];
  if (g && g.ok) return { ok: true, fx: { usdkrw: g.price, src: 'googlefinance' } };
  var n = fxNaver_();
  if (n > 0) return { ok: true, fx: { usdkrw: n, src: 'naver-fx' } };
  throw new Error('환율을 가져오지 못했습니다.');
}

/* ─────────── 조회 본체 ─────────── */

function isKrCode_(code) { return /^\d{6}$/.test(String(code).trim()); }

/**
 * 코드 목록을 받아 시세 배열을 돌려줍니다.
 * 국내는 네이버 먼저 → 실패하면 GOOGLEFINANCE(KRX:),
 * 해외는 GOOGLEFINANCE 먼저 → 실패하면 stooq 로 한 번 더 시도합니다.
 */
function fetchQuotes_(codes) {
  var uniq = codes.filter(function (c, i) { return codes.indexOf(c) === i; });
  var kr = uniq.filter(isKrCode_);
  var us = uniq.filter(function (c) { return !isKrCode_(c); });
  var out = {};

  kr.forEach(function (c) { out[c] = quoteNaverKr_(c); });

  if (us.length) {
    var gf = quoteGoogleFinance_(us);
    us.forEach(function (c) { out[c] = gf[c]; });
  }

  // 1차에서 실패한 것만 예비 경로로 다시
  var retryKr = kr.filter(function (c) { return !out[c].ok; });
  if (retryKr.length) {
    var gf2 = quoteGoogleFinance_(retryKr.map(function (c) { return 'KRX:' + c; }));
    retryKr.forEach(function (c) {
      var r = gf2['KRX:' + c];
      if (r && r.ok) out[c] = { code: c, ok: true, price: r.price, src: 'googlefinance', name: r.name };
    });
  }
  us.forEach(function (c) {
    if (out[c] && out[c].ok) return;
    var r = quoteStooqUs_(c);
    if (r.ok) out[c] = r;
    else if (out[c]) out[c].err = out[c].err + ' / ' + r.err;
  });

  return uniq.map(function (c) {
    return out[c] || { code: c, ok: false, err: '조회하지 못했습니다.' };
  });
}

/* ─────────── 경로 1: GOOGLEFINANCE (해외 주력) ─────────── */

/**
 * 심볼 목록을 시트에 한 번에 써서 GOOGLEFINANCE 로 계산시킵니다.
 * symbols 예: ['AAPL', 'NASDAQ:NVDA', 'KRX:005930', 'CURRENCY:USDKRW']
 * → { 심볼: {code, ok, price, src, name, err} }
 */
function quoteGoogleFinance_(symbols) {
  var res = {};
  if (!symbols || !symbols.length) return res;

  var sh = getQuoteSheet_();
  sh.clear();
  var rows = symbols.map(function (s) {
    var q = '"' + String(s).replace(/"/g, '') + '"';
    return [s,
            '=IFERROR(GOOGLEFINANCE(' + q + ',"price"),"")',
            '=IFERROR(GOOGLEFINANCE(' + q + ',"name"),"")'];
  });
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  SpreadsheetApp.flush();

  // GOOGLEFINANCE 는 비동기라 값이 늦게 채워집니다. 다 찰 때까지 조금 기다립니다.
  var vals = [];
  for (var tries = 0; tries < 12; tries++) {
    Utilities.sleep(400);
    vals = sh.getRange(1, 1, rows.length, 3).getValues();
    var pending = vals.filter(function (r) {
      return r[1] === '' && String(r[2]) === '';   // 아직 계산 중
    }).length;
    if (!pending) break;
  }

  vals.forEach(function (r) {
    var price = Number(r[1]);
    res[r[0]] = (r[1] !== '' && isFinite(price) && price > 0)
      ? { code: r[0], ok: true, price: price, src: 'googlefinance', name: String(r[2] || '') }
      : { code: r[0], ok: false, price: 0, src: '', name: '',
          err: 'googlefinance: 모르는 종목입니다. 해외는 티커(AAPL) 또는 거래소를 붙인 형태(NASDAQ:AAPL), 국내는 KRX:005930 형태로 넣어야 합니다.' };
  });
  sh.clear();
  return res;
}

function getQuoteSheet_() {
  var ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('스프레드시트에 연결된 스크립트가 아닙니다. 시트에서 확장 프로그램 → Apps Script 로 연 프로젝트여야 합니다.');
  var sh = ss.getSheetByName(QUOTE_SHEET);
  if (!sh) { sh = ss.insertSheet(QUOTE_SHEET); sh.hideSheet(); }
  return sh;
}

/* ─────────── 경로 2: 네이버 금융 (국내 주력) ─────────── */

/** 국내 6자리 코드 → 현재가. 주식과 ETF 모두 같은 페이지를 씁니다. */
function quoteNaverKr_(code) {
  try {
    var url = 'https://finance.naver.com/item/main.naver?code=' + encodeURIComponent(code);
    var r = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true, followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; asset-keeper/1.0)' }
    });
    if (r.getResponseCode() !== 200) {
      return { code: code, ok: false, price: 0, src: '', name: '',
               err: 'naver: HTTP ' + r.getResponseCode() };
    }
    var html = r.getContentText('EUC-KR');
    var m = html.match(/<p class="no_today">[\s\S]*?<span class="blind">([\d,]+)<\/span>/);
    if (!m) {
      return { code: code, ok: false, price: 0, src: '', name: '',
               err: 'naver: 페이지에서 현재가를 못 찾았습니다. 상장폐지되었거나 6자리 코드가 틀렸을 수 있습니다.' };
    }
    var price = Number(m[1].replace(/,/g, ''));
    var t = html.match(/<title>\s*([^<:]+?)\s*:/);
    if (!(price > 0)) {
      return { code: code, ok: false, price: 0, src: '', name: '', err: 'naver: 현재가가 0으로 나옵니다.' };
    }
    return { code: code, ok: true, price: price, src: 'naver', name: t ? t[1].trim() : '' };
  } catch (e) {
    return { code: code, ok: false, price: 0, src: '', name: '', err: 'naver: ' + e.message };
  }
}

/* ─────────── 경로 3: stooq (해외 예비) ─────────── */

/** 해외 티커 → 종가. stooq 는 미국 종목에 .us 를 붙여야 합니다(대소문자 무관). */
function quoteStooqUs_(ticker) {
  try {
    var sym = String(ticker).toLowerCase().replace(/\.us$/, '') + '.us';
    var url = 'https://stooq.com/q/l/?s=' + encodeURIComponent(sym) + '&f=sd2t2ohlcv&h&e=csv';
    var r = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; asset-keeper/1.0)' }
    });
    if (r.getResponseCode() !== 200) {
      return { code: ticker, ok: false, err: 'stooq: HTTP ' + r.getResponseCode() };
    }
    var lines = r.getContentText().trim().split('\n');   // Symbol,Date,Time,Open,High,Low,Close,Volume
    if (lines.length < 2) return { code: ticker, ok: false, err: 'stooq: 빈 응답' };
    var cols = lines[1].split(',');
    var price = Number(cols[6]);
    if (!isFinite(price) || price <= 0) {
      return { code: ticker, ok: false, err: 'stooq: 값이 없습니다 (' + lines[1] + ')' };
    }
    return { code: ticker, ok: true, price: price, src: 'stooq', name: '' };
  } catch (e) {
    return { code: ticker, ok: false, err: 'stooq: ' + e.message };
  }
}

/* ─────────── 환율 예비 경로 ─────────── */

function fxNaver_() {
  try {
    var url = 'https://m.stock.naver.com/front-api/marketIndex/productDetail'
            + '?category=exchange&reutersCode=FX_USDKRW';
    var r = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; asset-keeper/1.0)' }
    });
    if (r.getResponseCode() !== 200) return 0;
    var j = JSON.parse(r.getContentText());
    return Number(j && j.result && j.result.calcPrice) || 0;
  } catch (e) { return 0; }
}

/* ─────────── 점검용 ─────────── */

/**
 * Apps Script 편집기에서 이 함수를 실행하면 각 경로가 살아 있는지 바로 보입니다.
 * 보기 → 실행 기록(로그) 에서 결과를 확인하세요.
 */
function testQuotes() {
  var samples = ['005930', '360750', 'AAPL', 'NVDA'];   // 삼성전자, TIGER 미국S&P500, 애플, 엔비디아
  Logger.log('시세: ' + JSON.stringify(fetchQuotes_(samples), null, 2));
  try { Logger.log('환율: ' + JSON.stringify(handleFx_())); }
  catch (e) { Logger.log('환율 실패: ' + e.message); }
}
