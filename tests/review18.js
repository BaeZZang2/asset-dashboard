require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const snapNow = key => ({ key, savedAt:'', cost:0, value:0, profit:0, rate:0, fx:S.fx.usdkrw,
                          summary:summaryOf(compute()), state:JSON.parse(JSON.stringify(S)) });
const seriesOf = () => acctSeries(SNAPS).map(s=>s.name+'['+s.rows.map(r=>r?r.value:'—').join(',')+']');
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});

/* ══ P2-A: 편집 중인 이름이 이 기기 저장소에도 들어가지 않는지 ══ */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e6,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
const before = JSON.stringify(S.accounts[0].name);
dirty = false;
{
  /* 이름칸에 '토' 까지만 적은 상태 — input 핸들러는 편집 전 이름만 적어 둡니다 */
  const inp = { value:'토', style:{}, dataset:{ acct:'0' } };
  if(inp.dataset.was == null) inp.dataset.was = S.accounts[0].name;
  ok(S.accounts[0].name==='토스', 'S 의 이름이 그대로 (' + S.accounts[0].name + ')');
  ok(dirty===false, '저장할 것이 생기지도 않음 → persist() 가 불리지 않습니다');
  ok(Object.keys(S.aliases).length===0, '연결도 아직 없음');
  /* 여기서 앱이 죽는다고 해도 남는 것은 옛 이름입니다 */
  const saved = normalize(JSON.parse(JSON.stringify(S)));
  ok(saved.accounts[0].name==='토스',
     '다시 켜면 옛 이름 (예전에는 조각난 이름 "토" 가 확정된 것처럼 남았습니다) — 실제 '
     + saved.accounts[0].name);
  /* 확정하면 이름과 연결이 함께 들어갑니다 */
  commitAcctName(inp);
  ok(S.accounts[0].name==='토' && S.aliases['토스']==='토', '확정할 때 둘이 함께 들어감');
  ok(dirty===true, '그때 저장할 것이 생김');
}
/* 저장 직전 확정 경로도 그대로 동작합니다 */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
{
  const inp = { value:'토스증권', style:{}, dataset:{ acct:'0', was:'토스' } };
  commitAcctName(inp);                                /* flushAcctNameEdits 가 하는 일 */
  ok(S.accounts[0].name==='토스증권' && S.aliases['토스']==='토스증권',
     '저장 직전에 확정하면 이름과 연결이 함께 나감');
}

/* ══ P2-B: 옛 계좌에 id 를 처음 붙일 때 기기마다 같은 값이 나오는지 ══ */
{
  const legacy = () => ({ accounts:[
    {name:'토스',cur:'KRW',grp:'투자',cash:1e6,h:[]},
    {name:'연금',cur:'KRW',grp:'연금',cash:2e6,h:[]} ], fx:{usdkrw:1400} });
  SNAPS=[];
  const devA = normalize(legacy());                   /* 기기 A 가 불러옴 */
  SNAPS=[];
  const devB = normalize(legacy());                   /* 기기 B 가 같은 옛 상태를 불러옴 */
  ok(devA.accounts[0].id===devB.accounts[0].id && devA.accounts[1].id===devB.accounts[1].id,
     '두 기기가 같은 id 를 붙임 (예전에는 무작위라 서로 달랐습니다) — A ' + devA.accounts[0].id
     + ' / B ' + devB.accounts[0].id);
  ok(devA.accounts[0].id!==devA.accounts[1].id, '계좌끼리는 다른 id');
  ok(seedAcctId('토스')===seedAcctId('토스') && seedAcctId('토스')!==seedAcctId('연금'),
     '이름이 같으면 같은 값, 다르면 다른 값');
  /* 그래서 각자 저장한 시점 기록이 한 계열로 이어집니다 */
  S = devA; SNAPS=[ snapNow('06012026') ];
  S = devB; S.accounts[0].cash = 3e6; SNAPS.push(snapNow('07012026'));
  ok(acctSeries(SNAPS).length===2 && seriesOf()[0]==='토스[1000000,3000000]',
     '기기를 넘나들어도 한 줄 (' + seriesOf().join(' / ') + ')');
}
/* 새로 만드는 계좌는 무작위 — 지운 계좌의 기록을 물려받지 않습니다 */
{
  ok(newAcctId()!==newAcctId(), '새 계좌 id 는 매번 다름');
  ok(newAcctId()!==seedAcctId('토스'), '새 계좌 id 는 이름에서 나온 값과 다름');
}
/* 이미 id 가 있으면 건드리지 않습니다 */
{
  SNAPS=[];
  const keep = normalize({ accounts:[{id:'aMINE',name:'토스',cur:'KRW',grp:'투자',cash:0,h:[]}],
    fx:{usdkrw:1400} });
  ok(keep.accounts[0].id==='aMINE', '적혀 있는 id 는 그대로');
}
/* 기록에 남은 id 가 이름에서 나온 값보다 먼저입니다 */
{
  S = normalize({ accounts:[{id:'aOLD',name:'토스',cur:'KRW',grp:'투자',cash:1e6,h:[]}],
    fx:{usdkrw:1400} });
  SNAPS=[ snapNow('06012026') ];
  const back = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e6,h:[]}],
    fx:{usdkrw:1400} });
  ok(back.accounts[0].id==='aOLD',
     '기록의 id 를 물려받음 (이름에서 나온 값으로 덮지 않습니다) — 실제 ' + back.accounts[0].id);
}

