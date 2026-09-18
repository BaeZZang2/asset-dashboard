require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
const base = () => normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:3e6,h:[H('KODEX 200','069500','한국주식',10,38000)]},
  {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[H('NVIDIA','NVDA','미국주식',5,120)]},
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:0,h:[H('비트코인','KRW-BTC','가상화폐',0.1,1.5e8)]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',mode:'all'} });

/* ══ 코드 시장 판별 ══ */
S = base();
ok(codeMarket('069500')==='KR' && codeMarket('NVDA')==='US' && codeMarket('KRW-BTC')==='CRYPTO' && codeMarket('')==='' ,
   'codeMarket: 069500→KR, NVDA→US, KRW-BTC→CRYPTO');

/* ══ P1-1: 달러 종목 기본 구성을 원화 계좌 전체 재배분으로 불러올 때 ══ */
S = base();
S.reb.preset = S.presets[0].name;
S.presets[0].picks = [{cls:'미국주식',name:'NVIDIA',code:'NVDA'},{cls:'한국주식',name:'KODEX 200',code:'069500'}];
let rows = rowsFromPreset();
const nv = rows.find(r=>r.name==='NVIDIA');
ok(nv && nv.code==='' && nv.price===0, '원화 계좌 선택: NVDA 코드가 지워져 달러 단가가 들어올 길 없음');
ok(rows.find(r=>r.name==='KODEX 200').code==='069500', '같은 시장 종목의 코드는 그대로');
S.reb.acct='해외';
ok(rowsFromPreset().find(r=>r.name==='NVIDIA').code==='NVDA', '달러 계좌를 고르면 NVDA 코드 유지');

/* 시세를 다시 찾을 때도 그 계좌 시장에서 찾는지 */
S.reb.acct='토스';
ok(rebMarket({name:'NVIDIA',code:'',cls:'미국주식'})==='KR', '원화 계좌 계획의 행은 국내 시장에서 찾음');
S.reb.acct='해외';
ok(rebMarket({name:'NVIDIA',code:'',cls:'미국주식'})==='US', '달러 계좌 계획의 행은 미국 시장에서 찾음');
ok(rebMarket({name:'비트코인',code:'',cls:'가상화폐'})==='', '달러 계좌 계획에서는 코인을 찾을 시장이 없음(업비트 시세는 원화)');
S.reb.mode='cash';
ok(rebMarket({name:'비트코인',code:'',cls:'가상화폐'})==='CRYPTO', '추가 매수에서는 코인 → CRYPTO');
S.reb.mode='all';
S.reb.acct='해외';
S.reb.mode='cash';
ok(rebMarket({name:'TIGER 미국S&P500',code:'',cls:'미국주식'})==='KR', '추가 매수는 국내');

/* ══ P1-2: 다른 통화 계좌에서 현재가를 빌리지 않는지 ══ */
S = base();
S.reb.mode='all'; S.reb.acct='토스';
S.reb.rows=[{name:'NVIDIA',code:'',cls:'미국주식',price:0,have:0,target:''}];
/* btnRbSync 가 하는 일을 그대로 흉내 */
{
  const a=rebAcct();
  const r=S.reb.rows[0];
  const k=nameKey(r.name);
  const y=allHoldings().find(z=>(k && nameKey(z.h.n)===k) && (z.h.c || +z.h.p>0));
  let got=false;
  if(!(r.code||'').trim() && y.h.c && codeMarket(y.h.c)===marketOf(a)){ r.code=y.h.c; got=true; }
  if(!(r.price>0) && +y.h.p && y.cur===a.cur){ r.price=+y.h.p; got=true; }
  ok(r.price===0, '원화 계좌 계획: 달러 계좌 단가 120을 빌려오지 않음');
  ok(r.code==='', '원화 계좌 계획: 미국 코드도 빌려오지 않음');
}

/* ══ P2: 이름칸을 직접 고칠 때도 옛 이름 예약이 걸리는지 ══ */
S = normalize({ accounts:[{name:'A',cur:'KRW',grp:'투자',cash:0,h:[]},
                          {name:'C',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
renameAcct(0,'B',{commit:true});
ok(S.aliases['A']==='B', '모달에서 A→B 로 바꾸면 별칭 A→B');
/* 인라인으로 두 번째 계좌 이름을 C → A 로 한 글자씩 */
let was = S.accounts[1].name;
renameAcct(1,'');  renameAcct(1,'A');          /* 글자마다 (별칭 안 적음) */
ok(!S.aliases[''] && S.aliases['A']==='B', '글자마다 부를 때는 조각난 별칭이 쌓이지 않음');
const v = renameAcct(1, uniqueAcctName('A', 1, was), {commit:true, was});
ok(v!=='A', '편집을 끝낼 때 옛 이름 A 는 막힘 → '+v);
ok(resolveAcct('A')==='B', '옛 기록 A 는 여전히 원래 계좌 B 로 붙음');
/* 자기 옛 이름으로 되돌리기는 인라인에서도 되는지 */
was = S.accounts[0].name;                       /* 'B' */
renameAcct(0,'A');
const v2 = renameAcct(0, uniqueAcctName('A', 0, was), {commit:true, was});
ok(v2==='A' && !S.aliases['A'], 'B 를 자기 옛 이름 A 로 되돌리면 그대로 되고 별칭도 정리');
`);
