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
    if(pcur !== a.cur){ h.p=0; h.ps=''; h.pe='통화 안 맞음'; badCur.push(h.n); return; }
    h.p=r.price; h.ps=r.src; h.pe='';
  }));
  return badCur;
}

/* ══ P1: 통화가 안 맞으면 들고 있던 단가도 버리는지 ══ */
/* 코드를 다른 통화 시장 코드로 바꾼 뒤 업데이트한 상황 */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:0,h:[ H('삼성전자','005930','한국주식',10,70000) ]} ],
  fx:{usdkrw:1400} });
SNAPS=[];
ok(compute().value===700000, '고치기 전 평가액 70만원 (' + compute().value + ')');
S.accounts[0].h[0].c = 'AAPL';                        /* 코드만 해외 종목으로 바꿈 */
{
  const bad = applyQuotes({ 'AAPL':{code:'AAPL',ok:true,price:230,src:'stooq'} });
  ok(bad.length===1, '통화 불일치로 걸림');
  ok(S.accounts[0].h[0].p===0,
     '들고 있던 단가 70000 도 버림 (예전에는 그대로 남았습니다) — 실제 ' + S.accounts[0].h[0].p);
  ok(compute().value===0,
     '평가액이 옛 단가로 셈되지 않음 (예전에는 70만원이 계속 나왔습니다) — 실제 ' + compute().value);
}
/* 계좌 통화를 바꾼 상황에서도 같습니다 */
S = normalize({ accounts:[
  {name:'해외',cur:'USD',grp:'투자',cash:0,h:[ H('애플','AAPL','미국주식',5,230) ]} ],
  fx:{usdkrw:1400} });
SNAPS=[];
S.accounts[0].cur = 'KRW';                            /* 계좌 통화만 바꿈 */
{
  applyQuotes({ 'AAPL':{code:'AAPL',ok:true,price:240,src:'stooq'} });
  ok(S.accounts[0].h[0].p===0, '계좌 통화를 바꾼 경우에도 옛 단가를 버림 (' + S.accounts[0].h[0].p + ')');
}
/* 통화가 맞으면 지우지 않습니다 */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:0,h:[ H('삼성전자','005930','한국주식',10,70000) ]} ],
  fx:{usdkrw:1400} });
SNAPS=[];
{
  applyQuotes({ '005930':{code:'005930',ok:true,price:75000,src:'naver-basic'} });
  ok(S.accounts[0].h[0].p===75000, '통화가 맞으면 새 단가로 갱신 (' + S.accounts[0].h[0].p + ')');
}
/* 조회 자체가 실패하면 손대지 않습니다(손으로 적은 단가를 지키기 위해) */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:0,h:[ H('삼성전자','005930','한국주식',10,70000) ]} ],
  fx:{usdkrw:1400} });
SNAPS=[];
{
  applyQuotes({ '005930':{code:'005930',ok:false,error:'조회 실패'} });
  ok(S.accounts[0].h[0].p===70000, '조회 실패는 단가를 건드리지 않음 (' + S.accounts[0].h[0].p + ')');
}

/* ══ P2: 새로 만든 계좌에 id 가 바로 붙는지 ══ */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e6,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
/* acctModal 이 만드는 것과 같은 객체 두 개를 연달아 추가합니다 */
const mk = (name,grp) => ({ id:newAcctId(), name, cur:'KRW', grp:grp||'투자', cash:0, h:[] });
const n1 = mk('새 계좌'), n2 = mk('새 거래소','가상자산');
n1.cash = 2e6; n2.cash = 3e6;
S.accounts.push(n1); S.accounts.push(n2);
ok(!!n1.id && !!n2.id && n1.id!==n2.id, '만드는 순간 서로 다른 id 를 받음');
ok(new Set(S.accounts.map(a=>acctKey(a))).size===3, '계좌 열쇠 3개가 모두 다름');
SNAPS.push(snapNow('08012026'));
ok(acctSeries(SNAPS).length===3,
   '세 계좌가 모두 그래프에 남음 (예전에는 새 계좌 둘이 한 열쇠로 뭉쳐 하나가 빠졌습니다) — 실제 '
   + acctSeries(SNAPS).length + '개');
ok(seriesOf().join(' / ')==='토스[1000000] / 새 계좌[2000000] / 새 거래소[3000000]',
   '금액도 각자 제 것 (' + seriesOf().join(' / ') + ')');
const sm = SNAPS[0].summary.accounts;
ok(sm['새 계좌'].id===n1.id && sm['새 거래소'].id===n2.id, '시점 기록에도 각자의 id 가 들어감');

/* id 가 없는 계좌가 섞여 있어도 한 열쇠로 뭉치지 않습니다 */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e6,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
S.accounts.push({ name:'옛 방식 A', cur:'KRW', grp:'투자', cash:2e6, h:[] });
S.accounts.push({ name:'옛 방식 B', cur:'KRW', grp:'투자', cash:3e6, h:[] });
ok(acctKey(S.accounts[1])==='nm:옛 방식 A' && acctKey(S.accounts[2])==='nm:옛 방식 B',
   'id 가 없으면 이름으로 물러남 (' + acctKey(S.accounts[1]) + ')');
ok(new Set(S.accounts.map(a=>acctKey(a))).size===3, 'id:undefined 한 열쇠로 뭉치지 않음');
SNAPS.push(snapNow('08012026'));
ok(acctSeries(SNAPS).length===3, '셋 다 그래프에 남음 (' + acctSeries(SNAPS).length + '개)');
/* 다시 불러오면 id 가 채워집니다 */
{
  const back = normalize(JSON.parse(JSON.stringify(S)));
  ok(back.accounts.every(a=>!!a.id) && new Set(back.accounts.map(a=>a.id)).size===3,
     '불러올 때 빠진 id 를 채워 줌');
}
`);
