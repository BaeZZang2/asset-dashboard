require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});

/* ══ P2-A: 자동매칭이 코드만 붙이고 옛 단가를 남기지 않는지 ══ */
/* 코드를 몰라 손으로 단가를 적어 둔 행 — 자동매칭이 달러 코드를 찾아 붙이는 상황입니다.
   자동매칭은 시세 조회를 따라 하지 않으므로, 단가를 남겨 두면 그대로 굳습니다. */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[]}],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'cash',budget:1e7,rows:[]} });
SNAPS=[];
S.reb.rows=[{name:'애플',code:'',cls:'미국주식',price:230,have:0,target:'10'}];
{
  const r = S.reb.rows[0];
  ok(r.price===230, '코드가 없는 동안에는 손으로 적은 단가를 들고 있음 (막을 근거가 없습니다)');
  const jobs = matchJobs();
  const job = jobs.find(j=>j.label==='애플');
  ok(!!job, '자동매칭 대상에 들어감');
  job.apply('AAPL','Apple Inc','US');                  /* 검색 결과를 붙입니다 */
  ok(r.code==='AAPL', '코드가 붙음 (' + r.code + ')');
  ok(r.price===0,
     '옛 단가는 버려짐 (예전에는 230 이 그대로 남아 원화 계획에서 셈됐습니다) — 실제 ' + r.price);
  const c = computeReb();
  ok(c.rows[0].can===0, '매수가능량 0 — 달러 단가로 나눈 수량이 나오지 않음');
  ok(setRebPrice(r,230)===false, '원화 계획에서는 그 뒤로도 단가를 못 넣음');
}
/* 쓸 수 있는 코드를 붙이는 경우에도 '앞 단가' 는 버립니다 — 그 단가가 이 코드의 것이라는
   근거가 없습니다(코드를 모르는 채 적은 값입니다). */
{
  S.reb.rows=[{name:'KODEX 200',code:'',cls:'한국주식',price:12345,have:0,target:'10'}];
  const r = S.reb.rows[0];
  const job = matchJobs().find(j=>j.label==='KODEX 200');
  job.apply('069500','KODEX 200','KR');
  ok(r.code==='069500' && r.price===0,
     '원화 코드를 붙여도 앞 단가는 버림 — ' + r.code + ' / ' + r.price);
  ok(setRebPrice(r,38000)===true && r.price===38000, '새 단가는 정상적으로 받음 (' + r.price + ')');
}
/* 계좌 보유종목 쪽 자동매칭도 같은 규칙 — 원화 계좌에 달러 코드가 붙으면 단가를 버립니다 */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:0,h:[H('애플','','미국주식',5,7000)]},
  {name:'해외',cur:'USD',grp:'투자',cash:0,h:[H('애플','','미국주식',5,230)]} ],
  fx:{usdkrw:1400} });
SNAPS=[];
{
  const krw = S.accounts[0].h[0], usd = S.accounts[1].h[0];
  ok(krw.p===7000 && usd.p===230, '코드가 없는 동안에는 각자 적어 둔 단가를 들고 있음');
  const g = codeGroups().find(g=>g.label==='애플');
  ok(g.rows.length===2, '두 계좌의 같은 이름 종목이 한 그룹 (' + g.rows.length + '곳)');
  applyToGroup(g, 'AAPL', 'Apple Inc', 'US');
  ok(krw.c==='AAPL' && usd.c==='AAPL', '두 곳에 코드가 붙음');
  ok(usd.p===230, '달러 계좌 단가는 그대로 (' + usd.p + ')');
  ok(krw.p===0,
     '원화 계좌 단가는 버려짐 (예전에는 7000 이 남아 평가액이 환율만큼 틀어졌습니다) — 실제 '
     + krw.p);
  ok(!!krw.pe && /USD/.test(krw.pe), '왜 못 넣었는지 이유가 남음');
  ok(holdPriceOk('KRW','AAPL')===false && holdPriceOk('USD','AAPL')===true, '판단은 한 함수에서');
}
/* 이름으로 코드를 가져올 때도 통화를 봅니다 — 달러 계좌의 230 이 원화 계좌로 넘어가면
   안 됩니다. (이름으로 '퍼뜨리는' 쪽은 보유종목 표에서 코드 칸이 없어져 더는 쓰이지 않아
   지웠습니다 — 닿지 않는 코드에 검사를 붙여 두면 덮여 있는 것처럼 보입니다.) */
S = normalize({ accounts:[
  {name:'해외',cur:'USD',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',5,230)]},
  {name:'토스',cur:'KRW',grp:'투자',cash:0,h:[H('','','미국주식',1,0)]} ],
  fx:{usdkrw:1400} });
SNAPS=[];
{
  const dst = S.accounts[1].h[0];
  dst.n = '애플';
  ok(pullByName(dst, 'KRW')===true, '같은 이름 종목에서 코드를 가져옴');
  ok(dst.c==='AAPL' && dst.p===0,
     '코드만 가져오고 달러 단가는 안 가져옴 — ' + dst.c + ' / ' + dst.p);
}

/* ══ 스스로 찾은 것: 사람이 코드를 손으로 적을 때는 넘겨짚어 단가를 지우지 않는지 ══ */
/* 자동매칭은 검색 결과가 시장을 알려 주므로 근거가 있습니다. 손입력에는 근거가 없고,
   BTC 처럼 모양만으로는 시장을 알 수 없는 코드가 있습니다(코드 모양 규칙은 US 로 봅니다).
   근거 없이 지우면 적어 둔 값을 되돌릴 방법이 없습니다. */
S = normalize({ accounts:[
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:0,h:[H('비트코인','','가상화폐',0.5,5e7)]} ],
  fx:{usdkrw:1400} });
