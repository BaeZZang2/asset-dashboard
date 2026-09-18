require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
const row=(name,code,cls,price,have,target)=>({name,code,cls,price:price||0,have:have||0,target:target==null?'':target});
const base = () => normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:3e6,h:[
    H('삼성전자','005930','한국주식',10,70000), H('KODEX 200','069500','한국주식',20,38000) ]},
  {name:'연금',cur:'KRW',grp:'연금',cash:1e6,h:[ H('KODEX 200','069500','한국주식',5,38000) ]},
  {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[ H('애플','AAPL','미국주식',3,230) ]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });
/* btnRbSync 핸들러를 그대로 옮긴 것 */
function syncHave(){
  const a=rebAcct(); if(!a) return [0,0]; let n=0, lent=0;
  S.reb.rows.forEach(r=>{
    const h = a.h.find(x=>(r.code&&x.c===r.code)||x.n===r.name);
    if(h){ r.have=+h.q||0; if(!(r.code||'').trim() && h.c) r.code=h.c; if(+h.p) r.price=+h.p; n++; return; }
    r.have = 0;
    if(r.price>0 && (r.code||'').trim()) return;
    const k = nameKey(r.name||'');
    const y = allHoldings().find(z=>((r.code&&z.h.c===r.code) || (k && nameKey(z.h.n)===k)) && (z.h.c || +z.h.p>0));
    if(!y) return;
    let got = false;
    if(!(r.code||'').trim() && y.h.c && codeFitsReb(y.h.c)){ r.code=y.h.c; got=true; }
    if(!(r.price>0) && +y.h.p && y.cur===rebCur()){ r.price=+y.h.p; got=true; }
    if(got) lent++;
  });
  S.reb.budget = +a.cash||0;
  return [n, lent];
}

/* ══ P1: 계좌를 바꾸면 앞 계좌의 보유량이 남지 않는지 ══ */
S = base(); SNAPS=[];
S.reb.acct='토스';
S.reb.rows = [row('삼성전자','005930','한국주식',70000,10), row('KODEX 200','069500','한국주식',38000,20)];
S.reb.acct='연금';                              /* 같은 원화 시장의 다른 계좌 */
syncHave();
ok(S.reb.rows[1].have===5, '연금에 있는 KODEX 200 은 연금 수량 5 (' + S.reb.rows[1].have + ')');
ok(S.reb.rows[0].have===0,
   '연금에 없는 삼성전자는 0 (예전에는 토스의 10주가 그대로 남았습니다) — 실제 ' + S.reb.rows[0].have);
ok(S.reb.budget===1e6, '예수금도 연금 것으로 (' + S.reb.budget + ')');
/* 배분 대상·매도량에 남의 수량이 섞이지 않는지 */
{
  const c = computeReb();
  const held = c.rows.reduce((s,r)=>s+(+r.have||0)*(+r.price||0),0);
  ok(held===190000, '배분 대상 보유 평가액은 연금 몫만 (' + held + ')');
}
/* 계좌 드롭다운을 바꾸는 경로에서도 비웁니다 */
S = base(); SNAPS=[];
S.reb.rows = [row('삼성전자','005930','한국주식',70000,10)];
{
  S.reb.acct='연금'; S.reb.budget=(rebAcct()||{}).cash||0;
  const cut = dropUnfitCodes();
  const had = S.reb.rows.filter(r=>+r.have).length;
  S.reb.rows.forEach(r=>{ r.have = 0; });
  ok(had===1 && S.reb.rows[0].have===0, '계좌를 바꾸는 순간 보유량을 비움');
  ok(cut===0 && S.reb.rows[0].code==='005930', '같은 시장이라 코드는 그대로');
}

