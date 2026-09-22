require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
const snapNow = key => ({ key, savedAt:'', cost:0, value:0, profit:0, rate:0, fx:S.fx.usdkrw,
                          summary:summaryOf(compute()), state:JSON.parse(JSON.stringify(S)) });
const seriesOf = () => acctSeries(SNAPS).map(s=>s.name+'['+s.rows.map(r=>r?r.value:'—').join(',')+']');
/* updatePrices 의 보유종목 분기를 그대로 옮긴 것 */
function applyQuotes(map){
  const badCur=[];
  S.accounts.forEach(a=>a.h.forEach(h=>{
    if(h.m||!h.c||!h.c.trim()) return;
    const code=h.c.trim(), r=map[code]; if(!(r&&r.ok)) return;
    setCodeMarket(code, srcMarket(r.src, code));
    const pcur = marketCur(marketOfCode(code));
    if(pcur !== a.cur){ h.ps=''; h.pe='통화 안 맞음'; badCur.push(h.n); return; }
    h.p=r.price; h.ps=r.src; h.pe='';
  }));
  return badCur;
}

/* ══ P1-A: 비원화 코인 시세를 계좌 평가액에 넣지 않는지 ══ */
S = normalize({ accounts:[
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:0,h:[
    H('비트코인','KRW-BTC','가상화폐',0.1,1e8), H('이더리움','BTC-ETH','가상화폐',2,0) ]} ],
  fx:{usdkrw:1400} });
SNAPS=[];
{
  const bad = applyQuotes({ 'KRW-BTC':{code:'KRW-BTC',ok:true,price:1.5e8,src:'upbit'},
                            'BTC-ETH':{code:'BTC-ETH',ok:true,price:0.035,src:'upbit'} });
  ok(S.accounts[0].h[0].p===1.5e8, '원화 마켓 단가는 반영 (' + S.accounts[0].h[0].p + ')');
  ok(S.accounts[0].h[1].p===0, 'BTC 기준 단가 0.035 는 넣지 않음 (' + S.accounts[0].h[1].p + ')');
  ok(bad.length===1 && bad[0]==='이더리움', '알림 목록에 담김');
  ok(compute().value===15000000, '계좌 평가액이 코인 시세로 오염되지 않음 (' + compute().value + ')');
}
/* 달러 티커가 원화 계좌에 들어가 있어도 같습니다 */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:0,h:[
    H('삼성전자','005930','한국주식',10,70000), H('애플','AAPL','미국주식',5,0) ]} ],
  fx:{usdkrw:1400} });
SNAPS=[];
{
  const bad = applyQuotes({ '005930':{code:'005930',ok:true,price:75000,src:'naver-basic'},
                            'AAPL':{code:'AAPL',ok:true,price:230,src:'stooq'} });
  ok(S.accounts[0].h[0].p===75000, '국내 종목은 반영');
  ok(S.accounts[0].h[1].p===0 && bad[0]==='애플', '달러 단가 230 을 원화 계좌에 넣지 않음');
  ok(compute().value===750000, '평가액이 환율만큼 부풀지 않음 (' + compute().value + ')');
}
/* 통화가 맞으면 그대로 반영됩니다(막아서는 안 되는 경우) */
S = normalize({ accounts:[{name:'해외',cur:'USD',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',5,0)]}],
  fx:{usdkrw:1400} });
SNAPS=[];
{
  applyQuotes({ 'AAPL':{code:'AAPL',ok:true,price:230,src:'stooq'} });
  ok(S.accounts[0].h[0].p===230, '달러 계좌의 달러 단가는 정상 반영');
}

/* ══ P1-B: 계좌 종류만으로 시장을 박아 버리지 않는지 ══ */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',5,0)]} ], fx:{usdkrw:1400} });
SNAPS=[];
ok(S.mkts['AAPL']==='US', '원화 계좌에 있어도 AAPL 은 US (예전에는 KR 로 박혔습니다) — 실제 ' + S.mkts['AAPL']);
S.reb.mode='all'; S.reb.acct='토스';
ok(codeFitsReb('AAPL')===false, '원화 계좌 계획에서 여전히 막힘');
ok(marketCur(marketOfCode('AAPL'))==='USD', '통화도 달러로 남아 경고가 뜰 수 있음');
/* 모양으로 확실한 것과 애매한 것 */
ok(codeMarketSure('005930')==='KR' && codeMarketSure('AAPL')==='US' && codeMarketSure('BRK-B')==='US',
   '모양이 확실한 코드');
ok(codeMarketSure('KRW-BTC')==='CRYPTO' && codeMarketSure('BTC-ETH')==='CRYPTO_ALT', '코인 마켓도 확실');
ok(codeMarketSure('7203')==='' && codeMarketSure('0700')==='', '4자리 숫자는 모양으로 못 정함');
/* 애매한 코드만 계좌를 근거로 씁니다 */
S = normalize({ accounts:[{name:'일본',cur:'KRW',grp:'투자',cash:0,h:[H('토요타','7203','기타주식',5,0)]}],
  fx:{usdkrw:1400} });
SNAPS=[];
ok(S.mkts['7203']==='KR', '모양으로 못 정하는 코드는 계좌를 따름 (' + S.mkts['7203'] + ')');
/* 이미 적어 둔 대장은 그대로 */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',5,0)]}],
  mkts:{ 'AAPL':'KR' }, fx:{usdkrw:1400} });
