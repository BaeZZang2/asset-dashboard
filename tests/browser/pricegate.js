/* 진짜 브라우저에서 확인합니다 — 껍데기(harness)로는 화면 이벤트를 흉내만 낼 수 있어서,
   '입력 핸들러를 통째로 지운' 것 같은 결함은 여기서만 잡힙니다.
     · 코드칸을 다 적기 전에는 S·저장소에 들어가지 않는지
     · 칸을 벗어나면 앞 종목 단가가 버려지는지
     · 못 쓰는 코드의 행에는 단가 칸이 잠기고, 잠금을 풀어도 값이 들어가지 않는지

   쓰는 법(저장소 밖에서):
     npm i playwright
     node tests/browser/pricegate.js
   Chromium 은 /opt/pw-browsers/chromium 을 씁니다(PW_CHROME 로 바꿀 수 있습니다).

   페이지는 이 프로세스가 직접 띄웁니다. 예전에 http-server 를 따로 띄웠다가, 끝내도 죽지
   않아 다음 실행이 '앞서 띄운 옛 화면'을 보고 그대로 통과한 적이 있습니다. */
const fs=require('fs'), path=require('path'), http=require('http');
const ROOT = path.join(__dirname, '..', '..');
/* 그래프는 이 검사와 무관하고, CDN 이 막힌 곳에서도 돌아야 합니다. */
const PAGE = fs.readFileSync(path.join(ROOT,'index.html'),'utf8')
  .replace(/<script[^>]*chart\.js[^>]*><\/script>/,'')
  .replace(/<link[^>]*pretendard[^>]*>/,'');

const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});
const state={ accounts:[
  {name:'토스', cur:'KRW', grp:'투자', cash:10000000, h:[
    H('삼성전자','005930','한국주식',10,70000), H('KODEX 200','069500','한국주식',20,38000) ]} ],
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
  await p.getByRole('button',{name:'리밸런싱'}).click();
  await p.waitForTimeout(300);

  const S = () => p.evaluate(()=>JSON.parse(JSON.stringify(S.reb.rows)));
  const saved = () => p.evaluate(()=>JSON.parse(localStorage.getItem('ad.state')).reb.rows);

  /* 1) 코드를 적는 중 — S 에도 저장소에도 들어가면 안 됩니다 */
  const code0 = p.locator('#tReb tr [data-rf="code"]').first();
  await code0.click();
  await code0.fill('');
  await code0.type('069', {delay:60});
  await p.waitForTimeout(500);
  let r = (await S())[0], st = (await saved())[0];
  ok(r.code==='005930' && r.price===70000, `적는 중에는 S 가 그대로 — ${r.code} / ${r.price}`);
  ok(st.code==='005930' && st.price===70000, `저장소도 그대로 — ${st.code} / ${st.price}`);

  /* 2) 다 적고 칸을 벗어나면 확정 + 앞 종목 단가 버림 */
  await code0.fill('069500');
  await code0.blur();
  await p.waitForTimeout(400);
  r = (await S())[0];
  const priceVal = await p.locator('#tReb tr [data-rf="price"]').first().inputValue();
  ok(r.code==='069500' && r.price===0, `확정하면 코드가 들어가고 단가는 버려짐 — ${r.code} / ${r.price}`);
  ok(priceVal==='0', `화면의 단가 칸도 0 (${priceVal})`);

  /* 3) 원화 계획에 달러 코드를 넣으면 — 단가 칸이 잠기고 손입력도 막힙니다 */
  await code0.fill('AAPL');
  await code0.blur();
  await p.waitForTimeout(400);
  const price0 = p.locator('#tReb tr [data-rf="price"]').first();
  ok(await price0.isDisabled(), '못 쓰는 코드의 단가 칸은 잠김');
  /* 적는 도중(input)과 칸을 벗어날 때(change)를 따로 봅니다 — 한쪽만 막아 두면
     적는 동안 자동 저장이 그 값을 올려 보냅니다. */
  const forced = await p.evaluate(()=>{                 /* 잠금을 풀고 손으로 적어 봅니다 */
    const i=document.querySelector('#tReb tr [data-rf="price"]');
    i.disabled=false; i.value='230';
    i.dispatchEvent(new Event('input',{bubbles:true}));
    const typing = S.reb.rows[0].price;
    i.dispatchEvent(new Event('change',{bubbles:true}));
    return { typing, s: S.reb.rows[0].price, shown: i.value };
  });
  await p.waitForTimeout(400);
  ok(forced.typing===0, `적는 동안에도 S 에 안 들어감 (${forced.typing})`);
  ok(forced.s===0, `칸을 벗어난 뒤에도 S 에 안 들어감 (${forced.s})`);
  ok((await saved())[0].price===0, `저장소에도 안 들어감 (${(await saved())[0].price})`);
  const can = await p.evaluate(()=>computeReb().rows[0].can);
  ok(can===0, `달러 단가로 나눈 매수량이 나오지 않음 (${can})`);

  /* 4) 코드를 쓸 수 있는 것으로 고치면 다시 받습니다 */
  await code0.fill('069500'); await code0.blur(); await p.waitForTimeout(400);
  ok(!(await price0.isDisabled()), '고치면 단가 칸이 다시 열림');
  await price0.fill('38000'); await price0.blur(); await p.waitForTimeout(400);
  r=(await S())[0];
  ok(r.price===38000, `손입력을 정상적으로 받음 (${r.price})`);

  /* 5) 저장 직전 확정 — 적다 만 코드가 있어도 서버로 나가는 것은 확정된 값입니다 */
  await code0.fill('00593');
  await p.waitForTimeout(300);
  const flushed = await p.evaluate(()=>{ flushPendingEdits(); return JSON.parse(JSON.stringify(S.reb.rows[0])); });
  ok(flushed.code==='00593' && flushed.price===0,
     `저장 직전에 확정되고 짝 안 맞는 단가는 버려짐 — ${flushed.code} / ${flushed.price}`);

  ok(errs.length===0, errs.length ? '페이지 오류: '+errs.join(' | ') : '페이지 오류 없음');
  await b.close(); srv.close();
  process.exit(failed ? 1 : 0);
})();
