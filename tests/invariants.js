/* 규칙 점검 — "한 규칙을 여러 자리에서 판단하다가 한 곳만 고치는" 실수를 잡습니다.
   개별 증상이 아니라 '자리끼리 어긋난 상태' 자체를 잡는 것이 목적입니다.
   앞 = 소스 점검(금지된 모양), 뒤 = 행동 점검(같은 판단을 하는 자리들이 같은 답을 내는지). */
const fs = require('fs');
const SRC = require('path').join(__dirname,'..','index.html');
const src = fs.readFileSync(SRC, 'utf8');
let bad = 0;
const ok = (c, l) => { if(!c) bad++; console.log((c?'  OK  ':'  위반') + ' ' + l); };

/* 주석은 규칙이 아니라 설명이므로 검사에서 뺍니다. */
const code = src.split('\n').map(l=>{ const i=l.indexOf('/*'); return i>=0 ? l.slice(0,i) : l; });
const hits = (re, allow) => code.map((l,i)=>({n:i+1,l}))
  .filter(x=>re.test(x.l) && !(allow && allow.test(x.l)));
const show = h => h.map(x=>x.n+': '+x.l.trim().slice(0,76)).join('\n        ');
/* 이 줄이 특정 함수 안(또는 그 정의 줄)인지 */
const inside = (n, names) => {
  const re = new RegExp('function (' + names.join('|') + ')\\b');
  for(let i=n; i>Math.max(0,n-14); i--){
    if(re.test(code[i-1])) return true;
    if(i<n && /^function /.test(code[i-1])) return false;
  }
  return false;
};

console.log('── 소스 점검 ──');

/* R1. 종목코드끼리 견줄 때는 반드시 mktKey 를 거칩니다(대소문자·공백 차이로 다른 종목이 됩니다). */
ok(hits(/(\.code|\.c|\bhc|\bsrc)\s*(===|!==)\s*(\(?[a-zA-Z_$][\w$]*\.(code|c)\b|hc\b|src\b)/,
        /mktKey|dataset|\.cur\b/).length===0,
   'R1 코드끼리 비교는 mktKey 를 거친다'
   + (h=>h.length?'\n        '+show(h):'')(hits(/(\.code|\.c|\bhc|\bsrc)\s*(===|!==)\s*(\(?[a-zA-Z_$][\w$]*\.(code|c)\b|hc\b|src\b)/, /mktKey|dataset|\.cur\b/)));

/* R2. 대장(S.mkts)에 쓰는 것은 setCodeMarket 뿐입니다. */
{
  const h = hits(/S\.mkts\s*\[[^\]]*\]\s*=/).filter(x=>!inside(x.n, ['setCodeMarket']));
  ok(h.length===0, 'R2 S.mkts 쓰기는 setCodeMarket 안에서만' + (h.length?'\n        '+show(h):''));
}
/* R3. 계좌 식별자를 손으로 만들지 않습니다 — acctKey / snapAcctId / snapIdByName 만. */
{
  const h = hits(/['"]id:['"]\s*\+/)
    .filter(x=>!inside(x.n, ['acctKey','snapAcctId','snapIdByName']));
  ok(h.length===0, 'R3 계좌 열쇠는 acctKey/snapAcctId 로만 만든다' + (h.length?'\n        '+show(h):''));
}
/* R4. 추가 매수 후보를 이름으로 지목하지 않습니다(이름이 같은 다른 종목이 있습니다). */
{
  const h = hits(/pickable\([^)]*\)\s*\.find\(\s*[a-z]\s*=>\s*[a-z]\.name\s*===/);
  ok(h.length===0, 'R4 후보는 이름이 아니라 열쇠로 지목한다' + (h.length?'\n        '+show(h):''));
}
/* R5. fillRow 의 추가 매수 쪽은 자산군까지 좁힌 후보에서만 가져옵니다. */
{
  const h = hits(/pickable\(\s*\)/).filter(x=>inside(x.n, ['fillRow']));
  ok(h.length===0, 'R5 fillRow 는 pickable(cls) 를 쓴다' + (h.length?'\n        '+show(h):''));
}
/* R6. 편집이 끝나지 않은 계좌 이름을 S 에 넣지 않습니다. */
{
  const h = hits(/renameAcct\([^)]*draft/);
  ok(h.length===0, 'R6 편집 중 이름을 S 에 넣지 않는다' + (h.length?'\n        '+show(h):''));
}
/* R7. 옛 계좌에 id 를 처음 붙일 때는 기기마다 같은 값이 나와야 합니다. */
{
  const h = hits(/idFromSnaps\([^)]*\)\s*\|\|\s*newAcctId\(\)/);
  ok(h.length===0, 'R7 옛 계좌 id 는 seedAcctId 로 붙인다' + (h.length?'\n        '+show(h):''));
}

/* ── 행동 점검 ── 앱과 같은 자리에서 돌려야 하므로 h.js 껍데기를 씁니다. */
console.log('\n── 행동 점검 ──');
require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  위반') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
SNAPS = [];
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[H('KODEX 200','069500','한국주식',10,38000)]},
  {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[H('애플','AAPL','미국주식',3,230)]},
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:1e6,h:[H('비트코인','KRW-BTC','가상화폐',0.1,1.5e8)]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });

