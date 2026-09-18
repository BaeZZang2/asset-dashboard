require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
/* 같은 이름 '비트코인' 을 증권계좌 상품과 코인 지갑이 함께 쓰는 상황 */
const base = () => normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[
    H('비트코인','476200','기타주식',10,12000),      /* 증권계좌의 비트코인 관련 상품 */
    H('AMD','AMD','미국주식',0,0),                    /* 달러 계좌 것이 아니라 원화 계좌에 있는 예 */
    H('KODEX 200','069500','한국주식',20,38000) ]},
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:0,h:[
    H('비트코인','KRW-BTC','가상화폐',0.1,1.5e8) ]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'cash',budget:1e7,rows:[]} });

/* ══ P2: 후보를 '이름 + 코드'로 묶는지 ══ */
S = base(); SNAPS=[]; S.reb.mode='cash';
{
  const all = pickable();
  const btc = all.filter(o=>o.nk===nameKey('비트코인'));
  ok(btc.length===2, '같은 이름의 두 종목이 따로 남음 (예전에는 하나로 합쳐졌습니다) — 실제 ' + btc.length + '개');
  ok(btc.every(o=>o.label.indexOf('(')>0), '구분되게 코드를 붙여 보여줌 (' + btc.map(o=>o.label).join(', ') + ')');
  ok(new Set(all.map(o=>o.key)).size===all.length, '후보 열쇠가 모두 다름');
}
/* 자산군을 넘기면 그 자산군 것만 */
{
  const coin = pickable('가상화폐');
  ok(coin.length===1 && coin[0].code==='KRW-BTC', '가상화폐 후보는 코인 하나 (' + coin.map(o=>o.code).join(',') + ')');
  const etc = pickable('기타주식');
  ok(etc.length===1 && etc[0].code==='476200', '기타주식 후보는 증권 상품 하나 (' + etc.map(o=>o.code).join(',') + ')');
}

/* ══ 기본 구성을 불러올 때 자산군까지 맞는 후보에서 채우는지 ══ */
S = base(); SNAPS=[]; S.reb.mode='cash';
S.reb.preset = S.presets[0].name;
S.presets[0].picks = [{cls:'가상화폐',name:'비트코인',code:''}];   /* 코드 없이 이름만 적어 둔 구성 */
{
  const rows = rowsFromPreset();
  const r = rows.find(x=>x.cls==='가상화폐');
  ok(!!r, '가상화폐 행이 만들어짐');
  ok(r.code==='KRW-BTC',
     '코인 코드가 들어감 (예전에는 증권 상품 476200 이 들어갔습니다) — 실제 ' + JSON.stringify(r.code));
  ok(r.price===1.5e8, '단가도 코인 것 (예전에는 12000 이었습니다) — 실제 ' + r.price);
  ok(r.have===0.1, '보유량도 코인 것 (' + r.have + ')');
}
/* 반대쪽도 제 것으로 */
S.presets[0].picks = [{cls:'기타주식',name:'비트코인',code:''}];
{
  const r = rowsFromPreset().find(x=>x.cls==='기타주식');
  ok(r && r.code==='476200' && r.price===12000,
     '기타주식 행에는 증권 상품이 들어감 (' + (r&&r.code) + ', ' + (r&&r.price) + ')');
}
/* 코드까지 적어 둔 구성은 그 코드를 그대로 씁니다 */
S.presets[0].picks = [{cls:'가상화폐',name:'비트코인',code:'KRW-BTC'}];
{
  const r = rowsFromPreset().find(x=>x.cls==='가상화폐');
  ok(r && r.code==='KRW-BTC' && r.price===1.5e8, '적어 둔 코드를 그대로 (' + (r&&r.code) + ')');
}

/* ══ 드롭다운에서 고르는 값이 열쇠로 오가는지 ══ */
S = base(); SNAPS=[]; S.reb.mode='cash';
S.reb.rows=[{name:'',code:'',cls:'가상화폐',price:0,have:0,target:''}];
{
  const list = pickable('가상화폐');
  const o = list.find(x=>x.key===list[0].key);      /* change 핸들러가 하는 일 */
  const r = S.reb.rows[0];
  r.name=o.name; r.code=o.code; r.price=o.price; r.have=o.have;
  ok(r.code==='KRW-BTC' && r.price===1.5e8, '고른 후보의 코드·단가가 들어감');
  ok(pickFor(r, list)===o, '다시 그릴 때 같은 후보가 선택으로 잡힘');
}
/* 코드가 비어 있고 이름이 같은 후보가 둘이면 '고르지 않은 것'으로 봅니다 */
{
  const list = pickable();
  const r = {name:'비트코인', code:''};
  ok(pickFor(r, list)===null, '어느 쪽인지 모르면 선택 없음 → 목록 밖으로 표시');
  const r2 = {name:'비트코인', code:'KRW-BTC'};
  ok(pickFor(r2, list) && pickFor(r2, list).code==='KRW-BTC', '코드가 있으면 그 후보로 잡힘');
}
/* 이름이 같은 후보가 하나뿐이면 코드 없이도 잡힙니다(AMD / AMD_소수점 경우) */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[
  H('AMD','005930','한국주식',5,70000), H('AMD_소수점','005930','한국주식',0.5,70000) ]}],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'cash',budget:0,rows:[]} });
