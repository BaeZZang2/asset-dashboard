require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
/* 코드칸 입력칸 흉내 — closest('tr') 와 querySelector 만 쓰므로 그것만 갖춥니다 */
const codeInput = (i, value, priceBox) => {
  const tr = { dataset:{ i:String(i) }, querySelector:sel=>/price/.test(sel)?priceBox:null };
  return { value, dataset:{ rf:'code' }, closest:()=>tr };
};
const base = () => normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[
    H('삼성전자','005930','한국주식',10,70000), H('KODEX 200','069500','한국주식',20,38000) ]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });

/* ══ P2-A: 다 적지 않은 코드가 S 에 들어가지 않는지 (R6 를 코드칸에도) ══ */
S = base(); SNAPS=[];
S.reb.rows=[{name:'삼성전자',code:'005930',cls:'한국주식',price:70000,have:10,target:'20'}];
dirty = false;
{
  const r = S.reb.rows[0];
  const pb = { value:70000 };
  const t = codeInput(0, '069', pb);                    /* '069500' 을 적다가 만 상태 */
  /* input 핸들러가 하는 일 전부 — 편집 전 코드만 적어 둡니다 */
  if(t.dataset.wasCode == null) t.dataset.wasCode = r.code || '';
  ok(r.code==='005930',
     '적는 중에는 S 의 코드가 그대로 (예전에는 069 가 들어갔습니다) — 실제 ' + r.code);
  ok(r.price===70000, '단가도 아직 그대로');
  ok(dirty===false, '저장할 것이 생기지도 않음 → 자동 저장이 예약되지 않습니다');
  /* 여기서 앱이 죽어도 남는 것은 예전 코드 + 그 코드의 단가입니다 */
  const saved = JSON.parse(JSON.stringify(S)).reb.rows[0];
  ok(saved.code==='005930' && saved.price===70000,
     '다시 켜면 짝이 맞는 코드·단가 (예전에는 069 + 70000 이 저장됐습니다)');
}
/* 저장 직전(또는 칸을 벗어날 때) 확정하면 그때 함께 반영됩니다 */
{
  const r = S.reb.rows[0];
  const pb = { value:70000 };
  const t = codeInput(0, '069500', pb);
  t.dataset.wasCode = '005930';
  commitRebCode(t);
  ok(r.code==='069500', '확정할 때 코드가 들어감 (' + r.code + ')');
  ok(r.price===0, '앞 종목 단가는 버려짐 (' + r.price + ')');
  ok(pb.value===0, '화면의 단가 칸도 0 으로');
  ok(dirty===true, '그때 저장할 것이 생김');
}
/* 코드를 안 바꾸고 칸만 다녀오면 단가는 그대로 */
{
  S.reb.rows=[{name:'KODEX 200',code:'069500',cls:'한국주식',price:38000,have:0,target:''}];
  const pb = { value:38000 };
  const t = codeInput(0, '069500', pb);
  t.dataset.wasCode = '069500';
  commitRebCode(t);
  ok(S.reb.rows[0].price===38000, '같은 코드면 단가 유지 (' + S.reb.rows[0].price + ')');
}
/* 대소문자만 달라도 '안 바뀐 것' 으로 봅니다(R1) */
{
  S.reb.mode='all'; S.reb.acct='토스';
  S.reb.rows=[{name:'애플',code:'aapl',cls:'미국주식',price:0,have:0,target:''}];
  const pb = { value:0 };
  const t = codeInput(0, 'AAPL', pb);
  t.dataset.wasCode = 'aapl';
  commitRebCode(t);
  ok(S.reb.rows[0].code==='AAPL', '코드는 적은 대로 들어감');
}

/* ══ P2-B: 못 쓰는 코드의 행에 단가를 손으로 넣을 수 없는지 ══ */
S = base(); SNAPS=[]; S.reb.mode='cash'; S.reb.budget=1e7;
S.reb.rows=[{name:'애플',code:'AAPL',cls:'미국주식',price:0,have:0,target:''}];
/* 손으로 단가를 적는 것 — 판단도 대입도 앱의 setRebPrice 가 합니다(검사 안에서 다시 적으면
   앱에서 판단을 지워도 통과합니다). 자리마다 이 함수를 거치는지는 규칙 점검 R8 이 봅니다. */
