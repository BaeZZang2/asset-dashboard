require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});

/* ══ P2: 지운 계좌 이름 재사용 ══ */
const snapWith = (key,names) => ({ key, savedAt:'', cost:0,value:0,profit:0,rate:0,fx:1400,
  summary:{fx:1400,alloc:{},accounts:Object.fromEntries(names.map(n=>[n,{cost:1e6,value:11e5,cur:'KRW',costLoc:1e6}]))} });

S = normalize({ accounts:[{name:'B',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
SNAPS = [ snapWith('08012026',['A','B']) ];       /* A 는 지워진 계좌, 기록만 남음 */
ok(uniqueAcctName('A',-1)!=='A', '지운 계좌 이름 A 는 새 계좌가 못 씀 → '+uniqueAcctName('A',-1));
ok(uniqueAcctName('B',0)==='B', '자기 이름 B 는 그대로 (기록에 있어도)');
ok(uniqueAcctName('C',-1)==='C', '기록에 없는 이름은 그대로');

/* 지운 계좌의 기록이 새 계좌에 붙지 않는지 */
S.accounts.push({name:uniqueAcctName('A',-1),cur:'KRW',grp:'투자',cash:0,h:[]});
const se = acctSeries(SNAPS);
const names = se.map(s=>s.name);
ok(!names.includes(S.accounts[1].name), '새 계좌('+S.accounts[1].name+')에는 옛 A 기록이 붙지 않음');
ok(names.includes('A') && se.find(s=>s.name==='A').rows[0].value===11e5,
   '옛 A 기록은 A 라는 별도 계열로 남음 (계열: '+names.join(', ')+')');

/* ══ P1: 행의 시장과 다른 코드의 시세는 넣지 않는지 ══ */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:3e6,h:[H('KODEX 200','069500','한국주식',10,38000)]}],
  fx:{usdkrw:1400}, reb:{acct:'토스',mode:'cash',budget:1e6,rows:[
    {name:'애플',code:'AAPL',cls:'미국주식',price:0,have:0,target:''},
    {name:'KODEX 200',code:'069500',cls:'한국주식',price:0,have:10,target:''} ]} });
SNAPS=[];
const map = { 'AAPL':{code:'AAPL',ok:true,price:230}, '069500':{code:'069500',ok:true,price:38500} };
const badMkt=[];
S.reb.rows.forEach(r=>{
  const code=(r.code||'').trim(); if(!code) return;
  const x=map[code];
  if(x&&x.ok){
    if(codeMarket(code)!==rebMarket(r)){ badMkt.push(r.name+'('+code+')'); return; }
    r.price=x.price;
  }
});
ok(S.reb.rows[0].price===0, '추가 매수 행의 해외 코드(AAPL): 달러 단가 230 을 넣지 않음');
ok(S.reb.rows[1].price===38500, '같은 시장 코드(069500)는 정상 반영');
ok(badMkt.length===1 && badMkt[0]==='애플(AAPL)', '맞지 않는 코드를 알림 목록에 담음');

/* 달러 계좌 전체 재배분에서는 AAPL 이 정상 */
S.reb.mode='all';
S.accounts.push({name:'해외',cur:'USD',grp:'투자',cash:0,h:[]});
S.reb.acct='해외';
ok(codeMarket('AAPL')===rebMarket(S.reb.rows[0]), '달러 계좌 계획에서는 AAPL 이 맞는 코드');
`);