ok(S.mkts['AAPL']==='KR', '사용자가/출처가 확정한 값은 덮지 않음');

/* ══ P2: 이름 바뀐 계좌도 기록에서 id 를 찾는지 ══ */
S = normalize({ accounts:[{name:'A',cur:'KRW',grp:'투자',cash:1e6,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
const idA = S.accounts[0].id;
SNAPS.push(snapNow('08012026'));                 /* A 이름 + id 로 저장 */
renameAcct(0,'B',{commit:true});                 /* 별칭 A→B, B 이름 기록은 아직 없음 */
{
  /* 옛 시점(A)을 복원하는 경로 — 이름은 B 로 맞춰지고, id 는 A 기록에서 물려받아야 합니다 */
  const snapState = { accounts:[{name:'A',cur:'KRW',grp:'투자',cash:1e6,h:[]}], fx:{usdkrw:1400} };
  const keepAliases = Object.assign({}, snapState.aliases||{}, S.aliases||{});
  const st = Object.assign({}, snapState, { aliases:keepAliases });
  canonicalizeAcctNames(st);
  const back = normalize(st);
  ok(back.accounts[0].name==='B', '이름은 지금 이름 B 로');
  ok(back.accounts[0].id===idA,
     '옛 이름 A 로 저장된 기록의 id 를 물려받음 (예전에는 새 id 를 발급했습니다) — ' + (back.accounts[0].id===idA?'같음':'다름'));
  S = back;
  ok(acctSeries(SNAPS).length===1 && seriesOf()[0]==='B[1000000]',
     '계열이 갈라지지 않음 (' + seriesOf().join(' / ') + ')');
}
/* 정확히 같은 이름이 있으면 그쪽을 먼저 씁니다 */
S = normalize({ accounts:[{name:'가',cur:'KRW',grp:'투자',cash:1e6,h:[]},
                          {name:'나',cur:'KRW',grp:'투자',cash:2e6,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
const idGa = S.accounts[0].id, idNa = S.accounts[1].id;
SNAPS.push(snapNow('08012026'));
S.aliases = { '가':'나' };                        /* 일부러 엉뚱한 연결을 넣어 둡니다 */
{
  const back = normalize({ accounts:[{name:'나',cur:'KRW',grp:'투자',cash:2e6,h:[]}],
                           aliases:{'가':'나'}, fx:{usdkrw:1400} });
  ok(back.accounts[0].id===idNa,
     '이름이 정확히 같은 기록을 먼저 씀 (' + (back.accounts[0].id===idNa?'나의 id':'가의 id') + ')');
}
`);