SNAPS=[];
{
  const list = pickable();
  ok(list.length===1, '같은 코드면 한 후보로 묶임 (' + list.length + '개)');
  ok(list[0].have===5.5, '나눠 적어 둔 수량은 합쳐짐 (' + list[0].have + ')');
  ok(list[0].label==='AMD', '코드가 겹치지 않으니 이름만 보여줌 (' + list[0].label + ')');
  ok(pickFor({name:'AMD',code:''}, list)===list[0], '코드 없이도 잡힘');
}
/* 코드 없는 항목은 같은 이름에 코드가 하나뿐일 때만 합칩니다 */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[
  H('그린','111111','한국주식',5,1000), H('그린','','한국주식',3,0) ]}],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'cash',budget:0,rows:[]} });
SNAPS=[];
{
  const list = pickable();
  ok(list.length===1 && list[0].have===8, '코드 있는 후보 하나면 합침 (' + list.length + '개, 보유 ' + list[0].have + ')');
}
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[
  H('그린','111111','한국주식',5,1000), H('그린','222222','한국주식',2,2000),
  H('그린','','한국주식',3,0) ]}],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'cash',budget:0,rows:[]} });
SNAPS=[];
{
  const list = pickable();
  ok(list.length===3, '코드 있는 후보가 둘이면 코드 없는 것도 따로 둠 (' + list.length + '개)');
  ok(list.filter(o=>o.code).every(o=>o.label.indexOf('(')>0), '코드 붙여 구분');
}

/* ══ 전체 재배분에서도 한 계좌 안의 동명 다른 코드를 섞지 않는지 ══ */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[
  H('그린','111111','한국주식',5,1000), H('그린','222222','한국주식',2,2000) ]}],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
{
  const r = fillRow({ name:'그린', code:'222222', cls:'한국주식' });
  ok(r.have===2 && r.price===2000,
     '적어 둔 코드의 종목만 셈 (예전에는 7주·1000원으로 섞였습니다) — 보유 ' + r.have + ', 단가 ' + r.price);
}

/* ══ 자체 점검에서 나온 세 건 ══ */
/* ① 이름이 같고 코드만 다른 후보로 바꿔도 앞 종목 수량을 버리는지 */
S = base(); SNAPS=[]; S.reb.mode='cash'; S.reb.budget=1e7;
S.reb.rows=[{name:'비트코인',code:'476200',cls:'기타주식',price:12000,have:0,target:10}];
{
  const r = S.reb.rows[0];
  const list = pickable();                        /* 자산군을 안 좁힌 목록에도 둘 다 있습니다 */
  const o = list.find(x=>x.code==='KRW-BTC');
  const wasKey = nameKey(r.name||'') + '|' + mktKey(r.code||'');
  if(o && o.key!==wasKey) r.target='';
  if(o){ r.name=o.name; r.code=o.code; r.price=o.price; r.have=o.have; }
  ok(r.target==='',
     '이름이 같아도 코드가 다르면 수량을 비움 (이름으로 견주던 동안은 10 이 남았습니다) — 실제 '
     + JSON.stringify(r.target));
  ok(num(r.target)*r.price===0, '필요 현금이 단가 차이만큼 뛰지 않음');
}
/* 같은 후보를 다시 고르면 수량은 그대로 */
S.reb.rows=[{name:'비트코인',code:'KRW-BTC',cls:'가상화폐',price:1.5e8,have:0,target:3}];
{
  const r = S.reb.rows[0];
  const o = pickable('가상화폐').find(x=>x.code==='KRW-BTC');
  const wasKey = nameKey(r.name||'') + '|' + mktKey(r.code||'');
  if(o && o.key!==wasKey) r.target='';
  ok(r.target===3, '같은 후보를 다시 고르면 수량 유지 (' + r.target + ')');
}

/* ② 코드를 적어 둔 행은 그 코드의 후보만 인정하는지 */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[
  H('그린','111111','한국주식',5,1000) ]}],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'cash',budget:0,rows:[]} });
SNAPS=[];
{
  const list = pickable();
  ok(pickFor({name:'그린',code:'111111'}, list)===list[0], '코드가 맞으면 그 후보');
  ok(pickFor({name:'그린',code:'999999'}, list)===null,
     '코드가 맞는 후보가 없으면 이름으로 물러나지 않음 (예전에는 111111 후보가 잡혔습니다)');
  ok(pickFor({name:'그린',code:''}, list)===list[0], '코드가 비어 있고 후보가 하나면 그것');
  const r = fillRow({ name:'그린', code:'999999', cls:'한국주식' });
  ok(r.price===0, '엉뚱한 후보의 단가 1000 이 들어가지 않음 (' + r.price + ')');
}

/* ③ 코드 비교를 다른 곳과 같은 방식으로 하는지 */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[
  H('애플','AAPL','미국주식',7,230) ]}],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
{
  const r = fillRow({ name:'애플', code:'aapl', cls:'미국주식' });   /* 소문자로 적어 둔 코드 */
  ok(r.have===7,
     '대소문자만 다른 코드도 같은 종목으로 셈 (예전에는 보유량 0 이 되어 있는 만큼 또 사라고 했습니다) — 실제 '
     + r.have);
}
`);
