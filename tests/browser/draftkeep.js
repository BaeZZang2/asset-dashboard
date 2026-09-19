/* 진짜 브라우저에서: 적는 중에 화면이 다시 그려져도(시세 조회·자동 저장이 끝날 때 renderAll
   이 돕니다) 적던 계좌 이름과 리밸런싱 코드가 사라지지 않는지 봅니다.
   껍데기로는 잡히지 않습니다 — DOM 을 새로 만드는 일 자체가 결함의 원인입니다.

   쓰는 법(저장소 밖에서):  npm i playwright && node tests/browser/draftkeep.js
   Chromium 은 /opt/pw-browsers/chromium 을 씁니다(PW_CHROME 로 바꿀 수 있습니다).
   페이지는 이 프로세스가 직접 띄웁니다(따로 띄운 서버가 죽지 않아 옛 화면을 보고 통과한
   적이 있습니다). */
const fs=require('fs'), path=require('path'), http=require('http');
const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT,'index.html'),'utf8')
  .replace(/<script[^>]*chart\.js[^>]*><\/script>/,'')
  .replace(/<link[^>]*pretendard[^>]*>/,'');

const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
const state={ accounts:[
  {name:'토스', cur:'KRW', grp:'투자', cash:10000000, h:[
    H('삼성전자','005930','한국주식',10,70000), H('KODEX 200','069500','한국주식',20,38000) ]},
  {name:'연금', cur:'KRW', grp:'연금', cash:0, h:[H('KODEX 200','069500','한국주식',5,38000)]} ],
  fx:{usdkrw:1400,src:'',at:''}, presets:[], activePreset:'',
  reb:{ acct:'토스', preset:'', mode:'all', budget:0,
        rows:[{name:'삼성전자',code:'005930',cls:'한국주식',price:70000,have:10,target:'20'}] }, rev:1 };

let failed = 0;
const ok=(c,l)=>{ if(!c) failed++; console.log((c?'  OK  ':'  실패')+' '+l); };

