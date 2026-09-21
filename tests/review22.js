require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});

/* ══ P2-A: 저장되어 있던 '쓸 수 없는 코드 + 단가' 를 불러올 때 ══ */
/* 다른 기기에서 원화 계획에 달러 종목이 들어간 채로 저장된 상태입니다. 입력하는 길은 모두
   막았지만, 이미 저장된 값은 불러오기로 들어옵니다. */
SNAPS=[];
loadState({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[]}],
  fx:{usdkrw:1400}, mkts:{AAPL:'US'},
  reb:{ acct:'토스', preset:'', mode:'cash', budget:1e7, tq:2,
        rows:[{name:'애플',code:'AAPL',cls:'미국주식',price:230,have:0,target:''}] } });
{
  const r = S.reb.rows[0];
  ok(codeFitsReb('AAPL')===false, '원화 계획에서 AAPL 은 못 쓰는 코드');
  ok(r.price===0,
     '불러오면서 쓸 수 없는 단가는 버려짐 (예전에는 230 이 그대로 남아 셈에 쓰였습니다) — 실제 '
     + r.price);
  ok(r.code==='AAPL',
     '코드는 남겨 둠 — 지우면 무엇을 고쳐야 하는지도 사라집니다 (' + r.code + ')');
  const c = computeReb();
  ok(c.rows[0].can===0,
     '매수가능량 0 — 예전에는 230 으로 나눠 43,478주를 사라고 했습니다 (실제 ' + c.rows[0].can + ')');
  ok(rebPriceOk(r)===false, '그 행은 여전히 단가를 넣을 수 없는 행');
}
/* 저장소에 남는 것도 정리된 값입니다 */
{
  persist();
  const after = JSON.parse(localStorage.getItem('ad.state')).reb.rows[0];
  ok(after.price===0 && after.code==='AAPL',
     '저장소에도 정리된 값이 남음 — ' + after.code + ' / ' + after.price);
}
/* 쓸 수 있는 행은 그대로 둡니다(과하게 지우지 않기) */
SNAPS=[];
loadState({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[]}],
  fx:{usdkrw:1400}, mkts:{'069500':'KR'},
  reb:{ acct:'토스', preset:'', mode:'cash', budget:1e7, tq:2,
        rows:[{name:'KODEX 200',code:'069500',cls:'한국주식',price:38000,have:0,target:'2'}] } });
{
  const r = S.reb.rows[0];
  ok(r.price===38000, '쓸 수 있는 행의 단가는 그대로 (' + r.price + ')');
  ok(computeReb().need===76000,
     '셈도 그대로 — 2주 × 38,000 = 76,000 (' + computeReb().need + ')');
}
/* 달러 계좌 계획이면 달러 종목이 정상입니다 — 계획 기준으로 봅니다 */
SNAPS=[];
loadState({ accounts:[
    {name:'토스',cur:'KRW',grp:'투자',cash:0,h:[]},
    {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[]} ],
  fx:{usdkrw:1400}, mkts:{AAPL:'US'},
  reb:{ acct:'해외', preset:'', mode:'all', budget:5000, tq:2,
        rows:[{name:'애플',code:'AAPL',cls:'미국주식',price:230,have:1,target:'3'}] } });
ok(S.reb.rows[0].price===230, '달러 계획에서는 달러 단가가 그대로 (' + S.reb.rows[0].price + ')');

/* ══ P2-B: 옛 시점을 복원할 때 고른 계좌가 따라가는지 ══ */
/* 이름을 바꾼 뒤(해외 → 해외증권) 그 전 시점을 복원하면, 복원된 상태의 계좌 이름은 옛 이름
   입니다. 연결을 따라 지금 이름으로 맞추는데, 그때 리밸런싱이 가리키는 이름도 함께 옮겨야
   합니다 — 안 그러면 rebAcct() 가 첫 계좌(토스)로 넘어갑니다. */
