require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const A = (n,cur,cash)=>({name:n,cur,grp:'투자',cash:cash||0,h:[]});
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});

/* ── 순납입: 환율 변동은 납입이 아니다 ── */
const mk = (key,fx,krwCost,usdCost,krwVal,usdVal) => ({ key, savedAt:'', fx,
  cost:Math.round(krwCost+usdCost*fx), value:Math.round(krwVal+usdVal*fx), profit:0, rate:0,
  summary:{ fx, alloc:{}, accounts:{
    '국내':{cost:Math.round(krwCost),value:Math.round(krwVal),cur:'KRW',costLoc:krwCost},
    '미국':{cost:Math.round(usdCost*fx),value:Math.round(usdVal*fx),cur:'USD',costLoc:usdCost} } } });
S = normalize({ accounts:[A('국내','KRW'),A('미국','USD')], fx:{usdkrw:1477} });
SNAPS=[mk('08162026',1478.5,12e7,50792,14e7,60000), mk('08172026',1477,12e7,50792,14e7,60000)];
ok(Math.round(stats().netIn)===0, '환율만 움직이면 순납입 0');
SNAPS=[mk('08162026',1478.5,12e7,50792,14e7,60000), mk('08172026',1477,12e7,51792,14e7,61000)];
ok(Math.round(stats().netIn)===1477000, '달러 1,000불 납입 = 1,477,000원');

/* ── CAGR: 짧은 기록에서는 감춘다 ── */
SNAPS=[mk('08162026',1478.5,12e7,50792,14e7,60000), mk('08172026',1477,12e7,50792,14e7,60000)];
ok(stats().cagr===null, '하루 기록이면 CAGR 미표시');
SNAPS=[mk('04182026',1478.5,12e7,50792,14e7,60000), mk('08162026',1478.5,12e7,50792,148e6,60000)];
ok(stats().cagr!==null, '120일 기록이면 CAGR 표시');

