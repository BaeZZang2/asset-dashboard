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

/* ══ 라운드 23 지적 A: 순서가 바뀌어도 초안이 제 계좌를 찾아가는지 ══ */
/* 계좌 이름을 적는 중에 패널을 끌어 옮기면 blur 없이 다시 그려집니다. 자리 번호로 되돌리면
   그 자리에 온 다른 계좌에 초안이 붙고, 칸을 벗어나는 순간 그 계좌의 이름이 바뀝니다.
   여기서는 앱의 pendingEdits/restoreEdits 를 그대로 부릅니다 — 판단을 검사 안에 다시 적으면
   앱에서 자리 번호로 되돌려도 통과합니다(실제로 그랬습니다). */
SNAPS=[];
loadState({ accounts:[
    {name:'첫째',cur:'KRW',grp:'투자',cash:1,h:[]},
    {name:'둘째',cur:'KRW',grp:'투자',cash:2,h:[]} ],
  fx:{usdkrw:1400}, reb:{acct:'첫째',preset:'',mode:'all',budget:0,tq:2,rows:[]} });
{
  const box = i => DOM.put('[data-acct="' + i + '"]',
    { value:S.accounts[i].name, style:{}, dataset:{ acct:String(i) },
      focus(){ DOM.active = this; }, setSelectionRange(){} });
  DOM.clear(); const b0 = box(0), b1 = box(1);
  /* 0번 칸에서 '첫째고치는중' 을 적던 중 — 편집 표시는 입력 핸들러가 하는 그대로 */
  b0.value = '첫째고치는중';
  b0.dataset.was = '첫째'; b0.dataset.wasId = S.accounts[0].id;
  DOM.active = b0;
  const keep = pendingEdits();                         /* 앱이 잡아 두는 그대로 */
  ok(keep.length===1, '적던 칸 하나를 잡아 둠 (' + keep.length + ')');
  /* 끌어 옮기기 — S 를 먼저 바꾸고 다시 그립니다 */
  reorderAccounts([1,0]);
  DOM.clear(); const n0 = box(0), n1 = box(1);         /* 다시 그려 새 칸이 생깁니다 */
  restoreEdits(keep);
  ok(S.accounts[0].name==='둘째' && S.accounts[1].name==='첫째',
     '순서가 바뀜 (' + S.accounts.map(a=>a.name).join(', ') + ')');
  ok(n1.value==='첫째고치는중' && n1.dataset.was==='첫째',
     '초안은 옮겨간 제 계좌(1번 자리)로 되돌아감 — ' + n1.value);
  ok(n0.value==='둘째' && n0.dataset.was===undefined,
     '그 자리에 온 다른 계좌 칸에는 붙지 않음 (예전에는 여기 붙었습니다) — ' + n0.value);
  /* 그대로 확정하면 제 계좌의 이름만 바뀝니다 */
  commitAcctName(n1);
  ok(S.accounts[1].name==='첫째고치는중' && S.accounts[0].name==='둘째',
     '확정도 제 계좌에 — ' + S.accounts.map(a=>a.name).join(', '));
  ok(S.aliases['첫째']==='첫째고치는중' && !S.aliases['둘째'], '옛 이름 연결도 제 계좌 것만');
}
/* 그 사이에 계좌가 지워졌으면 되돌릴 곳이 없습니다 */
SNAPS=[];
loadState({ accounts:[
    {name:'첫째',cur:'KRW',grp:'투자',cash:1,h:[]},
    {name:'둘째',cur:'KRW',grp:'투자',cash:2,h:[]} ],
  fx:{usdkrw:1400}, reb:{acct:'첫째',preset:'',mode:'all',budget:0,tq:2,rows:[]} });
{
  DOM.clear();
  const b1 = DOM.put('[data-acct="1"]', { value:'둘째고치는중', style:{},
    dataset:{ acct:'1', was:'둘째', wasId:S.accounts[1].id },
    focus(){ DOM.active = this; }, setSelectionRange(){} });
  DOM.active = b1;
  const keep = pendingEdits();
  S.accounts.splice(1,1);                              /* 그 계좌를 지웁니다 */
  DOM.clear();
  const n0 = DOM.put('[data-acct="0"]', { value:'첫째', style:{}, dataset:{ acct:'0' },
    focus(){ DOM.active = this; }, setSelectionRange(){} });
  restoreEdits(keep);
  ok(n0.value==='첫째' && n0.dataset.was===undefined,
     '없어진 계좌의 초안은 남은 계좌에 붙지 않음 — ' + n0.value);
  ok(S.accounts.length===1 && S.accounts[0].name==='첫째', '남은 계좌는 그대로');
}
/* 리밸런싱 행도 같은 규칙 — 자리 번호가 아니라 '그 행' 으로 찾습니다.
   갓 만든 행처럼 코드가 둘 다 비어 있으면 '편집 전 코드가 같은지' 로는 구별되지 않습니다. */