(async()=>{
  const {chromium}=require('playwright');
  const srv = http.createServer((q,s)=>{ s.writeHead(200,{'content-type':'text/html; charset=utf-8'}); s.end(PAGE); });
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const url = 'http://127.0.0.1:' + srv.address().port + '/preview.html';
  const b=await chromium.launch({executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:1150,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.addInitScript(st=>{
    localStorage.setItem('ad.state', st); localStorage.setItem('ad.snaps','[]');
    localStorage.setItem('ad.cfg', JSON.stringify({url:'',secret:'',auto:false}));
  }, JSON.stringify(state));
  await p.goto(url);
  await p.waitForTimeout(400);

  /* ── 1) 계좌 이름을 적는 중에 renderAll 이 돌아도 사라지지 않는지 ── */
  await p.getByRole('button',{name:'보유종목'}).click();
  await p.waitForTimeout(300);
  const name0 = p.locator('[data-acct="0"]').first();
  await name0.click();
  await name0.fill('');
  await name0.type('토스증', {delay:50});                 /* '토스증권' 을 적다가 만 상태 */
  await p.waitForTimeout(200);
  const beforeS = await p.evaluate(()=>S.accounts[0].name);
  ok(beforeS==='토스', `적는 중에는 S 가 그대로 (R6) — ${beforeS}`);
  /* 시세 조회·자동 저장이 끝나면 이 함수가 돕니다 */
  await p.evaluate(()=>renderAll());
  await p.waitForTimeout(200);
  const kept = await p.locator('[data-acct="0"]').first().inputValue();
  ok(kept==='토스증',
     `다시 그려도 적던 이름이 남음 (예전에는 '토스' 로 되돌아가 통째로 사라졌습니다) — ${kept}`);
  ok(await p.evaluate(()=>S.accounts[0].name==='토스'),
     '되돌리는 동안 S 는 그대로 — 조각난 이름이 확정되지 않습니다');
  const focused = await p.evaluate(()=>document.activeElement && document.activeElement.dataset.acct);
  ok(focused==='0', `글쇠도 그 칸에 남음 (${focused}) — 이어 치는 글자가 사라진 칸으로 가지 않습니다`);
  /* 이어서 적고 확정하면 온전한 이름이 됩니다 */
  await p.keyboard.type('권');
  await p.locator('[data-acct="0"]').first().blur();
  await p.waitForTimeout(300);
  const after = await p.evaluate(()=>({ nm:S.accounts[0].name, al:S.aliases&&S.aliases['토스'] }));
  ok(after.nm==='토스증권' && after.al==='토스증권',
     `이어 적어 확정하면 온전한 이름 + 옛 이름 연결 — ${after.nm} / ${after.al}`);

  /* ── 2) 리밸런싱 코드를 적는 중에 renderReb 이 돌아도 사라지지 않는지 ── */
  await p.getByRole('button',{name:'리밸런싱'}).click();
  await p.waitForTimeout(300);
  const code0 = p.locator('#tReb tr [data-rf="code"]').first();
  await code0.click();
  await code0.fill('');
  await code0.type('0695', {delay:50});
  await p.waitForTimeout(200);
  ok(await p.evaluate(()=>S.reb.rows[0].code==='005930'), '적는 중에는 S 의 코드가 그대로 (R6)');
  await p.evaluate(()=>renderReb());
  await p.waitForTimeout(200);
  const keptCode = await p.locator('#tReb tr [data-rf="code"]').first().inputValue();
  ok(keptCode==='0695',
     `다시 그려도 적던 코드가 남음 (예전에는 005930 으로 되돌아갔습니다) — ${keptCode}`);
  const st = await p.evaluate(()=>{
    const t = document.querySelector('#tReb tr [data-rf="code"]');
    return { was: t.dataset.wasCode, price: S.reb.rows[0].price };
  });
  ok(st.was==='005930', `편집 전 코드도 함께 남음 (${st.was}) — 확정할 때 짝 안 맞는 단가를 버립니다`);
  ok(st.price===70000, `단가도 아직 그대로 (${st.price})`);
  /* 이어 적어 확정하면 앞 종목 단가는 버려집니다 */
  await p.keyboard.type('00');
  await p.locator('#tReb tr [data-rf="code"]').first().blur();
  await p.waitForTimeout(300);
  const done = await p.evaluate(()=>JSON.parse(JSON.stringify(S.reb.rows[0])));
  ok(done.code==='069500' && done.price===0,
     `확정하면 코드가 들어가고 앞 종목 단가는 버려짐 — ${done.code} / ${done.price}`);

  /* ── 3) 보유종목 현재가도 통화가 안 맞으면 못 넣는지(계좌 쪽 같은 규칙) ── */
  await p.getByRole('button',{name:'보유종목'}).click();
  await p.waitForTimeout(300);
  const forced = await p.evaluate(()=>{
    /* 원화 계좌 종목의 코드를 달러 티커로 바꿔 둡니다(옛 데이터·오입력 상황) */
    S.accounts[0].h[0].c = 'AAPL'; setCodeMarket('AAPL','US');
    renderAll();
    const i = document.querySelector('.panel[data-ai="0"] input[data-f="p"]');
    const wasDisabled = i.disabled;
    i.disabled = false; i.value = '230';
    i.dispatchEvent(new Event('input',{bubbles:true}));
    return { wasDisabled, p: S.accounts[0].h[0].p, why: S.accounts[0].h[0].pe||'' };
  });
  ok(forced.wasDisabled, '통화가 안 맞는 종목의 현재가 칸은 잠김');
  ok(forced.p===0, `잠금을 풀고 적어도 S 에 안 들어감 (${forced.p})`);
  ok(/USD/.test(forced.why), '왜 못 넣었는지 이유가 남음');

  /* ── 4) 설정 화면의 코드칸도 같은 규칙 ── */
  await p.locator('button[data-v="cfg"]').click();
  await p.waitForTimeout(400);
  /* 단가가 들어 있는 줄을 골라야 '단가가 버려지지 않는지' 를 실제로 볼 수 있습니다
     (0 인 줄을 고르면 0 과 0 을 견주는 헛검사가 됩니다). */
  const before = await p.evaluate(()=>{
    const gs = codeGroups();
    const gi = gs.findIndex(g=>+g.rows[0].h.p > 0);
    return { gi, c:gs[gi].rows[0].h.c, p:gs[gi].rows[0].h.p };
  });
  ok(before.gi>=0 && before.p>0, `단가가 있는 줄로 봅니다 (${before.p})`);
  const cf = p.locator(`#tCodes tr[data-g="${before.gi}"] [data-cf="c"]`);
  const codeBefore = before.c;
  await cf.click();
  await cf.fill('');
  await cf.type('0069', {delay:50});                    /* '006990' 을 적다가 만 상태 */
  await p.waitForTimeout(150);
  const mid = await p.evaluate(gi=>({ c:codeGroups()[gi].rows[0].h.c }), before.gi);
  ok(mid.c===codeBefore, `적는 중에는 S 의 코드가 그대로 — ${mid.c}`);
  await p.evaluate(()=>renderAll());                    /* 시세 조회·자동 저장이 끝날 때 */
  await p.waitForTimeout(250);
  const post = await p.evaluate(gi=>({
    c: codeGroups()[gi].rows[0].h.c, p: codeGroups()[gi].rows[0].h.p,
    box: document.querySelector(`#tCodes tr[data-g="${gi}"] [data-cf="c"]`).value,
    guessed: !!(S.mkts && S.mkts['0069']) }), before.gi);
  ok(post.c===codeBefore,
     `다시 그려도 조각난 코드가 확정되지 않음 (예전에는 '0069' 로 굳었습니다) — ${post.c}`);
  ok(post.box==='0069', `적던 코드는 칸에 남음 — ${post.box}`);
  ok(!post.guessed, '넘겨짚은 시장이 대장에 올라가지 않음');
  ok(post.p===before.p, `그 종목 단가도 그대로 (${post.p} / 적기 전 ${before.p})`);

  /* ── 5) 이름으로 코드를 가져올 때 버려진 단가가 화면에도 반영되는지 ── */
  const lent = await p.evaluate(()=>{
    /* 달러 계좌에 AAPL, 원화 계좌에 같은 이름의 코드 없는 종목(손으로 적은 단가) */
    S.accounts.push({ id:'aTest', name:'해외', cur:'USD', grp:'투자', cash:0,
      h:[{n:'애플',c:'AAPL',a:'미국주식',q:1,b:230,p:230,m:false,v:0,ps:'stooq',pn:'',pe:''}] });
    S.accounts[0].h.push({n:'애플2',c:'',a:'미국주식',q:1,b:7000,p:7000,m:false,v:0,ps:'',pn:'',pe:''});
    setCodeMarket('AAPL','US');
    renderAll();
    return true;
  });
  await p.getByRole('button',{name:'보유종목'}).click();
  await p.waitForTimeout(400);
  const nameInp = p.locator('.panel[data-ai="0"] tr[data-h] input[data-f="n"]').last();
  await nameInp.click();
  await nameInp.fill('애플');
  await nameInp.blur();                                 /* 이름이 같아져 코드를 가져옵니다 */
  await p.waitForTimeout(400);
  const pulled = await p.evaluate(()=>{
    const h = S.accounts[0].h[S.accounts[0].h.length-1];
    const tr = document.querySelectorAll('.panel[data-ai="0"] tr[data-h]');
    const box = tr[tr.length-1].querySelector('[data-f="p"]');
    const toasts = [...document.querySelectorAll('#toast > div')].map(d=>d.textContent);
    return { c:h.c, p:h.p, shown:box.value, locked:box.disabled, toast: toasts[toasts.length-1]||'' };
  });
  ok(pulled.c==='AAPL', `코드는 가져옴 (${pulled.c})`);
  ok(pulled.p===0, `통화가 다른 단가는 가져오지 않음 (${pulled.p})`);
  ok(pulled.shown==='0' || +pulled.shown.replace(/,/g,'')===0,
     `화면의 현재가 칸도 0 으로 맞춰짐 (예전에는 7,000 이 남아 평가액과 어긋났습니다) — ${pulled.shown}`);
  ok(pulled.locked, '통화가 안 맞아 그 칸은 잠김');
  ok(/가져오지 않았습니다/.test(pulled.toast),
     `무엇을 못 가져왔는지 알려 줌 — ${pulled.toast.slice(0,70)}`);

  ok(errs.length===0, errs.length ? '페이지 오류: '+errs.join(' | ') : '페이지 오류 없음');
  await b.close(); srv.close();
  process.exit(failed ? 1 : 0);
})();
