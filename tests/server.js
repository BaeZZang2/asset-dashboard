/* 서버(apps-script/Code.gs) 안의 '판단' 함수들을 봅니다.
   Apps Script 로 올려야 도는 코드지만, 코드 모양을 가리는 판단은 여기서 확인할 수 있습니다.
   앱과 서버가 '어느 시장 코드인가' 를 다르게 보면, 국내 ETF 가 해외 조회로 넘어가고
   앱은 그 출처만 보고 US 로 적습니다(TIGER KRX금현물 411060 이 그랬습니다). */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'), 'utf8');
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);

let F;
try { F = new Function(src + '; return { isKrCode, krDigits, isCoinCode, searchSymbol };')(); }
catch(e){ console.log('  실패 Code.gs 를 읽을 수 없습니다: ' + e.message); process.exit(1); }

/* 국내 코드로 알아보는 모양 — 앱의 codeMarketFixed 와 같은 집합이어야 합니다 */
[['411060', '411060', '6자리 숫자'],
 ['KRX:411060', '411060', '거래소를 밝힌 코드'],
 ['KOSDAQ:411060', '411060', '코스닥 접두사'],
 ['411060.KS', '411060', '야후식 코스피 접미사'],
 ['411060.KQ', '411060', '야후식 코스닥 접미사']].forEach(([c, want, why])=>{
  ok(F.isKrCode(c) === true, why + '(' + c + ') 은 국내로 알아봄');
  ok(F.krDigits(c) === want, '  조회는 6자리로 — ' + JSON.stringify(F.krDigits(c)));
});
/* 국내가 아닌 것을 국내로 보지 않습니다 */
[['AAPL','미국 티커'],['BRK.B','미국 클래스 주식'],['KRW-BTC','업비트 마켓'],
 ['A411060','증권사 표기(앱도 국내로 보지 않습니다)']].forEach(([c,why])=>
  ok(F.isKrCode(c) === false, why + '(' + c + ') 은 국내로 보지 않음'));
ok(F.isCoinCode('KRW-BTC') === true && F.isCoinCode('411060') === false, '코인 코드 판단은 그대로');

/* 검색이 못 찾았을 때의 마지막 수단 — 국내 코드 모양이면 KR 로 돌려줘야 합니다.
   'US' 로 돌려주면 앱이 그 말을 믿고 원화 계좌의 현재가를 버립니다. */
{
  /* 밖으로 나가는 호출만 막고 마지막 분기를 봅니다 */
  const G = new Function(
    src.replace(/function fetchText\([\s\S]*?\n\}/, 'function fetchText(){ throw new Error("no net"); }')
    + '; return searchSymbol;')();
  const kr = G('411060');
  ok(kr.length===1 && kr[0].market==='KR' && kr[0].code==='411060',
     '국내 코드를 직접 적으면 KR 로 돌려줌 — ' + JSON.stringify(kr[0] && {c:kr[0].code, m:kr[0].market}));
  const ks = G('411060.KS');
  ok(ks.length===1 && ks[0].market==='KR' && ks[0].code==='411060',
     '야후식 접미사도 KR, 코드는 6자리로 — ' + JSON.stringify(ks[0] && {c:ks[0].code, m:ks[0].market}));
  const us = G('AAPL');
  ok(us.length===1 && us[0].market==='US', '미국 티커는 그대로 US');
  const none = G('TIGER KRX금현물');
  ok(none.length===0, '이름만 적은 경우에는 억지로 코드를 만들지 않음 (' + none.length + '개)');
}