const typePrice = (r, v) => setRebPrice(r, v);
{
  const r = S.reb.rows[0];
  ok(codeFitsReb('AAPL')===false, '원화 계획에서 AAPL 은 못 쓰는 코드');
  ok(rebPriceOk(r)===false, '그 행에는 단가를 넣을 수 없다고 앱이 판단');
  typePrice(r, 230);
  ok(r.price===0,
     '손으로 적은 230 이 들어가지 않음 (예전에는 그대로 들어가 환율만큼 틀렸습니다) — 실제 '
     + r.price);
  /* 그 상태로 셈해도 수량이 나오지 않습니다 */
  const c = computeReb();
  ok(c.rows[0].can===0, '매수가능량 0 — 달러 단가로 나눈 수량이 나오지 않음');
}
/* 코드를 고치면 그때부터 받습니다 */
{
  const r = S.reb.rows[0];
  r.code = '069500';
  typePrice(r, 38000);
  ok(r.price===38000, '쓸 수 있는 코드로 고치면 손입력을 받음 (' + r.price + ')');
}
/* 코드가 없는 행은 사람이 적는 단가를 그대로 받습니다(막아서는 안 되는 경우) */
{
  S.reb.rows=[{name:'직접입력',code:'',cls:'기타주식',price:0,have:0,target:''}];
  const r = S.reb.rows[0];
  typePrice(r, 12345);
  ok(r.price===12345, '코드 없는 행은 손입력을 받음 (' + r.price + ')');
}

/* ══ 다른 계좌에서 단가를 빌릴 때 — 출처 코드로 판단합니다 ══ */
S = base(); SNAPS=[]; S.reb.mode='cash'; S.reb.budget=1e7;
{
  const r = {name:'애플',code:'',cls:'미국주식',price:0,have:0,target:''};
  ok(setRebPrice(r, 230, 'AAPL')===false,
     '원화 계획에 달러 종목 단가를 빌려오지 않음 (행에 코드가 없어도)');
  ok(r.price===0, '단가도 그대로 0 (' + r.price + ')');
  ok(setRebPrice(r, 38000, '')===false, '출처 코드를 모르는 단가는 빌리지 않음');
  ok(setRebPrice(r, 38000, '069500')===true && r.price===38000,
     '쓸 수 있는 출처에서는 빌려옴 (' + r.price + ')');
  /* 들고 있던 값도 버립니다 — 넣지 않는 것으로 끝내면 화면과 셈이 어긋납니다 */
  const bad = {name:'애플',code:'AAPL',cls:'미국주식',price:230,have:1,target:''};
  ok(setRebPrice(bad, 250)===false && bad.price===0,
     '못 넣는 자리면 들고 있던 단가까지 버림 (' + bad.price + ')');
}

/* ══ 이름만 적은 행을 채울 때도 같은 판단을 거치는지 (fillRow) ══ */
/* 원화 계좌에 달러 코드가 들어 있는 상태 — 그 단가를 원화 계획에 옮기면 환율만큼 틀립니다 */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[
  H('애플','AAPL','미국주식',5,230), H('KODEX 200','069500','한국주식',10,38000) ]}],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
{
  const row = fillRow({name:'애플',code:'',cls:'미국주식'});
  ok(row.code==='' && row.price===0,
     '못 쓰는 코드는 코드·단가 없이 채워짐 — 코드 ' + JSON.stringify(row.code) + ', 단가 ' + row.price);
  ok(row.have===5, '보유량은 사실이므로 그대로 (' + row.have + ')');
  ok(rebPriceOk(row)===true, '채운 결과는 늘 단가를 넣어도 되는 상태');
  const good = fillRow({name:'KODEX 200',code:'',cls:'한국주식'});
  ok(good.code==='069500' && good.price===38000,
     '쓸 수 있는 종목은 코드·단가 그대로 (' + good.code + ', ' + good.price + ')');
}

/* ══ 편집 마무리가 한 함수로 모였는지 — 계좌 이름과 코드칸을 함께 확정 ══ */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
S.reb.rows=[{name:'KODEX 200',code:'005930',cls:'한국주식',price:70000,have:0,target:''}];
{
  /* flushPendingEdits 는 화면에서 편집 중인 칸을 찾습니다. 껍데기에는 DOM 이 없으므로
     그 함수가 하는 일(편집 표시가 있는 칸을 확정)을 같은 순서로 확인합니다. */
  const nameInp = { value:'토스증권', style:{}, dataset:{ acct:'0', was:'토스' } };
  const pb = { value:70000 };
  const codeInp = codeInput(0, '069500', pb);
  codeInp.dataset.wasCode = '005930';
  if(nameInp.dataset.was != null) commitAcctName(nameInp);
  if(codeInp.dataset.wasCode != null) commitRebCode(codeInp);
  ok(S.accounts[0].name==='토스증권' && S.aliases['토스']==='토스증권', '계좌 이름이 확정됨');
  ok(S.reb.rows[0].code==='069500' && S.reb.rows[0].price===0, '코드칸도 함께 확정됨');
  ok(nameInp.dataset.was===undefined && codeInp.dataset.wasCode===undefined,
     '둘 다 편집 표시를 지움 → 저장이 두 번 나가도 한 번만 처리');
}
`);
