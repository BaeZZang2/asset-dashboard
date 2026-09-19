require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
const row=(name,code,cls,price,have)=>({name,code,cls,price:price||0,have:have||0,target:''});
const snapNow = key => ({ key, savedAt:'', cost:0, value:0, profit:0, rate:0, fx:S.fx.usdkrw,
                          summary:summaryOf(compute()), state:JSON.parse(JSON.stringify(S)) });
const seriesOf = () => acctSeries(SNAPS).map(s=>s.name+'['+s.rows.map(r=>r?r.value:'—').join(',')+']');
/* btnRbSync 의 빌려오기 분기를 그대로 옮긴 것 */
function syncHave(){
  const a=rebAcct(); if(!a) return [0,0]; let n=0, lent=0;
  S.reb.rows.forEach(r=>{
    const h = a.h.find(x=>(r.code&&x.c===r.code)||x.n===r.name);
    if(h){ r.have=+h.q||0; if(!(r.code||'').trim() && h.c) r.code=h.c; if(+h.p) r.price=+h.p; n++; return; }
    r.have = 0;
    if(r.price>0 && (r.code||'').trim()) return;
    const k = nameKey(r.name||'');
    const cands = allHoldings().filter(z=>
      ((r.code&&z.h.c===r.code) || (k && nameKey(z.h.n)===k)) && (z.h.c || +z.h.p>0));
    const y = cands.find(z=>(z.h.c||'').trim() && codeFitsReb(z.h.c)) || cands[0];
    if(!y) return;
    const src = (y.h.c||'').trim();
    const fits = !!src && codeFitsReb(src);
    let got = false;
    if(!(r.code||'').trim() && fits){ r.code=src; got=true; }
    if(!(r.price>0) && +y.h.p && fits && y.cur===rebCur()
       && (!(r.code||'').trim() || (r.code||'').trim()===src)){ r.price=+y.h.p; got=true; }
    if(got) lent++;
  });
  S.reb.budget = +a.cash||0;
  return [n, lent];
}

