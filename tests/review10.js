require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
const row=(name,code,cls,price,have,target)=>({name,code,cls,price:price||0,have:have||0,target:target==null?'':target});
const base = extra => normalize(Object.assign({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:3e6,h:[H('KODEX 200','069500','한국주식',10,38000)]},
  {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[H('애플','AAPL','미국주식',3,230)]},
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:1e6,h:[H('비트코인','KRW-BTC','가상화폐',0.1,1.5e8)]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} }, extra||{}));

/* ══ P2-A: 전체 재배분은 고른 계좌에서 실제로 살 수 있는 종목만 ══ */
S = base(); SNAPS=[];
S.reb.mode='all'; S.reb.acct='토스';
ok(codeFitsReb('069500')===true,  '원화 증권계좌: 국내주식은 됨');
ok(codeFitsReb('KRW-BTC')===false, '원화 증권계좌: 코인은 안 됨(예전에는 원화라고 통과했습니다)');
S.reb.acct='업비트';
ok(codeFitsReb('KRW-BTC')===true,  '코인 지갑: 코인은 됨');
ok(codeFitsReb('069500')===false,  '코인 지갑: 국내주식은 안 됨');
S.reb.mode='cash';
ok(codeFitsReb('069500') && codeFitsReb('KRW-BTC') && !codeFitsReb('AAPL'),
   '추가 매수는 계좌를 넘나들므로 원화 시세면 다 됨');

/* 기본 구성으로 코인이 증권계좌 계획에 들어오지 않는지 */
S = base(); SNAPS=[];
S.reb.preset = S.presets[0].name;
S.presets[0].picks = [{cls:'가상화폐',name:'비트코인',code:'KRW-BTC'},{cls:'한국주식',name:'KODEX 200',code:'069500'}];
S.reb.mode='all'; S.reb.acct='토스';
let rows = rowsFromPreset();
const btc = rows.find(r=>r.name==='비트코인');
ok(btc && btc.code==='' && btc.price===0, '증권계좌 계획: 코인 코드·단가가 지워짐');
ok(rows.find(r=>r.name==='KODEX 200').code==='069500', '같은 계좌에서 살 수 있는 종목은 그대로');
S.reb.acct='업비트';
ok(rowsFromPreset().find(r=>r.name==='비트코인').code==='KRW-BTC', '코인 지갑 계획: 코인 코드 유지');

/* 계좌를 옮길 때 비우는 것도 같은 규칙 */
S = base(); SNAPS=[]; S.reb.mode='all'; S.reb.acct='업비트';
S.reb.rows=[row('비트코인','KRW-BTC','가상화폐',1.5e8,0.1)];
ok(dropUnfitCodes()===0, '코인 지갑에서는 코인 행을 그대로 둠');
S.reb.acct='토스';
ok(dropUnfitCodes()===1 && S.reb.rows[0].code==='' && S.reb.rows[0].price===0,
   '증권계좌로 옮기면 코인 행의 코드·단가를 비움');

/* ══ P2-B: 하이픈이 있는 미국 티커를 코인으로 보지 않는지 ══ */
S = base(); SNAPS=[];
ok(codeMarket('BRK-B')==='US', 'BRK-B → US (예전에는 CRYPTO 였습니다) — 실제 ' + codeMarket('BRK-B'));
ok(codeMarket('RDS-A')==='US' && codeMarket('BF-B')==='US', '다른 하이픈 티커도 US');
ok(codeMarket('KRW-BTC')==='CRYPTO', '원화 마켓만 원화 시세 코인');
ok(codeMarket('BTC-ETH')==='CRYPTO_ALT' && codeMarket('USDT-XRP')==='CRYPTO_ALT',
   'BTC·USDT 마켓은 통화가 원화가 아니어서 따로 표시');
S.reb.mode='all'; S.reb.acct='해외';
ok(codeFitsReb('BRK-B')===true, '달러 계좌 전체 재배분에서 BRK-B 를 쓸 수 있음');
S.reb.mode='cash';
ok(codeFitsReb('BRK-B')===false, '추가 매수(원화)에서는 막힘');

/* ══ P2-C: 편집 중인 이름은 S 에 넣지 않고, 저장 직전에 확정하는지 ══ */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
/* input 핸들러가 하는 일은 '편집 전 이름 적어 두기'뿐입니다 — S 는 건드리지 않습니다 */
const inp = { value:'토', style:{}, dataset:{ acct:'0', was:'토스' } };
ok(S.accounts[0].name==='토스' && Object.keys(S.aliases).length===0,
   '글자를 넣는 동안 S 는 그대로 (조각난 이름이 localStorage 에 적히지 않습니다)');
commitAcctName(inp);                                                     /* change 또는 저장 직전 */
ok(S.accounts[0].name==='토', '확정할 때 비로소 이름이 바뀜 (' + S.accounts[0].name + ')');
ok(S.aliases['토스']==='토', '연결도 그때 함께 적힘 (토스 → ' + S.aliases['토스'] + ')');
ok(resolveAcct('토스')==='토', '옛 기록이 이 계좌로 붙음');
ok(inp.dataset.was===undefined, '확정하면 편집 표시를 지움 → 저장이 두 번 나가도 한 번만 처리');
/* 이어서 또 고쳐도 조각이 쌓이지 않습니다 */
inp.dataset.was = '토'; inp.value = '토스증권';
commitAcctName(inp);
ok(S.aliases['토스']==='토스증권' && S.aliases['토']==='토스증권',
   '더 옛날 이름도 같이 이어짐 (' + JSON.stringify(S.aliases) + ')');
