require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const snapNow = key => ({ key, savedAt:'', cost:0, value:0, profit:0, rate:0, fx:S.fx.usdkrw,
                          summary:summaryOf(compute()), state:JSON.parse(JSON.stringify(S)) });
const seriesOf = () => acctSeries(SNAPS).map(s=>s.name+'['+s.rows.map(r=>r?r.value:'—').join(',')+']');
/* id 를 남기기 전 형식의 시점 한 칸 */
const oldSnap = (key, name, v) => ({ key, savedAt:'', cost:v, value:v, profit:0, rate:0, fx:1400,
  summary:{ fx:1400, alloc:{}, accounts:{ [name]:{cost:v, value:v, cur:'KRW', costLoc:v} } } });

/* ══ P2: 지운 계좌의 'id 도입 전 기록'도 같은 계열로 ══ */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:5e6,h:[]}], fx:{usdkrw:1400} });
SNAPS=[ oldSnap('06012026','토스',3e6) ];          /* 업그레이드 전 기록 (id 없음) */
const idT = S.accounts[0].id;
SNAPS.push(snapNow('07012026'));                   /* 업그레이드 후 기록 (id 있음) */
ok(acctSeries(SNAPS).length===1 && seriesOf()[0]==='토스[3000000,5000000]',
   '계좌가 살아 있을 때는 한 줄 (' + seriesOf().join(' / ') + ')');

/* 이제 그 계좌를 지웁니다 */
S.accounts.splice(0,1);
S = normalize(S);
ok(acctSeries(SNAPS).length===1,
   '지운 뒤에도 한 계열 (예전에는 id 없는 기록이 nm: 로 떨어져 두 줄이 됐습니다) — 실제 '
   + acctSeries(SNAPS).length + '개');
ok(seriesOf()[0]==='토스[3000000,5000000]', '두 시점 모두 그 계열에 담김 (' + seriesOf()[0] + ')');

/* 이름을 바꾼 뒤 지운 경우에도 별칭을 따라 모입니다
   (계좌를 하나는 남겨 둡니다 — 목록이 비면 normalize 가 처음 상태로 되돌립니다) */
S = normalize({ accounts:[{name:'A',cur:'KRW',grp:'투자',cash:2e6,h:[]},
                          {name:'남는 계좌',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
SNAPS=[ oldSnap('06012026','A',1e6) ];
renameAcct(0,'B',{commit:true});
SNAPS.push(snapNow('07012026'));                   /* B 이름 + id */
S.accounts.splice(0,1);                            /* B 만 지움 */
S = normalize(S);
ok(S.aliases['A']==='B', '지운 뒤에도 옛 이름 연결은 남아 있음');
ok(seriesOf().filter(x=>x.indexOf('1000000')>=0).length===1
   && seriesOf().indexOf('B[1000000,2000000]')>=0,
   '이름을 바꾸고 지운 계좌도 한 줄 (' + seriesOf().join(' / ') + ')');

/* id 가 여럿 걸리면 넘겨짚지 않습니다 */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e6,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
const id1 = S.accounts[0].id;
SNAPS.push(snapNow('06012026'));                   /* 토스(id1) */
S.accounts.splice(0,1);
S.accounts.push({ id:'aOTHER', name:'토스', cur:'KRW', grp:'투자', cash:4e6, h:[] });
SNAPS.push(snapNow('07012026'));                   /* 같은 이름의 다른 계좌(aOTHER) */
S.accounts.splice(0,1);                            /* 둘 다 지움 */
S = normalize(S);
SNAPS.push(oldSnap('08012026','토스',9e6));        /* 어느 쪽인지 알 수 없는 옛 기록 */
{
  const m = snapIdByName(SNAPS);
  ok(m['토스'] && m['토스'].size===2, '이름 하나에 id 둘이 걸림 (' + (m['토스']?m['토스'].size:0) + ')');
  ok(snapAcctId('토스', {cost:9e6}, m)==='nm:토스',
     '어느 쪽인지 모르면 넘겨짚지 않고 이름으로 둠 (' + snapAcctId('토스', {cost:9e6}, m) + ')');
  ok(acctSeries(SNAPS).length===3, '세 계열로 따로 남음 (' + acctSeries(SNAPS).length + '개)');
  ok(new Set(acctSeries(SNAPS).map(s=>s.name)).size===3, '범례 이름도 갈라 보임');
}

/* 살아 있는 계좌가 있으면 그 계좌를 먼저 씁니다(기록의 id 보다 우선) */
S = normalize({ accounts:[{ id:'aLIVE', name:'토스', cur:'KRW', grp:'투자', cash:7e6, h:[] }],
  fx:{usdkrw:1400} });
SNAPS=[ oldSnap('06012026','토스',1e6) ];
{
  const m = snapIdByName(SNAPS);
  ok(snapAcctId('토스', {cost:1e6}, m)==='id:aLIVE', '살아 있는 계좌의 id 로 붙음');
}

/* 기록 한 칸마다 전체를 다시 훑지 않는지 — 같은 결과를 훨씬 적은 일로 */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:1e6,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
for(let i=0;i<40;i++) SNAPS.push(snapNow('0'+(i%9+1)+'012026'));
{
  const t0 = Date.now();
  const n = acctSeries(SNAPS).length;
  const ms = Date.now()-t0;
  ok(n===1 && ms < 300, '시점 40개에서도 빠르게 계산 (' + ms + 'ms, 계열 ' + n + '개)');
}
`);