/* ══ 자체 점검에서 나온 세 건 ══ */
/* ① 공백만 적힌 코드는 '코드 없음' 으로 봐야 합니다 (mktKey 로는 '' 이 되어 아무 코드나 맞습니다) */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[
  H('삼성전자','005930','한국주식',10,70000), H('현대차','005380','한국주식',3,250000) ]}],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
{
  /* 전체 재배분 쪽 — 공백 코드가 '아무 코드나 맞는 것'이 되면 안 됩니다 */
  const r = fillRow({ name:'삼성전자', code:'  ', cls:'한국주식' });
  ok(r.have===10 && r.price===70000,
     '공백 코드는 무시하고 이름으로 찾음 (보유 ' + r.have + ', 단가 ' + r.price + ')');
  /* 동기화 쪽 — 공백 코드가 코드 없는 다른 종목을 집어오지 않아야 합니다 */
  const a = rebAcct();
  const rc = ('  ' || '').trim();
  const h = a.h.find(x=>(rc&&mktKey(x.c)===mktKey(rc))||x.n==='삼성전자');
  ok(h && h.n==='삼성전자', '동기화도 이름으로 제 종목을 찾음 (' + (h&&h.n) + ')');
}
/* 코드가 제대로 적혀 있으면 그 코드의 종목만 */
{
  const r = fillRow({ name:'삼성전자', code:'005380', cls:'한국주식' });
  ok(r.have===0, '이름과 코드가 어긋나면 섞지 않음 (' + r.have + ')');
}

/* ② 앱을 뒤로 넘길 때 편집 중인 이름을 확정하는지 (change 가 안 오는 경로) */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
{
  /* flushAcctNameEdits 는 화면에서 편집 중인 칸을 찾는데, 껍데기에는 DOM 이 없으므로
     그 함수가 하는 일(편집 표시가 있는 칸을 확정)을 같은 순서로 확인합니다. */
  const inp = { value:'토스증권', style:{}, dataset:{ acct:'0', was:'토스' } };
  ok(S.accounts[0].name==='토스', '뒤로 넘기기 전에는 S 가 그대로');
  if(inp.dataset && inp.dataset.was != null) commitAcctName(inp);
  ok(S.accounts[0].name==='토스증권' && S.aliases['토스']==='토스증권',
     '뒤로 넘길 때 확정되어 이름과 연결이 함께 남음 (예전에는 돌아올 때 적던 이름이 사라졌습니다)');
  ok(dirty===true, '저장할 것으로 표시됨 → 그다음 밀린 내용 올리기가 동작');
}
`);
