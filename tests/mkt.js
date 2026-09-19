require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
const row=(name,code,cls,price,have)=>({name,code,cls,price:price||0,have:have||0,target:''});
const base = extra => normalize(Object.assign({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:3e6,h:[H('KODEX 200','069500','한국주식',10,38000)]},
  {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[H('애플','AAPL','미국주식',3,230)]},
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:0,h:[H('비트코인','KRW-BTC','가상화폐',0.1,1.5e8)]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} }, extra||{}));

/* ══ 1. 대장 채우기 — 그 코드를 담고 있는 계좌가 근거 ══ */
S = base(); SNAPS=[];
ok(S.mkts['069500']==='KR' && S.mkts['AAPL']==='US' && S.mkts['KRW-BTC']==='CRYPTO',
   '보유 계좌로 대장을 채움 (069500=' + S.mkts['069500'] + ', AAPL=' + S.mkts['AAPL'] + ', KRW-BTC=' + S.mkts['KRW-BTC'] + ')');

/* 한 코드가 통화 다른 계좌 양쪽에 걸쳐 있으면 근거가 못 되므로 코드 모양으로 ══ */
S = normalize({ accounts:[
  {name:'원화',cur:'KRW',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',1,230)]},
  {name:'달러',cur:'USD',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',1,230)]} ], fx:{usdkrw:1400} });
ok(S.mkts['AAPL']==='US', '통화가 엇갈리면 코드 모양으로 가늠 (AAPL=' + S.mkts['AAPL'] + ')');

/* ══ 2. 적어 둔 대장은 살아남고, 이상한 값은 버림 ══ */
S = base({ mkts:{ '069500':'US', 'aapl':'KR', '7203':'KR', 'X':'NASDAQ' } });
ok(S.mkts['069500']==='US', '적어 둔 값이 보유 계좌 추론보다 먼저 (069500=' + S.mkts['069500'] + ')');
ok(S.mkts['AAPL']==='KR', '코드는 대문자로 모음 (aapl → AAPL=' + S.mkts['AAPL'] + ')');
ok(S.mkts['X']===undefined, '시장 이름이 아닌 값은 버림');

/* ══ 3. 코드 모양이 못 맞히는 것을 대장이 바로잡음 ══ */
S = base(); SNAPS=[];
ok(codeMarket('7203')==='US', '코드 모양만 보면 7203 은 해외로 보임');
setCodeMarket('7203','KR');                          /* 검색 결과가 KR 이라고 알려준 상황 */
ok(marketOfCode('7203')==='KR', '대장에 적히면 KR (' + marketOfCode('7203') + ')');
ok(codeFitsReb('7203')===true, '원화 계획에서 쓸 수 있음');
setCodeMarket('7203','US');
ok(marketOfCode('7203')==='US', '더 확실한 근거가 오면 덮어씀 (' + marketOfCode('7203') + ')');
setCodeMarket('7203','');
ok(marketOfCode('7203')==='US', '근거 없는 호출은 적힌 값을 덮지 않음');

/* ══ 4. 시세 출처로 시장을 확정 ══ */
ok(srcMarket('naver-basic')==='KR' && srcMarket('naver-polling')==='KR', '네이버 국내 시세 → KR');
ok(srcMarket('naver-world1')==='US' && srcMarket('stooq')==='US' && srcMarket('yahoo')==='US', '해외 소스 → US');
ok(srcMarket('upbit','KRW-BTC')==='CRYPTO', '업비트 원화 마켓 → CRYPTO');
ok(srcMarket('upbit','BTC-ETH')==='CRYPTO_ALT', '업비트 BTC 마켓 → CRYPTO_ALT');
ok(srcMarket('googlefinance','005930')==='' && srcMarket('','005930')==='', '국내·해외 겸용/빈 값은 판단하지 않음');

/* 6자리 숫자라 국내처럼 보이는 코드라도, 시세가 해외에서 왔으면 원화 계획에서 막힘 */
S = base(); SNAPS=[];
S.reb.mode='cash'; S.reb.rows=[row('수수께끼','123456','기타주식',38000,0)];
ok(codeFitsReb('123456')===true, '코드 모양으로는 원화 계획에 통과');
setCodeMarket('123456', srcMarket('stooq','123456'));         /* 실제로는 해외에서 받아온 시세 */
ok(codeFitsReb('123456')===false, '출처가 해외로 확인되면 원화 계획에서 막힘');

/* ══ 5. 계획의 통화 하나로 판정 ══ */
S = base(); SNAPS=[];
S.reb.mode='cash';
ok(rebCur()==='KRW', '추가 매수는 원화로 셈함');
ok(codeFitsReb('069500') && codeFitsReb('KRW-BTC') && !codeFitsReb('AAPL'),
   '원화 계획: 국내·코인은 되고 달러 종목은 안 됨');
S.reb.mode='all'; S.reb.acct='해외';
ok(rebCur()==='USD', '달러 계좌를 고르면 달러로 셈함');
ok(codeFitsReb('AAPL') && !codeFitsReb('069500') && !codeFitsReb('KRW-BTC'),
   '달러 계획: 달러 종목만 되고 국내·코인은 안 됨');
ok(codeFitsReb('')===true, '코드가 없는 행은 막지 않음');

/* ══ 6. 계좌를 바꿔 통화가 달라지면 코드·단가를 비움 ══ */
S = base(); SNAPS=[];
S.reb.acct='토스';
S.reb.rows=[row('KODEX 200','069500','한국주식',38000,10), row('애플','',' 미국주식'.trim(),0,0)];
ok(dropUnfitCodes()===0, '원화 계좌에서는 국내 코드를 그대로 둠');
S.reb.acct='해외';
ok(dropUnfitCodes()===1, '달러 계좌로 옮기면 국내 코드 1개를 비움');
ok(S.reb.rows[0].code==='' && S.reb.rows[0].price===0, '비운 행은 코드·단가 모두 0 (전에는 단가가 남았습니다)');

/* ══ 7. 불변식: 검색할 시장은 늘 이 계획에서 쓸 수 있는 시장 ══ */
S = base(); SNAPS=[];
const probes = [row('애플','AAPL','미국주식'), row('KODEX 200','069500','한국주식'),
                row('비트코인','KRW-BTC','가상화폐'), row('비트코인','','가상화폐'),
                row('처음 보는 종목','','기타주식'), row('애플','','미국주식')];
let bad = [];
[['cash','토스'],['all','토스'],['all','해외'],['all','업비트']].forEach(([mode,acct])=>{
  S.reb.mode=mode; S.reb.acct=acct;
  probes.forEach(r=>{
    const m = rebMarket(r);
    if(m && marketCur(m)!==rebCur()) bad.push(mode+'/'+acct+'/'+(r.name||r.code)+'→'+m);
  });
});
ok(bad.length===0, '어떤 방식·계좌에서도 못 쓰는 시장을 내놓지 않음' + (bad.length?' ('+bad.join(', ')+')':''));

/* 검색이 붙여 준 코드는 검증을 언제나 통과 ══ */
S = base(); SNAPS=[]; S.reb.mode='cash'; S.reb.acct='토스';
S.reb.rows=[row('삼성전자','','한국주식')];
const jobs = matchJobs(null).filter(j=>j.label==='삼성전자');
ok(jobs.length===1 && jobs[0].market==='KR', '원화 계획의 새 종목은 국내에서 찾음');
jobs[0].apply('005930','삼성전자','KR');
ok(S.reb.rows[0].code==='005930' && codeFitsReb('005930'), '찾아 붙인 코드는 그대로 쓸 수 있음');
ok(S.mkts['005930']==='KR', '검색이 알려준 시장이 대장에 남음');

/* 달러 계획에서는 코인 행을 아예 찾지 않음 */
S = base(); SNAPS=[]; S.reb.mode='all'; S.reb.acct='해외';
S.reb.rows=[row('이더리움','','가상화폐')];
ok(matchJobs(null).filter(j=>j.label==='이더리움').length===0,
   '달러 계획에서 코인은 검색 대상에서 빠짐(업비트 시세는 원화)');

/* ══ 8. 대장은 저장·불러오기를 넘어 남음 ══ */
S = base(); SNAPS=[];
setCodeMarket('7203','KR');
const again = normalize(JSON.parse(JSON.stringify(S)));
ok(again.mkts['7203']==='KR', '다시 불러와도 대장이 남음 (' + again.mkts['7203'] + ')');
`);
