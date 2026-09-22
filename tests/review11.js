require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
const row=(name,code,cls,price,have)=>({name,code,cls,price:price||0,have:have||0,target:''});
/* 시점 하나를 지금 상태로 만들어 둡니다(저장 버튼이 하는 일과 같은 순서). */
const snapNow = key => ({ key, savedAt:'', cost:0, value:0, profit:0, rate:0, fx:S.fx.usdkrw,
                          summary:summaryOf(compute()), state:JSON.parse(JSON.stringify(S)) });
const seriesOf = () => acctSeries(SNAPS).map(s=>s.name+'['+s.rows.map(r=>r?r.value:'—').join(',')+']');

/* ══ P1: 원화가 아닌 업비트 마켓(BTC·USDT) 시세를 쓰지 않는지 ══ */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:3e6,h:[H('KODEX 200','069500','한국주식',10,38000)]},
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:1e6,h:[H('비트코인','KRW-BTC','가상화폐',0.1,1.5e8)]} ],
  fx:{usdkrw:1400}, reb:{acct:'업비트',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
ok(codeMarket('BTC-ETH')==='CRYPTO_ALT' && codeMarket('USDT-SOL')==='CRYPTO_ALT',
   'BTC·USDT 마켓은 CRYPTO 와 구분 (BTC-ETH=' + codeMarket('BTC-ETH') + ')');
ok(marketCur('CRYPTO')==='KRW' && marketCur('CRYPTO_ALT')==='',
   '원화 마켓만 통화가 원화, 나머지는 통화 모름');
ok(codeFitsReb('KRW-ETH')===true, '코인 지갑 계획: 원화 마켓은 됨');
ok(codeFitsReb('BTC-ETH')===false, '코인 지갑 계획: BTC 마켓은 안 됨(예전에는 원화로 통과했습니다)');
S.reb.mode='cash';
ok(codeFitsReb('BTC-ETH')===false && codeFitsReb('USDT-SOL')===false, '추가 매수에서도 막힘');
ok(codeFitsReb('KRW-ETH')===true, '원화 마켓은 추가 매수에서도 됨');

/* 시세 출처가 업비트여도 마켓에 따라 다르게 적힙니다 */
ok(srcMarket('upbit','KRW-ETH')==='CRYPTO' && srcMarket('upbit','BTC-ETH')==='CRYPTO_ALT',
   '업비트 응답은 코드 접두사로 마켓을 가림');

/* 단가가 실제로 막히는지 (updatePrices 의 그 분기를 그대로) */
S.reb.mode='all'; S.reb.acct='업비트';
S.reb.rows=[row('이더리움','BTC-ETH','가상화폐',1.5e8,0), row('리플','KRW-XRP','가상화폐',0,0)];
{
  const map={ 'BTC-ETH':{code:'BTC-ETH',ok:true,price:0.035,src:'upbit'},
              'KRW-XRP':{code:'KRW-XRP',ok:true,price:3200,src:'upbit'} };
  const badMkt=[];
  S.reb.rows.forEach(r=>{ const c=(r.code||'').trim(); const x=map[c];
    if(x&&x.ok){ setCodeMarket(c, srcMarket(x.src, c));
      if(!codeFitsReb(c)){ r.price=0; badMkt.push(r.name); return; } r.price=x.price; } });
  ok(S.reb.rows[0].price===0 && badMkt[0]==='이더리움',
     'BTC 기준 단가 0.035 가 원화 자리에 들어가지 않음');
  ok(S.reb.rows[1].price===3200, '원화 마켓 단가는 정상 반영');
}
/* 자동매칭도 BTC 마켓 코드를 붙이지 않습니다 */
{
  const j = { market:'CRYPTO' };
  const items = [ {code:'BTC-ETH',name:'이더리움(BTC-ETH)',market:'CRYPTO'},
                  {code:'KRW-ETH',name:'이더리움(KRW-ETH)',market:'CRYPTO'} ];
  const hit = items.filter(it=> it.market===j.market && codeMarket(it.code)===j.market )[0];
  ok(hit && hit.code==='KRW-ETH', '검색 결과 중 원화 마켓만 고름 (' + (hit&&hit.code) + ')');
}

/* ══ 계좌 정체성: 이름이 아니라 id ══ */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:0,h:[H('삼성전자','005930','한국주식',10,70000)]},
  {name:'연금',cur:'KRW',grp:'연금',cash:0,h:[H('KODEX 200','069500','한국주식',10,38000)]} ],
  fx:{usdkrw:1400} });
SNAPS=[];
ok(!!S.accounts[0].id && S.accounts[0].id!==S.accounts[1].id, '계좌마다 id 가 붙음');
const id0 = S.accounts[0].id;
SNAPS.push(snapNow('08012026'));
ok(SNAPS[0].summary.accounts['토스'].id===id0, '시점 기록에 id 를 함께 남김');

