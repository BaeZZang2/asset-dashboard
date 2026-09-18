require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
const row=(name,code,cls,price,have)=>({name,code,cls,price:price||0,have:have||0,target:''});

/* ══ P1: 추가 매수 → 전체 재배분(달러 계좌)으로 돌아갈 때 ══ */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:3e6,h:[H('KODEX 200','069500','한국주식',10,38000)]},
  {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[H('애플','AAPL','미국주식',3,230)]} ],
  fx:{usdkrw:1400}, reb:{acct:'해외',mode:'cash',budget:1e6,rows:[]} });
SNAPS=[];
S.reb.rows=[row('KODEX 200','069500','한국주식',38000,15)];
S.reb.mode='all'; switchRebMode();                     /* 고른 계좌는 해외(USD) */
ok(S.reb.rows[0].price===0 && S.reb.rows[0].code==='',
   '달러 계좌로 돌아가면 원화 코드·단가를 비움 (단가 '+S.reb.rows[0].price+', 코드 "'+S.reb.rows[0].code+'")');
ok(S.reb.budget===5000, '예수금은 그 계좌 것으로 ('+S.reb.budget+')');

/* 원화 계좌로 돌아가면 그대로 남아야 합니다 */
S.reb.mode='cash'; S.reb.rows=[row('KODEX 200','069500','한국주식',38000,15)];
S.reb.acct='토스'; S.reb.mode='all'; switchRebMode();
ok(S.reb.rows[0].price===38000 && S.reb.rows[0].code==='069500', '원화 계좌로 돌아가면 코드·단가 유지');
ok(S.reb.rows[0].have===0, '보유량은 비움');

/* ══ P2-1: 시장이 안 맞으면 들고 있던 단가도 버리는지 ══ */
S.reb.mode='cash'; S.reb.acct='토스';
S.reb.rows=[row('애플','AAPL','미국주식',38000,0)];     /* 예전 종목의 원화 단가가 남아 있는 상태 */
{
  const map={'AAPL':{code:'AAPL',ok:true,price:230}};
  const badMkt=[];
  S.reb.rows.forEach(r=>{ const c=(r.code||'').trim(); const x=map[c];
    if(x&&x.ok){ if(codeMarket(c)!==rebMarket(r)){ r.price=0; badMkt.push(r.name); return; } r.price=x.price; } });
  ok(S.reb.rows[0].price===0, '시장 불일치면 남아 있던 단가 38000 도 버림');
  ok(badMkt.length===1, '알림 목록에도 담김');
}

/* ══ P2-2: 별칭 종착 이름도 예약하는지 ══ */
S = normalize({ accounts:[{name:'A',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
SNAPS=[{key:'08012026',savedAt:'',cost:1e7,value:11e6,profit:0,rate:0,fx:1400,
        summary:{fx:1400,alloc:{},accounts:{'A':{cost:1e7,value:11e6,cur:'KRW',costLoc:1e7}}}}];
renameAcct(0,'B',{commit:true});                       /* 별칭 A→B, 기록은 A 만 */
S.accounts.splice(0,1);                                /* B 로 저장하기 전에 계좌 삭제 */
ok(uniqueAcctName('B',-1)!=='B', '별칭 종착 이름 B 는 새 계좌가 못 씀 → '+uniqueAcctName('B',-1));
ok(uniqueAcctName('A',-1)!=='A', '기록에 남은 A 도 못 씀 → '+uniqueAcctName('A',-1));
ok(uniqueAcctName('C',-1)==='C', '관계 없는 이름은 그대로');

/* 자기 이름 되돌리기는 여전히 되는지 (B→C→B) */
S = normalize({ accounts:[{name:'A',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
renameAcct(0,'B',{commit:true}); renameAcct(0,'C',{commit:true});
ok(uniqueAcctName('B',0,'C')==='B', 'C 를 자기 옛 이름 B 로 되돌리기 가능');
ok(uniqueAcctName('A',0,'C')==='A', '더 옛날 이름 A 로도 되돌리기 가능');
`);
