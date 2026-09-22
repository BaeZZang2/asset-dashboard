require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});

/* ══ P1: 추가 매수 후보에 달러 코드가 섞이지 않는지 ══ */
/* 원화 계좌에 달러 티커가 잘못 들어 있는 상태(예전 데이터·오입력) */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[
    H('KODEX 200','069500','한국주식',10,38000),
    H('애플','AAPL','미국주식',5,230) ]} ],          /* 원화 계좌인데 달러 코드 */
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'cash',budget:1e7,rows:[]} });
SNAPS=[];
{
  const all = pickable();
  ok(all.every(o=>!o.code || codeFitsReb(o.code)),
     '목록에 쓸 수 없는 코드가 없음 (' + all.map(o=>o.code||'(코드없음)').join(', ') + ')');
  const apple = all.find(o=>o.nk===nameKey('애플'));
  ok(!!apple, '종목 자체는 목록에 남음 (빼 버리면 방식을 바꿀 때 행이 조용히 사라집니다)');
  ok(apple.code==='' && apple.price===0,
     '달러 코드와 단가만 비워 둠 (예전에는 코드·단가가 그대로 있어 고르면 들어왔습니다) — 코드 '
     + JSON.stringify(apple.code) + ', 단가 ' + apple.price);
  ok(apple.have===5, '보유량은 사실이므로 그대로 (' + apple.have + ')');
  ok(all.some(o=>o.code==='069500'), '원화 종목은 그대로 있음');
}
/* 고르더라도 달러 단가가 들어올 길이 없습니다 */
{
  const list = pickable('미국주식');
  ok(list.length===1 && list[0].code==='' && list[0].price===0,
     '자산군으로 좁혀도 코드·단가 없이 남음');
  const r = {name:'',code:'',cls:'미국주식',price:0,have:0,target:''};
  const o = list[0];
  r.name=o.name; r.code=o.code; r.price=o.price; r.have=o.have;
  ok(r.price===0, '골라도 단가 0 — 달러 단가 230 이 원화 계획에 들어가지 않음');
}
/* 방식을 바꿀 때 그 행이 사라지지 않는지 */
{
  S.reb.mode='all'; S.reb.rows=[{name:'애플',code:'AAPL',cls:'미국주식',price:230,have:5,wOverride:'30',target:'2'}];
  S.reb.mode='cash'; switchRebMode();
  ok(S.reb.rows.length===1,
     '추가 매수로 바꿔도 행이 남음 (후보에서 빼던 동안은 0 개가 됐습니다) — 실제 '
     + S.reb.rows.length + '개');
  ok(S.reb.rows[0].wOverride==='30', '적어 둔 비중도 남음');
}
/* 전체 재배분에서 달러 계좌를 고르면 다시 후보가 됩니다(과하게 막지 않음) */
S = normalize({ accounts:[
  {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[H('애플','AAPL','미국주식',5,230)]},
  {name:'토스',cur:'KRW',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',5,230)]} ],
  fx:{usdkrw:1400}, reb:{acct:'해외',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
{
  /* pickable 은 원화 계좌만 훑지만, 판단은 계획 기준이라 달러 계획에서는 통과합니다 */
  S.reb.mode='all'; S.reb.acct='해외';
  const all = pickable();
  ok(all.some(o=>o.code==='AAPL'), '달러 계획에서는 AAPL 후보가 살아 있음');
  S.reb.mode='cash';
  ok(!pickable().some(o=>o.code==='AAPL'), '추가 매수(원화)에서는 다시 빠짐');
}
/* 코드가 없는 후보는 판단할 수 없으니 남깁니다 */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[
  H('직접입력','','기타주식',1,33000) ]}],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'cash',budget:0,rows:[]} });
SNAPS=[];
ok(pickable().length===1 && pickable()[0].code==='', '코드 없는 후보는 그대로 남음');

