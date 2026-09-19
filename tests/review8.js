require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});

/* ══ P1: 추가 매수의 조회 시장이 달러 보유 때문에 US 로 바뀌지 않는지 ══ */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:3e6,h:[H('KODEX 200','069500','한국주식',10,38000)]},
  {name:'해외',cur:'USD',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',3,230)]},
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:0,h:[H('비트코인','KRW-BTC','가상화폐',0.1,1.5e8)]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',mode:'cash',budget:1e6,rows:[]} });
SNAPS=[];

const row = (name,code,cls)=>({name,code,cls,price:0,have:0,target:''});
ok(rebMarket(row('애플','AAPL','미국주식'))==='KR',
   '추가 매수: 달러 계좌에 있는 AAPL 을 적어도 시장은 KR (실제 '+rebMarket(row('애플','AAPL','미국주식'))+')');
ok(codeMarket('AAPL')!==rebMarket(row('애플','AAPL','미국주식')), '→ 시장 검증이 걸려 달러 단가가 막힘');
ok(rebMarket(row('비트코인','KRW-BTC','가상화폐'))==='CRYPTO', '코인(자산군 가상화폐) → CRYPTO');
ok(rebMarket(row('비트코인','KRW-BTC','기타주식'))==='CRYPTO', '자산군을 안 맞춰도 코인 코드면 CRYPTO');
ok(rebMarket(row('KODEX 200','069500','한국주식'))==='KR', '국내 종목 → KR');

/* 실제로 단가가 막히는지 (updatePrices 의 그 분기를 그대로) */
S.reb.rows=[row('애플','AAPL','미국주식'), row('KODEX 200','069500','한국주식')];
const map={ 'AAPL':{code:'AAPL',ok:true,price:230}, '069500':{code:'069500',ok:true,price:38500} };
const badMkt=[];
S.reb.rows.forEach(r=>{ const c=(r.code||'').trim(); const x=map[c];
  if(x&&x.ok){ if(codeMarket(c)!==rebMarket(r)){ badMkt.push(r.name); return; } r.price=x.price; } });
ok(S.reb.rows[0].price===0 && badMkt[0]==='애플', '달러 단가 230 이 원화 계획에 들어가지 않음');
ok(S.reb.rows[1].price===38500, '국내 종목은 정상 반영');

/* 전체 재배분에서 달러 계좌를 고르면 AAPL 이 정상 */
S.reb.mode='all'; S.reb.acct='해외';
ok(rebMarket(row('애플','AAPL','미국주식'))==='US', '전체 재배분 + 달러 계좌 → US');

/* ══ P2: 이름을 바꾼 뒤 그 계좌를 지워도 옛 기록끼리 이어지는지 ══ */
S = normalize({ accounts:[{name:'A',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
renameAcct(0,'B',{commit:true});
S.accounts.splice(0,1);                            /* 계좌 B 삭제 — 기록만 남음 */
ok(resolveAcct('A')==='B', '지워진 계좌라도 옛 이름 A 는 마지막 이름 B 로 모임');
ok(resolveAcct('B')==='B', 'B 는 그대로');
const sw=(key,name,value)=>({key,savedAt:'',cost:1e7,value,profit:0,rate:0,fx:1400,
  summary:{fx:1400,alloc:{},accounts:{[name]:{cost:1e7,value,cur:'KRW',costLoc:1e7}}}});
SNAPS=[ sw('08012026','A',11e6), sw('09012026','B',12e6) ];
const se=acctSeries(SNAPS);
ok(se.length===1 && se[0].name==='B' && se[0].rows.every(r=>r),
   '이름 바꾸기 전·후 기록이 한 계열로 이어짐 (계열: '+se.map(s=>s.name+'['+s.rows.map(r=>r?Math.round(r.value/1e4)+'만':'빈칸').join(',')+']').join(' / ')+')');
`);