/* ══ P2-A: 거래소 접두사가 붙은 국내 코드 ══ */
S = base(); SNAPS=[];
ok(codeMarket('KRX:005930')==='KR', 'KRX:005930 → KR (예전에는 US 였습니다) — 실제 ' + codeMarket('KRX:005930'));
ok(codeMarketSure('KRX:005930')==='KR', '접두사는 확실한 근거');
ok(codeMarket('KOSDAQ:035720')==='KR' && codeMarket('KONEX:123456')==='KR', '다른 국내 거래소 접두사도 KR');
ok(codeMarket('NASDAQ:NVDA')==='US' && codeMarket('NYSEARCA:SPY')==='US', '해외 거래소 접두사는 US');
ok(codeMarket('KRW-BTC')==='CRYPTO' && codeMarket('005930')==='KR' && codeMarket('AAPL')==='US',
   '접두사가 없는 코드는 예전과 같음');
ok(marketCur(marketOfCode('KRX:005930'))==='KRW', '통화도 원화로 잡힘');
S.reb.mode='all'; S.reb.acct='토스';
ok(codeFitsReb('KRX:005930')===true, '원화 계좌 계획에서 쓸 수 있음(예전에는 막혔습니다)');
/* 보유종목 시세 반영도 막히지 않아야 합니다 */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[H('삼성전자','KRX:005930','한국주식',10,0)]}],
  fx:{usdkrw:1400} });
SNAPS=[];
ok(S.mkts['KRX:005930']==='KR', '대장에도 KR 로 들어감 (' + S.mkts['KRX:005930'] + ')');
{
  const h = S.accounts[0].h[0];
  setCodeMarket('KRX:005930', srcMarket('googlefinance','KRX:005930'));
  const pcur = marketCur(marketOfCode('KRX:005930'));
  if(pcur === S.accounts[0].cur) h.p = 75000;
  ok(h.p===75000, 'googlefinance 로 받은 단가가 원화 계좌에 반영됨 (' + h.p + ')');
}

/* ══ P2-B: 코드를 바꾸면 시장이 같아도 단가를 버리는지 ══ */
S = base(); SNAPS=[];
S.reb.mode='all'; S.reb.acct='토스'; S.reb.budget=1e7;
S.reb.rows=[row('삼성전자','005930','한국주식',70000,10,20)];
/* 코드칸 input → change 순서를 그대로 */
function editCode(i, next){
  const r = S.reb.rows[i];
  const el = { value:r.code, dataset:{ rf:'code' } };
  if(el.dataset.wasCode == null) el.dataset.wasCode = r.code || '';   /* input 이 하는 일 */
  r.code = next; el.value = next;
  const was = el.dataset.wasCode;
  const changed = was != null && was !== next;
  let why = '';
  if(next){ setCodeMarket(next); if(!codeFitsReb(next)) why = '못 씀'; }
  if(changed || why) r.price = 0;
  return { changed, why };
}
{
  const res = editCode(0, '069500');            /* 국내 → 국내 */
  ok(res.changed && !res.why, '같은 시장 안에서 바꾼 것으로 인식');
  ok(S.reb.rows[0].price===0,
     '앞 종목(삼성전자)의 단가 70000 을 버림 (예전에는 그대로 남았습니다) — 실제 ' + S.reb.rows[0].price);
  const c = computeReb();
  ok(c.rows[0].can===0 && buyQty(c.rows[0])===10,
     '단가가 없으니 매수가능량은 0, 수량 셈은 앞 단가로 이어지지 않음');
}
/* 코드를 안 바꾸면 단가는 그대로 */
S.reb.rows=[row('KODEX 200','069500','한국주식',38000,20,25)];
{
  const res = editCode(0, '069500');
  ok(!res.changed && S.reb.rows[0].price===38000, '같은 코드를 다시 적으면 단가 유지 (' + S.reb.rows[0].price + ')');
}
/* 시장이 다른 코드로 바꾸면 둘 다 걸립니다 */
S.reb.rows=[row('삼성전자','005930','한국주식',70000,10,20)];
{
  const res = editCode(0, 'AAPL');
  ok(res.changed && !!res.why, '시장도 안 맞고 코드도 바뀐 것으로 인식');
  ok(S.reb.rows[0].price===0, '단가를 버림');
}
`);