SNAPS=[];
{
  const h = S.accounts[0].h[0];
  const g = codeGroups().find(g=>g.label==='비트코인');
  applyToGroup(g, 'BTC', '', '');                      /* 사람이 손으로 적은 경우 — 시장을 모릅니다 */
  ok(h.c==='BTC', '코드는 들어감 (' + h.c + ')');
  ok(h.p===5e7,
     '적어 둔 단가는 지우지 않음 (넘겨짚은 시장으로 지우면 되돌릴 수 없습니다) — 실제 ' + h.p);
  /* 검색 결과가 시장을 알려 주면 그때는 판단합니다 */
  const g2 = codeGroups().find(g=>g.label==='비트코인');
  applyToGroup(g2, 'AAPL', 'Apple Inc', 'US');
  ok(h.p===0 && !!h.pe, '근거가 있을 때는 통화가 안 맞는 단가를 버림 (' + h.p + ')');
}

/* ══ 스스로 찾은 것: 이름만 적은 행을 채울 때 코드와 단가의 짝이 어긋나지 않는지 ══ */
/* 같은 이름인데 하나는 코드가 없고(손으로 적은 단가), 하나는 코드가 있는 상태입니다.
   코드만 가져오고 단가는 앞 종목 것을 그대로 두면 매수량이 몇 배로 틀어집니다. */
S = normalize({ accounts:[
  {name:'해외',cur:'USD',grp:'투자',cash:1000,h:[
    H('애플','','미국주식',1,7000),                    /* 코드를 몰라 손으로 적어 둔 값 */
    H('애플','AAPL','미국주식',2,230) ]} ],
  fx:{usdkrw:1400}, reb:{acct:'해외',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
{
  const row = fillRow({name:'애플',code:'',cls:'미국주식'});
  ok(row.code==='AAPL', '코드는 코드가 있는 종목에서 가져옴 (' + row.code + ')');
  ok(row.price===230,
     '단가도 그 코드의 종목 것 (예전에는 코드 없는 종목의 7000 이 붙어 30배 틀렸습니다) — 실제 '
     + row.price);
  ok(row.have===3, '보유량은 둘을 합침 (' + row.have + ')');
}

/* 손으로 적은 단가는 조회출처·사유를 건드리지 않습니다 — 지워 버리면 뱃지가 '조회 실패' 로
   바뀌어, 바뀌지 않은 상태를 바뀐 것처럼 보여 줍니다. */
{
  const h = {n:'KODEX 200',c:'069500',q:1,b:0,m:false,v:0,p:38000,ps:'naver',pn:'',pe:''};
  ok(setHoldPrice(h, 39000, 'KRW')===true && h.p===39000 && h.ps==='naver',
     '손입력은 값만 바꾸고 조회출처는 그대로 (' + h.p + ' / ' + h.ps + ')');
  ok(setHoldPrice(h, 40000, 'KRW', 'stooq')===true && h.ps==='stooq' && h.pe==='',
     '시세로 넣을 때는 출처가 바뀜 (' + h.ps + ')');
  /* 못 넣을 때는 출처를 지우고 이유를 남깁니다 — 옛 출처가 남으면 '조회됨' 으로 보입니다 */
  h.c = 'AAPL'; setCodeMarket('AAPL','US');
  ok(setHoldPrice(h, 230, 'KRW')===false && h.p===0 && h.ps==='' && !!h.pe,
     '못 넣을 때는 단가·출처를 버리고 이유를 남김 (' + h.p + ' / ' + JSON.stringify(h.ps) + ')');
}

/* ══ P2-B: 다시 그려도 편집 중인 값이 살아 있는지 ══ */
/* 화면이 없는 껍데기에서는 '들고 있다가 되돌리는' 두 함수가 서로 맞는지만 봅니다.
   진짜 화면에서 사라지지 않는지는 tests/browser/draftkeep.js 가 봅니다. */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
{
  /* 편집 중인 칸 흉내 — pendingEdits 가 찾는 표시(dataset.was)만 갖춥니다 */
  const inp = { value:'토스증', style:{}, selectionStart:3, selectionEnd:3,
                dataset:{ acct:'0', was:'토스' } };
  const keep = [{ sel:'[data-acct="0"]', mark:'was', was:inp.dataset.was,
                  value:inp.value, focus:false, s:3, e:3 }];
  /* 다시 그린 뒤의 새 칸(값은 확정된 이름) */
  const fresh = { value:'토스', style:{}, dataset:{ acct:'0' },
                  focus(){ this.focused=true; }, setSelectionRange(){} };
  /* restoreEdits 는 $(sel) 로 찾으므로, 그 자리에 새 칸을 놓아 줍니다 */
  const q = document.querySelector;
  document.querySelector = sel => sel==='[data-acct="0"]' ? fresh : null;
  restoreEdits(keep);
  document.querySelector = q;
  ok(fresh.value==='토스증',
     '다시 그린 칸에 적던 이름이 되돌아옴 (예전에는 통째로 사라졌습니다) — ' + fresh.value);
  ok(fresh.dataset.was==='토스',
     '편집 전 이름도 함께 되돌아옴 — 없으면 확정이 옛 이름 연결을 못 만듭니다');
  ok(S.accounts[0].name==='토스',
     '되돌리기는 S 를 건드리지 않음(R6) — 조각난 이름이 확정되지 않습니다 (' + S.accounts[0].name + ')');
}
`);