/* ══ P2: 다른 계좌에서 단가를 빌릴 때도 정규화된 코드로 견주는지 ══ */
/* 고른 계좌에는 없고, 같은 통화의 다른 계좌에 대문자로 저장된 상태 */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[]},
  {name:'연금',cur:'KRW',grp:'연금',cash:0,h:[H('KODEX 200','069500','한국주식',5,38000)]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
{
  /* btnRbSync 의 빌려오기 분기를 그대로 */
  const a = rebAcct();
  const r = { name:'KODEX 200', code:'069500', cls:'한국주식', price:0, have:0, target:'' };
  const rc = (r.code||'').trim();
  const h = a.h.find(x=>(rc&&mktKey(x.c)===mktKey(rc))||x.n===r.name);
  ok(!h, '고른 계좌에는 없음');
  const k = nameKey(r.name||'');
  const cands = allHoldings().filter(z=>
    ((rc&&mktKey(z.h.c)===mktKey(rc)) || (k && nameKey(z.h.n)===k)) && (z.h.c || +z.h.p>0));
  const y = cands.find(z=>(z.h.c||'').trim() && codeFitsReb(z.h.c)) || cands[0];
  const srcCode = (y.h.c||'').trim();
  const fits = !!srcCode && codeFitsReb(srcCode);
  if(!(r.price>0) && +y.h.p && fits && y.cur===rebCur() && (!rc || mktKey(rc)===mktKey(srcCode))) r.price=+y.h.p;
  ok(r.price===38000, '대문자로 저장된 종목에서 단가를 빌려옴 (' + r.price + ')');
}
/* 행의 코드가 소문자인 경우 — 예전에는 마지막 원문 비교에서 거부됐습니다 */
{
  const a = rebAcct();
  const r = { name:'KODEX 200', code:'069500', cls:'한국주식', price:0, have:0, target:'' };
  r.code = '069500'.toLowerCase();                     /* 숫자라 그대로지만, 아래 티커로 다시 봅니다 */
  const rc = (r.code||'').trim();
  const cands = allHoldings().filter(z=>
    ((rc&&mktKey(z.h.c)===mktKey(rc)) || (nameKey(r.name) && nameKey(z.h.n)===nameKey(r.name))) && (z.h.c || +z.h.p>0));
  const y = cands[0];
  const srcCode = (y.h.c||'').trim();
  if(!(r.price>0) && +y.h.p && codeFitsReb(srcCode) && y.cur===rebCur() && (!rc || mktKey(rc)===mktKey(srcCode))) r.price=+y.h.p;
  ok(r.price===38000, '코드 대소문자가 달라도 빌려옴');
}
/* 알파벳 티커로도 확인 — aapl vs AAPL */
S = normalize({ accounts:[
  {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[]},
  {name:'해외2',cur:'USD',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',5,230)]} ],
  fx:{usdkrw:1400}, reb:{acct:'해외',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
{
  const r = { name:'애플', code:'aapl', cls:'미국주식', price:0, have:0, target:'' };
  const rc = (r.code||'').trim();
  const cands = allHoldings().filter(z=>
    ((rc&&mktKey(z.h.c)===mktKey(rc)) || (nameKey(r.name) && nameKey(z.h.n)===nameKey(r.name))) && (z.h.c || +z.h.p>0));
  ok(cands.length===1, '후보 찾기는 mktKey 로 잘 찾음 (' + cands.length + '개)');
  const y = cands[0], srcCode = (y.h.c||'').trim();
  const fits = !!srcCode && codeFitsReb(srcCode);
  const lend = !(r.price>0) && +y.h.p && fits && y.cur===rebCur() && (!rc || mktKey(rc)===mktKey(srcCode));
  ok(lend===true,
     '소문자 aapl 도 단가를 빌릴 수 있음 (예전에는 원문 비교에서 거부돼 0 으로 남았습니다)');
  if(lend) r.price = +y.h.p;
  ok(r.price===230, '단가 230 이 들어감 (' + r.price + ')');
}

/* ══ 같은 클래스의 나머지 자리도 통일됐는지 (시세 실패를 두 번 세지 않기) ══ */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[
  H('애플','AAPL','미국주식',5,0) ]}],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
{
  /* 리밸런싱 표의 코드가 소문자여도 '계좌에도 있는 코드' 로 알아봐야 합니다 */
  const code = 'aapl';
  const alsoHeld = S.accounts.some(a=>a.h.some(h=>mktKey(h.c)===mktKey(code)));
  ok(alsoHeld===true,
     '대소문자가 달라도 계좌에 있는 코드로 알아봄 (예전에는 실패를 두 번 셌습니다)');
}
`);