SNAPS=[];
{
  const st = { accounts:[
      {name:'토스',cur:'KRW',grp:'투자',cash:1000000,h:[H('KODEX 200','069500','한국주식',10,38000)]},
      {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[H('애플','AAPL','미국주식',3,230)]} ],
    fx:{usdkrw:1400}, aliases:{ '해외':'해외증권' }, mkts:{AAPL:'US','069500':'KR'},
    reb:{ acct:'해외', preset:'', mode:'all', budget:0, tq:2, rows:[] } };
  const moved = canonicalizeAcctNames(st);
  loadState(st);
  ok(moved.join(', ')==='해외 → 해외증권', '복원하면서 이름이 지금 이름으로 맞춰짐 (' + moved.join(', ') + ')');
  ok(S.reb.acct==='해외증권',
     '고른 계좌도 함께 옮겨짐 (예전에는 해외 로 남아 못 찾았습니다) — 실제 ' + S.reb.acct);
  ok(rebAcct().name==='해외증권',
     '그래서 rebAcct 도 그 계좌 (예전에는 첫 계좌 토스 였습니다) — 실제 ' + rebAcct().name);
  ok(rebCur()==='USD', '계획 통화도 그 계좌 기준 (' + rebCur() + ')');
  /* 예수금 맞추기가 엉뚱한 계좌 기준으로 돌지 않습니다 */
  ok((rebAcct().cash||0)===5000, '예수금도 그 계좌 것 (' + rebAcct().cash + ')');
}
/* 이름 바꾸기에서도 같은 함수가 옮깁니다 */
{
  S.reb.acct = '해외증권';
  renameAcct(1, '해외증권2', { commit:true, was:'해외증권' });
  ok(S.reb.acct==='해외증권2', '이름을 바꾸면 고른 계좌도 따라감 (' + S.reb.acct + ')');
  ok(rebAcct().name==='해외증권2', 'rebAcct 도 그대로 그 계좌');
}
/* 가리키던 계좌가 아니면 건드리지 않습니다 */
{
  S.reb.acct = '토스';
  renameAcct(1, '해외증권3', { commit:true, was:'해외증권2' });
  ok(S.reb.acct==='토스', '다른 계좌 이름을 바꿀 때는 그대로 (' + S.reb.acct + ')');
}
/* 같은 이름을 가를 때는 앞 계좌가 원래 이름을 지키므로 가리키는 이름도 그대로입니다 */
SNAPS=[];
loadState({ accounts:[
    {name:'토스',cur:'KRW',grp:'투자',cash:111,h:[]},
    {name:'토스',cur:'KRW',grp:'투자',cash:222,h:[]} ],
  fx:{usdkrw:1400}, reb:{ acct:'토스', preset:'', mode:'all', budget:0, tq:2, rows:[] } });
{
  ok(S.accounts[1].name==='토스 2', '뒤 계좌가 새 이름을 받음 (' + S.accounts[1].name + ')');
  ok(S.reb.acct==='토스' && rebAcct().cash===111,
     '가리키는 이름은 그대로 — 앞 계좌를 가리킵니다 (' + S.reb.acct + ' / ' + rebAcct().cash + ')');
}
/* ══ 스스로 찾은 것: 빌려올 단가가 없을 때 손으로 적어 둔 값을 덮지 않는지 ══ */
SNAPS=[];
loadState({ accounts:[
    {name:'해외',cur:'USD',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',1,0)]},   /* 코드만 있고 시세는 아직 */
    {name:'해외2',cur:'USD',grp:'투자',cash:0,h:[H('','','미국주식',1,0)]} ],
  fx:{usdkrw:1400}, mkts:{AAPL:'US'}, reb:{acct:'해외',preset:'',mode:'all',budget:0,tq:2,rows:[]} });
{
  const dst = S.accounts[1].h[0];
  dst.n = '애플'; dst.p = 250;                       /* 손으로 적어 둔 현재가 */
  ok(pullByName(dst, 'USD')===true, '같은 이름 종목에서 코드를 가져옴');
  ok(dst.c==='AAPL', '코드는 가져옴 (' + dst.c + ')');
  ok(dst.p===250,
     '빌려올 단가가 없으면 적어 둔 값을 그대로 둠 (예전에는 0 으로 덮였습니다) — 실제 ' + dst.p);
}
/* 빌려올 단가가 있으면 그 값으로 바뀝니다(통화가 맞을 때) */
SNAPS=[];
loadState({ accounts:[
    {name:'해외',cur:'USD',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',1,230)]},
    {name:'해외2',cur:'USD',grp:'투자',cash:0,h:[H('','','미국주식',1,0)]} ],
  fx:{usdkrw:1400}, mkts:{AAPL:'US'}, reb:{acct:'해외',preset:'',mode:'all',budget:0,tq:2,rows:[]} });
{
  const dst = S.accounts[1].h[0];
  dst.n = '애플'; dst.p = 250;
  pullByName(dst, 'USD');
  ok(dst.p===230, '빌려올 단가가 있으면 그 값으로 (' + dst.p + ')');
}

`);