/* ══ P2-A: 시장이 다른 같은 이름 종목에서 단가를 빌리지 않는지 ══ */
/* '그로스' 라는 같은 이름을 원화 증권계좌와 원화 코인 지갑이 함께 쓰는 상황 */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[ H('삼성전자','005930','한국주식',10,70000) ]},
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:0,h:[ H('그로스','KRW-GRT','가상화폐',100,500) ]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
S.reb.mode='all'; S.reb.acct='토스';
S.reb.rows=[row('그로스','','기타주식',0,0)];       /* 증권계좌 계획에 같은 이름의 행 */
{
  const [n, lent] = syncHave();
  ok(S.reb.rows[0].code==='', '코인 코드는 안 붙음 (' + JSON.stringify(S.reb.rows[0].code) + ')');
  ok(S.reb.rows[0].price===0,
     '코인 단가 500 도 안 빌려옴 (예전에는 둘 다 원화라 통과했습니다) — 실제 ' + S.reb.rows[0].price);
  ok(lent===0, '빌려온 것 없음으로 셈');
}
/* 코인 지갑 계획에서는 정상적으로 빌려옵니다 */
S.reb.acct='업비트'; S.reb.rows=[row('그로스','','가상화폐',0,0)];
{
  syncHave();
  ok(S.reb.rows[0].code==='KRW-GRT' && S.reb.rows[0].price===500,
     '코인 지갑 계획에서는 코드·단가 모두 빌려옴 (' + S.reb.rows[0].code + ', ' + S.reb.rows[0].price + ')');
}
/* 이름이 같은 후보가 여럿이면 쓸 수 있는 쪽을 고릅니다 */
S = normalize({ accounts:[
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:0,h:[ H('한빛','KRW-HB','가상화폐',10,900) ]},
  {name:'연금',cur:'KRW',grp:'연금',cash:0,h:[ H('한빛','123450','한국주식',5,45000) ]},
  {name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
S.reb.rows=[row('한빛','','한국주식',0,0)];
{
  syncHave();
  ok(S.reb.rows[0].code==='123450' && S.reb.rows[0].price===45000,
     '코인이 앞에 있어도 증권 종목을 고름 (' + S.reb.rows[0].code + ', ' + S.reb.rows[0].price + ')');
}
/* 코드가 없는 종목(금액만 적어 둔 것)에서는 단가를 빌리지 않습니다 */
S = normalize({ accounts:[
  {name:'연금',cur:'KRW',grp:'연금',cash:0,h:[ H('직접입력','','기타주식',1,33000) ]},
  {name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
S.reb.rows=[row('직접입력','','기타주식',0,0)];
{
  syncHave();
  ok(S.reb.rows[0].price===0, '시장을 확인할 수 없으면 단가를 빌리지 않음 (' + S.reb.rows[0].price + ')');
}
/* 같은 시장이면 예전처럼 빌려옵니다(막아서는 안 되는 경우) */
S = normalize({ accounts:[
  {name:'연금',cur:'KRW',grp:'연금',cash:0,h:[ H('KODEX 200','069500','한국주식',5,38000) ]},
  {name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });
SNAPS=[];
S.reb.rows=[row('KODEX 200','','한국주식',0,0)];
{
  const [n, lent] = syncHave();
  ok(S.reb.rows[0].code==='069500' && S.reb.rows[0].price===38000 && lent===1,
     '같은 시장이면 코드·단가를 빌려옴 (' + S.reb.rows[0].code + ', ' + S.reb.rows[0].price + ')');
}

/* ══ P2-B: '그 밖의 계좌' 묶음이 없던 시점을 0 으로 채우지 않는지 ══ */
/* 계좌 10곳 — 앞 8곳은 따로, 나머지 2곳이 묶입니다 */
const many = [];
for(let i=1;i<=8;i++) many.push({name:'계좌'+i,cur:'KRW',grp:'투자',cash:1e6,h:[]});
S = normalize({ accounts:many, fx:{usdkrw:1400} });
SNAPS=[];
SNAPS.push(snapNow('06012026'));                    /* 묶일 계좌가 아직 없는 시점 */
S.accounts.push({ id:'aX', name:'늦게 만든 A', cur:'KRW', grp:'투자', cash:5e6, h:[] });
S.accounts.push({ id:'aY', name:'늦게 만든 B', cur:'KRW', grp:'투자', cash:3e6, h:[] });
SNAPS.push(snapNow('07012026'));                    /* 이제 생김 */
{
  const etc = acctSeries(SNAPS).find(s=>s.name.indexOf('그 밖의 계좌')===0);
  ok(!!etc, '아홉 곳을 넘으면 묶음 계열이 생김 (' + acctSeries(SNAPS).map(s=>s.name).join(', ') + ')');
  ok(etc.rows[0]===null,
     '없던 시점은 빈칸 (예전에는 0 원이 찍혀 0 에서 솟는 것처럼 보였습니다) — 실제 '
     + JSON.stringify(etc.rows[0]));
  ok(etc.rows[1] && etc.rows[1].value===8000000, '있는 시점은 합계 800만원 (' + (etc.rows[1]&&etc.rows[1].value) + ')');
}
/* 중간에 지운 경우 — 마지막 시점이 빈칸이어야 표에도 0 원이 안 찍힙니다 */
S.accounts.splice(8,2);
S = normalize(S);
SNAPS.push(snapNow('08012026'));
{
  const etc = acctSeries(SNAPS).find(s=>s.name.indexOf('그 밖의 계좌')===0);
  ok(etc.rows[0]===null && etc.rows[2]===null,
     '앞뒤로 없던 시점은 모두 빈칸 (' + etc.rows.map(r=>r?r.value:'—').join(',') + ')');
  ok(etc.rows[1] && etc.rows[1].value===8000000, '있던 시점만 값이 남음');
}
/* 일부만 있던 시점은 있는 것끼리 더합니다 */
S = normalize({ accounts:many.concat([
  {id:'aX',name:'늦게 만든 A',cur:'KRW',grp:'투자',cash:5e6,h:[]}]), fx:{usdkrw:1400} });
SNAPS=[ snapNow('06012026') ];
S.accounts.push({ id:'aY', name:'늦게 만든 B', cur:'KRW', grp:'투자', cash:3e6, h:[] });
SNAPS.push(snapNow('07012026'));
{
  const etc = acctSeries(SNAPS).find(s=>s.name.indexOf('그 밖의 계좌')===0);
  ok(etc.rows[0] && etc.rows[0].value===5000000, '하나만 있던 시점은 그 하나만 (' + etc.rows[0].value + ')');
  ok(etc.rows[1] && etc.rows[1].value===8000000, '둘 다 있는 시점은 합계 (' + etc.rows[1].value + ')');
}
`);