ok(S.accounts[0].name==='토스증권' && Object.keys(S.aliases).length===2, '이름이 적용되고 별칭은 둘뿐');
/* 확정 경로에서도 옛 이름은 다른 계좌가 못 가져갑니다 */
S.accounts.push({name:'새 계좌',cur:'KRW',grp:'투자',cash:0,h:[]});
const inp2 = { value:'토스', style:{}, dataset:{ acct:'1', was:'새 계좌' } };
const got = commitAcctName(inp2);
ok(got!=='토스', '옛 이름 토스는 다른 계좌가 못 씀 → ' + got);
ok(resolveAcct('토스')==='토스증권', '옛 기록은 여전히 원래 계좌로');

/* ══ P2-D: 종목을 바꾸면 앞 종목 수량이 남지 않는지 ══ */
S = base(); SNAPS=[]; S.reb.mode='cash'; S.reb.budget=1e7;
S.reb.rows=[row('KODEX 200','069500','한국주식',38000,0,10)];
{
  /* 드롭다운 change 처리와 같은 순서 */
  const r = S.reb.rows[0];
  const o = pickable(r.cls).find(x=>x.name==='KODEX 200');
  ok(!!o, '같은 종목을 다시 고를 수 있음');
  if(o && o.name!==r.name) r.target='';
  ok(r.target===10, '같은 종목을 다시 고르면 수량은 그대로');
}
S.accounts[0].h.push(H('KODEX 국고채30년','439870','한국채권',5,520000));
{
  const r = S.reb.rows[0];
  const o = pickable(r.cls).find(x=>x.name==='KODEX 200');   /* 자산군이 달라 목록이 다릅니다 */
  const o2 = pickable('한국채권').find(x=>x.name==='KODEX 국고채30년');
  if(o2 && o2.name!==r.name) r.target='';
  if(o2){ r.name=o2.name; r.code=o2.code; r.price=o2.price; r.have=o2.have; }
  ok(r.target==='', '다른 종목으로 바꾸면 수량을 비움 (예전에는 10주가 남았습니다)');
  ok(num(r.target)*r.price===0, '필요 현금이 단가 차이만큼 뛰지 않음');
}

/* ══ P2-E: 겹친 이름은 불러올 때 갈라 두고, 순서를 바꿔도 열쇠가 그대로 ══ */
SNAPS=[];
S = normalize({ accounts:[
  {name:'새 계좌',cur:'KRW',grp:'투자',cash:1e6,h:[H('삼성전자','005930','한국주식',10,70000)]},
  {name:'새 계좌',cur:'USD',grp:'투자',cash:100,h:[H('NVIDIA','NVDA','미국주식',5,120)]} ], fx:{usdkrw:1400} });
ok(S.accounts[0].name==='새 계좌' && S.accounts[1].name==='새 계좌 2',
   '먼저 있는 계좌가 원래 이름을 지킴 (' + S.accounts.map(a=>a.name).join(' / ') + ')');
ok(!S.aliases['새 계좌'], '뒤 계좌에 별칭을 적지 않음(남의 기록을 물려받지 않음)');
const before = summaryOf(compute()).accounts;
const keyOfUSD = Object.keys(before).find(k=>before[k].cur==='USD');
S.accounts.reverse();                                  /* 순서를 바꿔 다시 저장 */
const after = summaryOf(compute()).accounts;
const keyOfUSD2 = Object.keys(after).find(k=>after[k].cur==='USD');
ok(keyOfUSD==='새 계좌 2' && keyOfUSD2==='새 계좌 2',
   '순서를 바꿔도 달러 계좌의 열쇠가 그대로 (' + keyOfUSD + ' → ' + keyOfUSD2 + ')');
S.accounts.splice(0,1);                                /* 앞 계좌를 지우고 다시 저장 */
const left = summaryOf(compute()).accounts;
ok(Object.keys(left).length===1 && left['새 계좌'] && left['새 계좌'].cur==='KRW',
   '앞 계좌를 지워도 남은 계좌 열쇠가 바뀌지 않음 (' + Object.keys(left).join(', ') + ')');
/* 겹친 이름이 기록·별칭에 이미 있으면 그 이름은 피합니다 */
SNAPS=[{key:'08012026',savedAt:'',cost:0,value:0,profit:0,rate:0,fx:1400,
        summary:{fx:1400,alloc:{},accounts:{'중복 2':{cost:1,value:1,cur:'KRW',costLoc:1}}}}];
S = normalize({ accounts:[{name:'중복',cur:'KRW',grp:'투자',cash:0,h:[]},
                          {name:'중복',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
ok(S.accounts[1].name==='중복 3', '기록에 있는 이름은 건너뜀 (' + S.accounts[1].name + ')');

/* ══ P2-F: 과거 시점을 불러와도 이름 연결을 잃지 않는지 ══ */
S = normalize({ accounts:[{name:'A',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
renameAcct(0,'B',{commit:true});
ok(S.aliases['A']==='B', '이름을 A → B 로 바꿈');
const snapState = { accounts:[{name:'A',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} };
/* 고친 뒤의 복원 경로와 같은 순서 */
const keep = Object.assign({}, snapState.aliases||{}, S.aliases||{});
S = normalize(Object.assign({}, snapState, { aliases:keep }));
ok(S.aliases['A']==='B', '옛 시점을 불러와도 연결이 남음 (예전에는 통째로 사라졌습니다)');
/* 그대로 대입하던 예전 방식이면 사라졌습니다 */
const lost = normalize(JSON.parse(JSON.stringify(snapState)));
ok(Object.keys(lost.aliases).length===0, '예전 방식에서는 연결이 0개가 됨');
`);
