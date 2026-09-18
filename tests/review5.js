require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});

/* ══ P1-1: 달러 계좌에서 저장한 기본 구성이 추가 매수로 새어 들어오는지 ══ */
S = normalize({ accounts:[
  {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[H('NVIDIA','NVDA','미국주식',5,120)]},
  {name:'토스',cur:'KRW',grp:'투자',cash:3e6,h:[H('KODEX 200','069500','한국주식',10,38000)]} ],
  fx:{usdkrw:1400}, reb:{acct:'해외',mode:'all'} });
S.reb.preset = S.presets[0].name;
const p = S.presets.find(x=>x.name===S.reb.preset);
p.picks = [{cls:'미국주식',name:'NVIDIA',code:'NVDA'},{cls:'한국주식',name:'KODEX 200',code:'069500'}];

S.reb.mode='all';
let rows = rowsFromPreset();
ok(rows.length===2, '전체 재배분: 저장한 두 종목 모두 불러옴');
S.reb.mode='cash';
rows = rowsFromPreset();
ok(rows.length===1 && rows[0].name==='KODEX 200', '추가 매수: 달러 종목(NVDA)은 불러오지 않음');
ok(!rows.some(r=>r.code==='NVDA'), '추가 매수: NVDA 코드가 남지 않음 → 달러 단가가 들어올 길 없음');

/* ══ P1-2: 전체 재배분 보유량이 고른 계좌로 한정되는지 ══ */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:1e6,h:[H('KODEX 200','069500','한국주식',10,38000)]},
  {name:'연금',cur:'KRW',grp:'연금',cash:0,  h:[H('KODEX 200','069500','한국주식',40,38000)]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',mode:'all'} });
S.reb.preset = S.presets[0].name;
S.presets.find(x=>x.name===S.reb.preset).picks = [{cls:'한국주식',name:'KODEX 200',code:'069500'}];
rows = rowsFromPreset();
ok(rows[0].have===10, '전체 재배분: 고른 계좌(토스) 10주만 — 연금 40주는 섞이지 않음 (실제 '+rows[0].have+')');
S.reb.acct='연금';
ok(rowsFromPreset()[0].have===40, '계좌를 연금으로 바꾸면 40주');
S.reb.mode='cash';
ok(rowsFromPreset()[0].have===50, '추가 매수는 원화 계좌 전체 합산 50주');

/* ══ P2-1: 이름을 바꾼 뒤 그 옛 이름을 새 계좌에 다시 붙일 수 있는지 ══ */
S = normalize({ accounts:[{name:'A',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
renameAcct(0,'B',{commit:true});
ok(uniqueAcctName('A',-1)!=='A', '물려 둔 옛 이름 A는 새 계좌가 다시 못 씀 → '+uniqueAcctName('A',-1));
ok(uniqueAcctName('A',0)==='A', '그 계좌 자신은 A로 되돌릴 수 있음');
/* 되돌린 뒤에는 별칭이 사라져 기록이 제대로 붙는지 */
renameAcct(0,'A',{commit:true});
ok(resolveAcct('A')==='A' && !S.aliases['A'], 'A로 되돌리면 별칭도 정리됨');

/* 옛 이름을 새 계좌가 못 쓰므로, 옛 기록이 엉뚱한 계좌로 붙지 않는지 */
S = normalize({ accounts:[{name:'A',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
renameAcct(0,'B',{commit:true});
S.accounts.push({name:uniqueAcctName('A',-1),cur:'KRW',grp:'투자',cash:0,h:[]});
ok(resolveAcct('A')==='B', '옛 이름 A의 기록은 원래 계좌 B로 붙음 (새 계좌는 '+S.accounts[1].name+')');
`);