/* ── 상장 시장 판정 ── */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:0,h:[H('TIGER 미국S&P500','360750','미국주식',10,21000)]},
  {name:'해외',cur:'USD',grp:'투자',cash:0,h:[H('NVIDIA','NVDA','미국주식',5,120)]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',mode:'all'} });
ok(rebMarket({name:'TIGER 미국S&P500',code:'',cls:'미국주식'})==='KR', '국내 상장 미국 ETF → KR');
S.reb.acct='해외';   /* 전체 재배분은 고른 계좌 시장을 따릅니다 */
ok(rebMarket({name:'NVIDIA',code:'',cls:'미국주식'})==='US', '달러 계좌를 고르면 → US');
S.reb.acct='토스';
ok(rebMarket({name:'NVIDIA',code:'',cls:'미국주식'})==='KR', '원화 계좌를 고르면 → KR (그 계좌에서 거래하므로)');
ok(rebMarket({name:'이더리움',code:'',cls:'가상화폐'})==='',
   '코인을 살 수 없는 계좌의 전체 재배분에서는 코인을 찾지 않음');
S.reb.mode='cash';
ok(rebMarket({name:'이더리움',code:'',cls:'가상화폐'})==='CRYPTO', '추가 매수에서 처음 보는 코인 → CRYPTO');
S.reb.mode='all';

/* ── 추가 매수 목표값 이관 ── */
S = normalize({ accounts:[A('a','KRW')], fx:{usdkrw:1400},
  reb:{acct:'a',mode:'cash',budget:1e6,rows:[{name:'X',code:'',cls:'한국주식',price:38000,have:10,target:33}]} });
ok(S.reb.rows[0].target===23 && buyQty(S.reb.rows[0])===23, '옛 계획 target 33 → 사야 할 양 23');
S = normalize(JSON.parse(JSON.stringify(S)));
ok(S.reb.rows[0].target===23, '두 번 불러도 또 깎이지 않음');

/* ── 계좌 색은 금액 순위에 흔들리지 않는다 ── */
const snapV = (key,vals)=>({ key, savedAt:'', cost:0,value:0,profit:0,rate:0,fx:1400,
  summary:{fx:1400,alloc:{},accounts:Object.fromEntries(vals.map((v,i)=>['계좌'+(i+1),{cost:v,value:v,cur:'KRW',costLoc:v}]))} });
S = normalize({ accounts:Array.from({length:10},(_,i)=>A('계좌'+(i+1),'KRW')), fx:{usdkrw:1400} });
const col = a=>Object.fromEntries(a.map(s=>[s.name,s.color]));
const c1=col(acctSeries([snapV(1,[10,90,20,30,40,50,60,70,80,5])]));
const c2=col(acctSeries([snapV(1,[99,1,20,30,40,50,60,70,80,5])]));
ok(Object.keys(c1).every(k=>!c2[k]||c1[k]===c2[k]), '금액 순위가 뒤바뀌어도 계좌 색 고정');

/* ── 이름 바꾼 달러 계좌: 모르면 예전 방식으로 물러난다 ── */
const oldSnap=(key,fx,krw,usdKrw,names)=>({ key,savedAt:'',fx, cost:Math.round(krw+usdKrw), value:0,profit:0,rate:0,
  summary:{fx,alloc:{},accounts:{[names[0]]:{cost:Math.round(krw),value:0},[names[1]]:{cost:Math.round(usdKrw),value:0}}} });
S = normalize({ accounts:[A('국내','KRW'),A('미국','USD')], fx:{usdkrw:1477} });
SNAPS=[oldSnap('08162026',1478.5,12e7,50792*1478.5,['국내','미국']), oldSnap('08172026',1477,12e7,50792*1477,['국내','미국'])];
ok(Math.round(stats().netIn)===0, '옛 기록 + 이름 그대로 → 순납입 0');
S = normalize({ accounts:[A('국내','KRW'),A('미국주식계좌','USD')], fx:{usdkrw:1477} });
ok(Math.round(stats().netIn)!==0, '옛 기록 + 달러 계좌 이름 바뀜 → 예전 방식으로 물러남');

/* ── 이름이 겹치는 계좌 ── */
S = normalize({ accounts:[
  {name:'새 계좌',cur:'KRW',grp:'투자',cash:1e6,h:[H('삼성전자','005930','한국주식',10,70000)]},
  {name:'새 계좌',cur:'USD',grp:'투자',cash:100,h:[H('NVIDIA','NVDA','미국주식',5,120)]} ], fx:{usdkrw:1400} });
const sm = summaryOf(compute());
ok(Object.keys(sm.accounts).length===2, '같은 이름 계좌 둘 다 기록에 남음');
ok(Object.values(sm.accounts).reduce((s,a)=>s+a.cost,0)===sm.cost, '계좌별 원금 합 = 전체 원금');
ok(S.accounts[0].name==='새 계좌' && S.accounts[1].name==='새 계좌 2',
   '불러올 때 겹친 이름을 갈라 둠 ('+S.accounts.map(a=>a.name).join(' / ')+')');
ok(uniqueAcctName('새 계좌',-1)==='새 계좌 3', '새 계좌 이름에 숫자를 붙임 ('+uniqueAcctName('새 계좌',-1)+')');
S = normalize({ accounts:[A('토스','KRW'),A('연금','KRW')], fx:{usdkrw:1400} });
ok(uniqueAcctName('토스',0)==='토스', '자기 이름을 그대로 두는 것은 중복이 아님');
ok(uniqueAcctName('연금',0)==='연금 2', '남이 쓰는 이름으로 바꾸면 숫자를 붙임');

/* ── 이름을 바꿔도 계좌 기록이 쪼개지지 않는다 ── */
S = normalize({ accounts:[A('토스 국내','KRW')], fx:{usdkrw:1400} });
renameAcct(0,'토스증권',{commit:true});
const sw=(key,name,cost,value)=>({key,savedAt:'',cost,value,profit:value-cost,rate:0,fx:1400,
  summary:{fx:1400,alloc:{},accounts:{[name]:{cost,value,cur:'KRW',costLoc:cost}}}});
SNAPS=[sw('08152026','토스 국내',1e7,11e6), sw('08252026','토스증권',1e7,12e6)];
const se=acctSeries(SNAPS);
ok(se.length===1 && se[0].rows.every(r=>r), '이름 바꿔도 계좌 계열은 하나');
ok(Math.round(stats().netIn)===0 && Math.round(stats().gainTot)===1e6, '이름 바꿔도 순납입 0 / 손익 100만');

/* ── 방식 전환 시 통화가 섞이지 않는다 ── */
S = normalize({ accounts:[
  {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[H('NVIDIA','NVDA','미국주식',5,120)]},
  {name:'토스',cur:'KRW',grp:'투자',cash:3e6,h:[H('KODEX 200','069500','한국주식',10,38000)]} ],
  fx:{usdkrw:1400}, reb:{acct:'해외',mode:'all'} });
S.reb.rows=[{name:'NVIDIA',code:'NVDA',cls:'미국주식',price:120,have:5,target:''}]; S.reb.budget=5000;
S.reb.mode='cash'; switchRebMode();
ok(S.reb.rows.length===0 && S.reb.budget===0, '달러 행·달러 금액은 추가 매수로 넘어오지 않음');
S.reb.mode='all'; S.reb.rows=[{name:'KODEX 200',code:'069500',cls:'한국주식',price:38000,have:15,target:''}];
S.reb.mode='cash'; switchRebMode();
ok(S.reb.rows.length===1, '원화 계좌 종목은 그대로 남음');
`);