/* 이름을 바꿔도 한 계열 — 별칭 없이 id 만으로 */
renameAcct(0,'토스증권',{commit:true});
delete S.aliases['토스'];                          /* 별칭을 지워도 id 로 이어져야 합니다 */
SNAPS.push(snapNow('08152026'));
ok(acctSeries(SNAPS).length===2, '이름을 바꿔도 계열이 늘지 않음 (' + acctSeries(SNAPS).length + '개)');
ok(seriesOf()[0]==='토스증권[700000,700000]', '한 줄로 이어짐 (' + seriesOf()[0] + ')');
ok(S.accounts[0].id===id0, 'id 는 그대로');

/* 이름을 되돌려도 그대로 */
renameAcct(0,'토스',{commit:true});
SNAPS.push(snapNow('09012026'));
ok(acctSeries(SNAPS).length===2 && seriesOf()[0]==='토스[700000,700000,700000]',
   '이름을 되돌려도 한 줄 (' + seriesOf()[0] + ')');

/* 지운 계좌의 이름을 새 계좌가 써도 옛 기록을 물려받지 않음 */
const keptId = S.accounts[1].id;
S.accounts.splice(0,1);
S.accounts.push({ id:'aNEW', name:'토스', cur:'KRW', grp:'투자', cash:0, h:[] });
S = normalize(S);
const names = acctSeries(SNAPS).map(s=>s.name);
ok(names.length===2 && !names.includes('토스'),
   '새 계좌는 기록이 없어 계열이 없고, 옛 기록도 그 계좌로 뭉치지 않음 (' + names.join(' / ') + ')');
ok(acctSeries(SNAPS).find(s=>s.rows.some(r=>r&&r.value===700000)).name==='토스 (지난 기록)',
   '옛 기록은 지워진 계좌 몫으로 따로 남고 이름도 갈라 보임 ('
   + acctSeries(SNAPS).find(s=>s.rows.some(r=>r&&r.value===700000)).name + ')');
ok(new Set(acctSeries(SNAPS).map(s=>s.name)).size===acctSeries(SNAPS).length,
   '범례에 같은 이름이 두 줄 나오지 않음');
ok(S.accounts.find(a=>a.name==='토스').id==='aNEW', '새 계좌는 자기 id 를 유지');

/* ══ P2: 옛 시점을 복원해도 기록이 갈라지지 않는지 ══ */
S = normalize({ accounts:[{name:'A',cur:'KRW',grp:'투자',cash:1e6,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
SNAPS.push(snapNow('08012026'));                  /* A 이름으로 저장 */
renameAcct(0,'B',{commit:true});
S.accounts[0].cash = 2e6;
SNAPS.push(snapNow('09012026'));                  /* B 이름으로 저장 */
ok(acctSeries(SNAPS).length===1 && seriesOf()[0]==='B[1000000,2000000]',
   '이름을 바꾼 계좌가 한 줄 (' + seriesOf()[0] + ')');
/* A 시점을 복원 — 복원 경로와 같은 순서 */
{
  const snapState = JSON.parse(JSON.stringify(SNAPS[0].state));
  const keepAliases = Object.assign({}, snapState.aliases||{}, S.aliases||{});
  const st = Object.assign({}, snapState, { aliases:keepAliases });
  const moved = canonicalizeAcctNames(st);
  S = normalize(st);
  ok(moved.length===1 && moved[0]==='A → B', '복원할 때 이름을 지금 이름으로 맞춤 (' + moved.join(', ') + ')');
  ok(S.accounts[0].name==='B', '계좌 이름이 B (예전에는 A 로 되돌아갔습니다)');
  ok(resolveAcct('A')==='B', '옛 이름 A 는 여전히 B 로 이어짐 (예전에는 A 를 그대로 돌려줬습니다)');
  ok(acctSeries(SNAPS).length===1 && seriesOf()[0]==='B[1000000,2000000]',
     '복원 뒤에도 한 줄 (' + seriesOf()[0] + ')');
  ok(S.accounts[0].cash===1e6, '금액은 그 시점 값으로 복원됨');
}

/* id 를 남기기 전의 옛 기록(id 없음)도 이름으로 붙습니다 */
S = normalize({ accounts:[{name:'국내',cur:'KRW',grp:'투자',cash:5e6,h:[]}], fx:{usdkrw:1400} });
SNAPS=[{key:'07012026',savedAt:'',cost:0,value:0,profit:0,rate:0,fx:1400,
        summary:{fx:1400,alloc:{},accounts:{'국내':{cost:3e6,value:3e6,cur:'KRW',costLoc:3e6}}}}];
SNAPS.push(snapNow('08012026'));
ok(acctSeries(SNAPS).length===1 && seriesOf()[0]==='국내[3000000,5000000]',
   'id 없는 옛 기록과 새 기록이 한 줄 (' + seriesOf()[0] + ')');

/* 옛 상태를 불러와도 기록에 남은 id 를 물려받습니다 */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e6,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
const want = S.accounts[0].id;
SNAPS.push(snapNow('08012026'));
{
  const oldSaved = { accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e6,h:[]}], fx:{usdkrw:1400} };
  const back = normalize(oldSaved);                /* id 가 없던 시절의 저장본 */
  ok(back.accounts[0].id===want, '기록에 남은 id 를 물려받아 끊기지 않음 (' + back.accounts[0].id + ')');
}
`);