const CODES = ['069500','AAPL','KRW-BTC','BTC-ETH','KRX:005930','NASDAQ:NVDA','BRK-B','7203'];
const PLANS = [['cash','토스'],['all','토스'],['all','해외'],['all','업비트']];
const bad = [];

/* B1. '이 코드를 이 계획에 쓸 수 있나' 를 판단하는 자리들이 codeFitsReb 와 같은 답을 내는지.
   fillRow(코드를 남기나) 와 dropUnfitCodes(코드를 비우나) 를 규칙과 견줍니다. */
PLANS.forEach(([mode,acct])=>CODES.forEach(c=>{
  S.reb.mode=mode; S.reb.acct=acct;
  const fits = codeFitsReb(c);
  const kept = !!fillRow({ name:'점검용', code:c, cls:'기타주식' }).code;
  if(kept !== fits) bad.push('fillRow '+mode+'/'+acct+'/'+c+': 유지='+kept+', 규칙='+fits);
  S.reb.rows = [{name:'점검용',code:c,cls:'기타주식',price:100,have:0,target:''}];
  const cut = dropUnfitCodes()===1;
  if(cut !== !fits) bad.push('dropUnfit '+mode+'/'+acct+'/'+c+': 비움='+cut+', 규칙='+(!fits));
}));
ok(bad.length===0, 'B1 코드 사용 가능 판단이 자리끼리 일치 ('+(PLANS.length*CODES.length)+'가지)'
   + (bad.length?String.fromCharCode(10)+'        '+bad.join(String.fromCharCode(10)+'        '):''));

/* B2. 검색할 시장은 늘 그 계획에서 쓸 수 있는 시장이어야 합니다(rebMarket 불변식). */
const bad2 = [];
PLANS.forEach(([mode,acct])=>{
  S.reb.mode=mode; S.reb.acct=acct;
  [['비트코인','','가상화폐'],['애플','','미국주식'],['KODEX 200','','한국주식'],
   ['처음 보는 것','','기타주식'],['애플','AAPL','미국주식']].forEach(([name,c,cls])=>{
    const m = rebMarket({name, code:c, cls});
    if(m && !marketFitsReb(m)) bad2.push(mode+'/'+acct+'/'+name+'→'+m);
  });
});
ok(bad2.length===0, 'B2 검색할 시장은 늘 쓸 수 있는 시장' + (bad2.length?' ('+bad2.join(', ')+')':''));