SNAPS=[];
loadState({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[]}],
  fx:{usdkrw:1400},
  reb:{ acct:'토스', preset:'', mode:'all', budget:0, tq:2, rows:[
    {name:'가',code:'',cls:'한국주식',price:0,have:0,target:''},
    {name:'나',code:'',cls:'한국주식',price:0,have:0,target:''},
    {name:'다',code:'',cls:'한국주식',price:0,have:0,target:''} ] } });
{
  const codeBox = i => {
    const tr = { dataset:{ i:String(i) } };
    return DOM.put('#tReb tr[data-i="' + i + '"] [data-rf="code"]',
      { value:S.reb.rows[i].code, style:{}, dataset:{ rf:'code' }, closest:()=>tr,
        focus(){ DOM.active = this; }, setSelectionRange(){} });
  };
  DOM.clear(); const b = [codeBox(0), codeBox(1), codeBox(2)];
  /* 1번 행('나')의 코드를 적던 중 — 입력 핸들러가 하는 그대로 표시하고 그 행을 기억합니다 */
  b[1].value = '005930'; b[1].dataset.wasCode = '';
  rebRowOf.set(b[1], S.reb.rows[1]);
  DOM.active = b[1];
  const keep = pendingEdits();
  S.reb.rows.splice(0,1);                              /* 앞 행이 지워져 자리가 한 칸 밀립니다 */
  DOM.clear(); const n = [codeBox(0), codeBox(1)];
  restoreEdits(keep);
  ok(n[0].value==='005930' && n[0].dataset.wasCode==='',
     "초안은 제 행('나', 이제 0번 자리)으로 따라감 — " + n[0].value);
  ok(n[1].value==='' && n[1].dataset.wasCode===undefined,
     "그 자리에 온 다른 행('다')에는 붙지 않음 (코드가 둘 다 비어 있어도) — '" + n[1].value + "'");
  /* 확정도 제 행에 들어갑니다 — 그 사이에 자리가 또 밀려도 마찬가지입니다 */
  S.reb.rows.unshift({name:'새로추가',code:'',cls:'한국주식',price:0,have:0,target:''});
  commitRebCode(n[0]);                                 /* 칸에 적힌 자리 번호는 0 이지만 */
  ok(S.reb.rows[1].code==='005930',
     "확정은 고치던 그 행('나')에 — " + S.reb.rows.map(r=>r.name+':'+r.code).join(', '));
  ok(S.reb.rows[0].code==='',
     '그 자리에 온 새 행에는 들어가지 않음 (' + S.reb.rows[0].name + ':' + S.reb.rows[0].code + ')');
}
/* 확정도 '적기 시작한 그 계좌' 에 합니다 — 자리 번호는 그 사이에 바뀔 수 있습니다 */
SNAPS=[];
loadState({ accounts:[
    {name:'첫째',cur:'KRW',grp:'투자',cash:1,h:[]},
    {name:'둘째',cur:'KRW',grp:'투자',cash:2,h:[]} ],
  fx:{usdkrw:1400}, reb:{acct:'첫째',preset:'',mode:'all',budget:0,tq:2,rows:[]} });
{
  const first = S.accounts[0];
  reorderAccounts([1,0]);                              /* 이제 첫째는 1번 자리 */
  /* 칸에는 옛 자리 번호가 남아 있고, 편집 표시에는 '누구였는지' 가 적혀 있습니다 */
  const inp = { value:'첫째고침', style:{},
                dataset:{ acct:'0', was:'첫째', wasId:first.id } };
  commitAcctName(inp);
  ok(S.accounts[1].name==='첫째고침',
     '적기 시작한 그 계좌의 이름이 바뀜 (' + S.accounts[1].name + ')');
  ok(S.accounts[0].name==='둘째',
     '그 자리에 온 다른 계좌는 그대로 (예전에는 이쪽이 바뀌었습니다) — ' + S.accounts[0].name);
  ok(S.aliases['첫째']==='첫째고침' && !S.aliases['둘째'], '옛 이름 연결도 제 계좌 것만');
}

`);