/* B3. 시장을 말해 주는 세 갈래(코드 모양 · 거래소 접두사 · 시세 출처)가 어긋나지 않는지. */
const bad3 = [];
[['069500','KR'],['AAPL','US'],['KRW-BTC','CRYPTO'],['BTC-ETH','CRYPTO_ALT'],
 ['KRX:005930','KR'],['NASDAQ:NVDA','US'],['BRK-B','US']].forEach(([c,want])=>{
  if(codeMarket(c)!==want) bad3.push('codeMarket('+c+')='+codeMarket(c));
  const sure = codeMarketSure(c);
  if(sure && sure!==want) bad3.push('codeMarketSure('+c+')='+sure);
});
[['naver-basic','069500','KR'],['stooq','AAPL','US'],['upbit','KRW-BTC','CRYPTO'],
 ['upbit','BTC-ETH','CRYPTO_ALT']].forEach(([s,c,want])=>{
  if(srcMarket(s,c)!==want) bad3.push('srcMarket('+s+','+c+')='+srcMarket(s,c));
});
ok(bad3.length===0, 'B3 코드 모양·접두사·시세 출처의 판단이 일치' + (bad3.length?' ('+bad3.join(', ')+')':''));

/* B4. 통화를 모르는 시장은 어떤 계획에서도 쓰이지 않아야 합니다. */
const bad4 = [];
PLANS.forEach(([mode,acct])=>{
  S.reb.mode=mode; S.reb.acct=acct;
  MKTS.forEach(m=>{ if(!marketCur(m) && marketFitsReb(m)) bad4.push(mode+'/'+acct+'/'+m); });
});
ok(bad4.length===0, 'B4 통화를 모르는 시장은 어디서도 못 쓴다' + (bad4.length?' ('+bad4.join(', ')+')':''));

/* B5. 한 계좌는 어디서 보아도 한 열쇠 — 살아 있는 계좌 / id 남은 기록 / id 없는 옛 기록. */
const bad5 = [];
S.accounts.forEach(a=>{
  const k1 = acctKey(a), k2 = snapAcctId(a.name, {id:a.id}, {}), k3 = snapAcctId(a.name, {}, {});
  if(k1!==k2 || k1!==k3) bad5.push(a.name+': '+k1+' / '+k2+' / '+k3);
});
ok(bad5.length===0, 'B5 계좌 열쇠가 자리끼리 일치' + (bad5.length?' ('+bad5.join(' | ')+')':''));

/* B6. 후보 목록은 열쇠가 겹치지 않고, 행 ↔ 후보가 왕복해야 합니다. */
const bad6 = [];
S.reb.mode='cash';
[undefined,'한국주식','미국주식','가상화폐','기타주식'].forEach(cls=>{
  const list = pickable(cls);
  if(new Set(list.map(o=>o.key)).size !== list.length) bad6.push((cls||'전체')+': 열쇠 겹침');
  list.forEach(o=>{
    const back = pickFor({name:o.name, code:o.code}, list);
    if(back!==o) bad6.push((cls||'전체')+'/'+o.label+': 왕복 안 됨');
  });
});
ok(bad6.length===0, 'B6 후보 열쇠가 유일하고 행 ↔ 후보가 왕복' + (bad6.length?' ('+bad6.join(', ')+')':''));

/* B7. 이 기기 저장소에 들어가는 이름은 늘 '확정된' 이름 — 편집 중 값이 아닙니다. */
S = normalize({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
SNAPS=[];
dirty = false;
{
  const inp = { value:'토', style:{}, dataset:{ acct:'0' } };
  if(inp.dataset.was == null) inp.dataset.was = S.accounts[0].name;   /* input 핸들러가 하는 일 전부 */
  ok(S.accounts[0].name==='토스' && dirty===false,
     'B7 편집 중 이름은 S 에 들어가지 않는다 (이름 ' + S.accounts[0].name + ', 저장할 것 ' + dirty + ')');
  commitAcctName(inp);
  ok(S.accounts[0].name==='토' && S.aliases['토스']==='토',
     'B7 확정할 때 이름과 연결이 함께 들어간다');
}
`);
console.log('\n' + (bad ? '소스 점검 위반 ' + bad + '건' : '소스 점검 통과'));
process.exit(bad ? 1 : 0);
