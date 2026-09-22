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
  /* 줄 수를 정해 두고 거슬러 오르면, 함수가 길 때 검사가 조용히 통과합니다(그래서 R1b 가
     아무것도 안 잡고 있었습니다). 바로 위의 function 선언을 찾을 때까지 끝까지 올라갑니다. */
  const re = new RegExp('function (' + names.join('|') + ')\\b');
  for(let i=n; i>0; i--){
    if(/^\s*function /.test(code[i-1])) return re.test(code[i-1]);
  }
  return false;
};

/* 이 줄을 감싸는 '가장 안쪽 블록' — 줄 수를 정해 두고 훑으면 자리가 길어질 때 검사가 조용히
   통과합니다(inside() 가 그랬습니다). 그래서 중괄호를 세어 블록의 시작·끝을 찾습니다. */
const blockOf = n => {
  const walk = (i, step) => {                   /* 열리지 않은 짝을 만나는 줄까지 */
    let depth = 0;
    for(; i>0 && i<=code.length; i+=step){
      const chars = step<0 ? [...code[i-1]].reverse() : [...code[i-1]];
      for(const ch of chars){
        if(ch === (step<0 ? '}' : '{')) depth++;
        else if(ch === (step<0 ? '{' : '}')){ if(depth) depth--; else return i; }
      }
    }
    return step<0 ? 1 : code.length;
  };
  return code.slice(walk(n,-1) - 1, walk(n,1));
};

console.log('── 소스 점검 ──');

/* R1. 종목코드끼리 견줄 때는 반드시 mktKey 를 거칩니다(대소문자·공백 차이로 다른 종목이 됩니다).
   모양을 좁게 잡았다가 `(r.code||'').trim()===src` 를 놓친 적이 있습니다. 그래서 '코드가
   어느 한쪽에 나오는 비교'를 모두 잡고, 코드 비교가 아님을 확인한 줄만 아래에 적어 뺍니다.
   새로 빼려면 왜 코드 비교가 아닌지 여기에 적으세요. */
{
  const ALLOW = [
    /h===src|h!==dst/,                      /* 보유종목 객체끼리 — 같은 항목인지 */
    /inp\.value!==h\.c/,                    /* 화면에 적힌 글자 vs 저장된 값 — 다시 그릴지 판단 */
    /codeMarket\([^)]*\)\s*(===|!==)/,      /* 시장끼리 */
    /nameKey\(|\.nk\s*(===|!==)/,           /* 이름(열쇠)끼리 */
    /\.market\s*(===|!==)/,                 /* 검색 결과의 시장 */
    /pcur\s*(===|!==)|(===|!==)\s*[a-z]*\.cur\b/,  /* 통화끼리 (코드가 같은 줄에 있을 뿐) */
    /f\s*===\s*'(code|name|cls)'/,          /* 어느 칸을 고쳤나 — 칸 이름끼리 */
  ];
  const h = code.map((l,i)=>({n:i+1,l}))
    .filter(x=>/(===|!==)/.test(x.l))
    .filter(x=>/(\.code\b|\.c\b|\bhc\b|\brc\b|\bsrc\b|\bwasCode\b)[^=!]*(===|!==)|(===|!==)[^=]*(\.code\b|\.c\b|\bhc\b|\brc\b|\bsrc\b|\bwasCode\b)/.test(x.l))
    .filter(x=>!/mktKey/.test(x.l))
    .filter(x=>!ALLOW.some(re=>re.test(x.l)));
  ok(h.length===0, 'R1 코드끼리 비교는 mktKey 를 거친다' + (h.length?'\n        '+show(h):''));
}
/* R1b. 추가 매수 후보는 이 계획에 쓸 수 있는 것만 — 고르는 자리가 검증을 우회했습니다. */
{
  /* pickable 함수 본문 안에 codeFitsReb 판단이 반드시 있어야 합니다.
     (한 줄만 보던 예전 검사는 판단이 다른 줄로 옮겨가면 조용히 통과했습니다.) */
  let inPick=false, seen=false;
  code.forEach(l=>{
    if(/^\s*function pickable\b/.test(l)) inPick=true;
    else if(inPick && /^\s*function /.test(l)) inPick=false;
    if(inPick && /codeFitsReb/.test(l)) seen=true;
  });
  ok(seen, 'R1b pickable 이 codeFitsReb 로 못 쓰는 코드를 가려낸다');
}

/* R2b. 모양으로 시장이 정해지는 코드(국내 6자리·거래소 접두사·업비트 마켓)는 그 값이
   이깁니다 — 시세 출처·검색 결과가 틀릴 수 있습니다. 국내 ETF(411060)가 'US' 로 적혀
   원화 계좌 현재가가 버려졌습니다. setCodeMarket 이 그 판단을 먼저 해야 합니다. */
{
  const bad = [];
  const at = code.findIndex(l=>/^function setCodeMarket\b/.test(l));
  if(at < 0) bad.push('setCodeMarket 을 찾지 못함');
  else {
    const body = blockOf(at+2);
    const iFixed = body.findIndex(l=>/codeMarketFixed\(/.test(l));
    const iClaim = body.findIndex(l=>/MKTS\.includes\(mkt\)/.test(l));
    if(iFixed < 0) bad.push('모양 판단(codeMarketFixed)을 쓰지 않음');
    else if(iClaim >= 0 && iFixed > iClaim) bad.push('넘겨받은 시장을 먼저 씀');
  }
  /* 불러올 때 잘못 적힌 값을 바로잡는 자리도 있어야 합니다(한 번 적히면 스스로 낫지 않습니다) */
  const heal = hits(/scrubMkts\(\)/).filter(x=>!/^function/.test(x.l.trim()));
  if(!heal.length) bad.push('불러올 때 대장을 바로잡지 않음');
  ok(bad.length===0, 'R2b 모양으로 정해지는 코드의 시장은 덮이지 않는다'
     + (bad.length?' ('+bad.join(', ')+')':''));
}
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
/* R6b. 리밸런싱 코드칸도 편집 중에는 S 에 넣지 않습니다(R6 를 이 자리에도). */
{
  const h = hits(/r\[f\]\s*=/).filter(x=>/'code'/.test(x.l));
  ok(h.length===0, "R6b 편집 중 코드를 S 에 넣지 않는다" + (h.length?'\n        '+show(h):''));
}
/* R6c. 마무리되지 않은 편집은 한 함수에서 모두 확정합니다 — 저장·이탈 경로가 갈라지면
   한쪽만 고치게 됩니다(실제로 계좌 이름만 고치고 코드칸을 빠뜨렸습니다). */
{
  const call = hits(/flushPendingEdits\(\)/).filter(x=>!/^function/.test(x.l.trim()));
  const old  = hits(/flushAcctNameEdits/);
  ok(call.length>=3 && old.length===0,
     'R6c 편집 마무리는 flushPendingEdits 한 곳으로 (' + call.length + '군데)'
     + (old.length?'\n        옛 이름이 남아 있음:\n        '+show(old):''));
}
/* R8. 리밸런싱 행의 단가는 setRebPrice 로만 넣습니다.
   '가까이에 판단이 있나'를 보는 검사로는 모자랐습니다 — 판단은 그대로 둔 채 대입 쪽 조건에서만
   빼면 그대로 통과했습니다(빌려오기 자리에서 실제로 그랬습니다). 그래서 판단과 대입을 한
   함수에 붙여 두고, 여기서는 '그 함수를 거치지 않는 대입' 자체를 금지합니다. */
{
  const h = code.map((l,i)=>({n:i+1,l}))
    /* 0 으로 비우는 것은 언제나 안전하므로 뺍니다(버리는 쪽은 막을 이유가 없습니다). */
    .filter(x=>/\b(r|r0|row)\.price\s*=\s*[^0\s;]/.test(x.l)
             /* 행을 만들면서 단가를 끼워 넣는 것도 같은 대입입니다(리밸런싱 행은 code 를 함께 적습니다) */
             || (/\bprice\s*:\s*[^0,\s]/.test(x.l) && /\bcode\s*:/.test(x.l)))
    .filter(x=>!/setRebPrice/.test(x.l))
    .filter(x=>!inside(x.n, ['setRebPrice']));
  ok(h.length===0, 'R8 리밸런싱 단가는 setRebPrice 로만 넣는다' + (h.length?'\n        '+show(h):''));
}
/* R8b. 입력 핸들러의 공용 대입(r[f] = …)으로 단가가 흘러들면 안 됩니다 — 단가 분기를 지우면
   사람이 적은 값이 곧바로 S 에 들어갑니다. 그래서 그 대입이 있는 블록에는 반드시 단가
   분기(setRebPrice)가 함께 있어야 합니다. */
{
  /* 분기가 '있는 것처럼' 보이기만 해도 통과하면 안 되므로, 조건과 호출을 둘 다 봅니다
     (조건을 if(false) 로 바꿔 두면 setRebPrice 는 그대로 남아 통과했습니다). */
  const h = hits(/r\[f\]\s*=/).filter(x=>{
    const blk = blockOf(x.n);
    return !blk.some(l=>/setRebPrice\(/.test(l)) || !blk.some(l=>/f\s*===\s*'price'/.test(l));
  });
  ok(h.length===0, 'R8b 공용 대입 앞에 단가 분기가 살아 있다' + (h.length?'\n        '+show(h):''));
}
/* R9. 리밸런싱 행의 코드는 setRebCode 로만 정합니다 — 코드와 단가는 늘 함께 움직여야 합니다.
   자동매칭이 코드만 새로 붙이고 손으로 적어 둔 옛 단가를 그대로 두었습니다. 비우는 것(='')은
   언제나 안전하므로 뺍니다. */
{
  /* row 는 fillRow 가 만드는 리밸런싱 행입니다 — 이름을 빼 두었다가 그 자리를 놓쳤습니다. */
  const h = code.map((l,i)=>({n:i+1,l}))
    .filter(x=>/\b(r|r0|row)\.code\s*=(?!=)\s*[^'"\s]/.test(x.l))
    .filter(x=>!/setRebCode/.test(x.l))
    .filter(x=>!inside(x.n, ['setRebCode']));
  ok(h.length===0, 'R9 리밸런싱 코드는 setRebCode 로만 정한다' + (h.length?'\n        '+show(h):''));
}
/* R10. 입력칸을 새로 만드는 그리기는 withPendingEdits 를 지나야 합니다.
   편집 중인 값은 S 에 없으므로(R6), 그냥 다시 그리면 적던 계좌 이름·코드가 통째로 사라집니다
   (시세 조회·자동 저장이 끝나면서 renderAll 이 돌 때). 확정으로 때우면 조각난 이름이 굳습니다. */
{
  const bad = [];
  /* 지켜야 할 그리기 함수를 이름으로 적어 두면 새 화면이 생길 때 빠집니다 — 실제로 설정
     화면(renderCodes)을 빠뜨렸습니다. 그래서 '추적하는 입력칸이 든 틀을 innerHTML 로 새로
     만드는 자리' 를 소스에서 찾아, 그 함수가 모두 보호를 지나는지 봅니다. */
  const FRAMES = /root\.innerHTML\s*=|#tReb'\)\.innerHTML\s*=|#tCodes'\)\.innerHTML\s*=/;
  const paints = code.map((l,i)=>({n:i+1,l})).filter(x=>FRAMES.test(x.l));
  if(paints.length < 3) bad.push('새로 만드는 자리가 '+paints.length+'군데뿐 — 찾는 모양이 낡았는지 보세요');
  paints.forEach(x=>{
    let fn = '';
    for(let i=x.n; i>0; i--){ const m=/^function ([A-Za-z0-9_$]+)/.exec(code[i-1]); if(m){ fn=m[1]; break; } }
    if(!fn){ bad.push(x.n+'줄을 감싸는 함수를 찾지 못함'); return; }
    const wrapped = code.some(l=>new RegExp('withPendingEdits\\(.*\\b'+fn+'\\b').test(l))
                 || blockOf(x.n).some(l=>/withPendingEdits\(/.test(l));
    if(!wrapped) bad.push(fn+' 이 withPendingEdits 를 지나지 않음');
  });
  /* 되돌리는 쪽이 '확정' 을 부르면 조각난 값이 S 에 들어갑니다 — 그러면 R6 가 무너집니다. */
  const at = code.findIndex(l=>/^function restoreEdits\b/.test(l));
  if(at < 0) bad.push('restoreEdits 함수를 찾지 못함');
  else if(blockOf(at+2).some(l=>/commitAcctName\(|commitRebCode\(/.test(l)))
    bad.push('restoreEdits 가 편집을 확정해 버림');
  ok(bad.length===0, 'R10 다시 그릴 때 편집 중인 값을 지킨다' + (bad.length?' ('+bad.join(', ')+')':''));
}
/* R10b. 다시 그리는 중에 오는 change 로 편집을 확정하면 안 됩니다. 브라우저는 입력칸이 화면에서
   빠질 때 그 칸의 change 를 그 자리에서 띄우고, 그것을 확정으로 받으면 적다 만 값이 굳습니다
   (화면에는 확정된 값이 보여 알아채기도 어렵습니다 — 실제로 그렇게 '토스증' 이 굳었습니다). */
{
  const bad = [];
  const at = code.findIndex(l=>/^function withPendingEdits\b/.test(l));
  if(at < 0) bad.push('withPendingEdits 를 찾지 못함');
  else {
    const blk = blockOf(at+2);
    if(!blk.some(l=>/painting\s*\+\+/.test(l)) || !blk.some(l=>/painting\s*--/.test(l)))
      bad.push('withPendingEdits 가 painting 을 올리고 내리지 않음');
  }
  /* 확정하는 자리를 이름으로 모아 둡니다 — 설정 화면의 코드칸(applyToGroup)을 빠뜨렸습니다.
     칸을 벗어날 때(focusout)도 확정하므로 함께 봅니다: 되돌려 놓은 값에는 change 가 오지
     않아서, focusout 이 없으면 다 적어 놓고 칸을 벗어났는데 조용히 사라집니다. */
  const COMMITS = /commitAcctName\(|commitRebCode\(|applyToGroup\(/;
  const guards  = /if\(painting[^)]*\)\s*return|painting\s*\|\|/;
  /* 핸들러가 'e.target 을 넘기는 한 줄' 이면 그 함수 안까지만 봅니다. 부르는 함수를 모두
     따라 들어가게 했더니 어느 핸들러든 모든 낱말이 걸려, 아무것도 못 잡는 검사가 됐습니다. */
  const oneLevel = blk => {
    const out = blk.slice();
    blk.forEach(l=>{
      const m = /\b([A-Za-z_$][\w$]*)\(e\.target\)/.exec(l); if(!m) return;
      const at = code.findIndex(x=>new RegExp('^\\s*(function '+m[1]+'\\b|const '+m[1]+'\\s*=)').test(x));
      if(at>=0) out.push(...blockOf(at+1));
    });
    return out.join('\n');
  };
  /* 한 줄짜리 핸들러(e=>commitCode(e.target))는 다음 줄이 본문이 아닙니다 — 다음 줄만 보다가
     엉뚱한 핸들러를 보고 있었습니다. 여는 줄 자체를 먼저 보고, 중괄호를 열 때만 본문을 붙입니다. */
  const handlerBody = n =>
    oneLevel(/\{\s*$/.test(code[n-1]) ? [code[n-1], ...blockOf(n+1)] : [code[n-1]]);
  hits(/addEventListener\('(change|focusout)'/).forEach(x=>{
    const body = handlerBody(x.n);
    if(COMMITS.test(body) && !guards.test(body))
      bad.push(x.n+'줄 핸들러에 painting 확인이 없음');
  });
  /* 칸을 벗어날 때(focusout)도 확정해야 합니다 — 다시 그리며 되돌려 놓은 값은 코드가 넣은
     것이라, 브라우저가 그 뒤의 blur 에 change 를 띄우지 않습니다(다 적어 놓고 칸을 벗어났는데
     조용히 사라졌습니다). 표시와 확정 함수가 한 핸들러 안에 함께 있어야 합니다. */
  [['was','commitAcctName\\('], ['wasCode','commitRebCode\\('], ['cf','applyToGroup\\(']]
  .forEach(([mark, fn])=>{
    const seen = hits(/addEventListener\('focusout'/).some(x=>{
      const body = handlerBody(x.n);
      return new RegExp('\\b'+mark+'\\b').test(body) && new RegExp(fn).test(body);
    });
    if(!seen) bad.push(mark+' 칸은 벗어날 때 확정하지 않음');
  });
  ok(bad.length===0, 'R10b 다시 그리는 중의 change 로는 확정하지 않는다'
     + (bad.length?' ('+bad.join(', ')+')':''));
}
/* R11. 계좌 보유종목의 단가는 setHoldPrice 로만 넣습니다 — 통화 판단이 시세 반영·자동매칭·
   이름으로 퍼뜨리기·손입력 네 곳에 흩어져 있었고, 앞의 세 곳을 빠뜨렸습니다. */
{
  const h = code.map((l,i)=>({n:i+1,l}))
    .filter(x=>/\b(h|dst|x\.h|src)\.p\s*=(?!=)\s*[^0\s;]/.test(x.l))
    .filter(x=>!/setHoldPrice/.test(x.l))
    .filter(x=>!inside(x.n, ['setHoldPrice']));
  ok(h.length===0, 'R11 계좌 종목 단가는 setHoldPrice 로만 넣는다' + (h.length?'\n        '+show(h):''));
}
/* R11b. 보유종목 입력 핸들러의 공용 대입(h[f] = …)으로 단가가 흘러들면 안 됩니다. */
{
  const h = hits(/h\[f\]\s*=\s*num\(/).filter(x=>{
    const blk = blockOf(x.n);
    return !blk.some(l=>/setHoldPrice\(/.test(l)) || !blk.some(l=>/f\s*===\s*'p'/.test(l));
  });
  ok(h.length===0, 'R11b 보유종목 공용 대입 앞에 단가 분기가 살아 있다' + (h.length?'\n        '+show(h):''));
}
/* R14. 자동 저장은 고치던 값을 확정하지 않습니다. 사람이 아직 칸에 글쇠를 두고 있는데,
   앞선 편집으로 예약된 6초 타이머가 돌아 적다 만 이름·코드가 확정되어 서버까지 올라갔습니다.
   확정은 사람이 한 행동(칸을 벗어남·저장 누름·앱을 떠남)일 때만 합니다. */
{
  const bad = [];
  const at = code.findIndex(l=>/^async function pushToSheet\b/.test(l));
  if(at < 0) bad.push('pushToSheet 를 찾지 못함');
  else {
    const body = blockOf(at+2).join('\n');
    if(!/flushPendingEdits\(\)/.test(body)) bad.push('저장 전에 확정하지 않음');
    else if(!/if\(!auto\)\s*flushPendingEdits\(\)/.test(body)) bad.push('자동 저장에서도 확정함');
  }
  ok(bad.length===0, 'R14 자동 저장은 고치던 값을 확정하지 않는다' + (bad.length?' ('+bad.join(', ')+')':''));
}
/* R14b. 되돌릴 자리는 '몇 번째 칸' 이 아니라 그 값이 속한 것으로 찾습니다 — 자리로 찾으면
   그 사이에 순서가 바뀌었을 때(패널 끌어 옮기기는 blur 없이 다시 그립니다) 같은 자리에 온
   다른 계좌에 초안이 붙고, 칸을 벗어나는 순간 엉뚱한 계좌의 이름이 바뀝니다. */
{
  const bad = [];
  const at = code.findIndex(l=>/^function pendingEdits\b/.test(l));
  if(at < 0) bad.push('pendingEdits 를 찾지 못함');
  else {
    const body = blockOf(at+2).join('\n');
    if(!/\bid\b/.test(body) || !/findIndex/.test(body)) bad.push('계좌를 id 로 다시 찾지 않음');
    /* 잡아 둘 때의 자리 번호를 그대로 선택자에 박아 두면 안 됩니다 */
    if(/\[data-acct="\$\{t\.dataset\.acct\}"\]/.test(body)) bad.push('계좌를 자리 번호로 되찾음');
    if(/tr\[data-g="\$\{tr\.dataset\.g\}"\]/.test(body)) bad.push('설정 화면을 자리 번호로 되찾음');
  }
  ok(bad.length===0, 'R14b 되돌릴 자리는 자리 번호가 아니라 그 값이 속한 것으로 찾는다'
     + (bad.length?' ('+bad.join(', ')+')':''));
}
/* R13. 화면에 없는 칸을 다루는 분기가 남아 있으면 안 됩니다. 닿지 않는 코드에 검사를 붙여
   두면 '덮여 있는 것처럼' 보입니다 — 보유종목 표에서 코드 칸이 없어졌는데 그 분기와 함수가
   남아, 통화 검사를 거기에 붙여 두고 통과를 확인하고 있었습니다. */
{
  const all = code.join('\n');
  const names = (re, cut) => new Set((all.match(re)||[]).map(s=>s.slice(cut,-1)));
  const rendered = new Set([...names(/data-f="([a-z]+)"/g, 8), ...names(/data-rf="([a-zA-Z]+)"/g, 9),
                            ...names(/data-cf="([a-z]+)"/g, 9)]);
  const h = [...names(/f==='([a-zA-Z]+)'/g, 5)].filter(f=>!rendered.has(f));
  ok(h.length===0, 'R13 화면에 없는 칸의 분기가 남아 있지 않다'
     + (h.length?' ('+h.join(', ')+')':''));
}
/* R12. 불러온 상태는 loadState 한 곳으로만 받아들입니다 — 입력하는 길을 모두 막아도
   '이미 저장되어 있던 값' 은 이 길로 들어옵니다(서버·옛 시점·파일 가져오기·처음 켤 때). */
{
  const h = hits(/S\s*=\s*normalize\(/).filter(x=>!inside(x.n, ['loadState']));
  ok(h.length===0, 'R12 불러오기는 loadState 로만 한다' + (h.length?'\n        '+show(h):''));
}
/* R12b. 리밸런싱이 고른 계좌(이름)를 옮기는 것은 retargetReb 뿐입니다 — 이름을 옮기는 자리가
   셋인데(이름 바꾸기·같은 이름 가르기·옛 시점 복원) 복원 쪽에서 빠뜨렸습니다.
   아래 두 가지는 '옮기기' 가 아니라서 뺍니다. 새로 빼려면 왜 옮기기가 아닌지 적으세요. */
{
  const ALLOW = [
    /if\(!S\.reb\.acct/,            /* 비어 있을 때 첫 계좌로 채우는 기본값 */
    /e\.target\.value/,             /* 사람이 드롭다운에서 고른 것 */
  ];
  const h = hits(/\breb\.acct\s*=(?!=)/)
    .filter(x=>!ALLOW.some(re=>re.test(x.l)))
    .filter(x=>!inside(x.n, ['retargetReb']));
  ok(h.length===0, 'R12b 고른 계좌 이름을 옮기는 것은 retargetReb 뿐' + (h.length?'\n        '+show(h):''));
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
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:1e6,h:[H('비트코인','KRW-BTC','가상화폐',0.1,1.5e8)]},
  /* 원화 계좌에 달러 코드가 잘못 들어 있는 상황 — B8 이 이 자리를 지나야 의미가 있습니다 */
  {name:'섞인 계좌',cur:'KRW',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',5,230)]} ],
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
/* 모양으로 정해지는 코드는 출처가 뭐라 해도 그 시장입니다 — 국내 6자리 ETF 가 stooq 로
   넘어가 'US' 로 적히면서 원화 계좌 현재가가 버려졌습니다(TIGER KRX금현물 411060). */
[['411060','KR'],['005930','KR'],['KRX:005930','KR'],['NASDAQ:NVDA','US'],
 ['KRW-BTC','CRYPTO'],['BTC-ETH','CRYPTO_ALT']].forEach(([c,want])=>{
  if(codeMarketFixed(c)!==want) bad3.push('codeMarketFixed('+c+')='+codeMarketFixed(c));
  ['US','KR','CRYPTO','CRYPTO_ALT',''].forEach(claim=>{
    setCodeMarket(c, claim);                      /* 틀린 주장이 와도 */
    if(marketOfCode(c)!==want) bad3.push(c+' ← '+claim+' 에 덮임: '+marketOfCode(c));
  });
});
/* 모양이 정해 주지 않는 코드는 출처가 근거입니다(코인 지갑에 BTC 라고 적는 사람도 있습니다) */
['AAPL','BRK-B','ZZTOP'].forEach(c=>{ if(codeMarketFixed(c)) bad3.push('codeMarketFixed('+c+') 가 넘겨짚음'); });
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
/* B8. 후보 목록에 이 계획에서 쓸 수 없는 코드가 섞여 있지 않은지 — 고르는 자리는
   검증을 거치지 않으므로, 목록 자체가 규칙을 지켜야 합니다. */
const bad8 = [];
[['cash','토스'],['all','토스'],['all','해외'],['all','업비트']].forEach(([mode,acct])=>{
  S.reb.mode=mode; S.reb.acct=acct;
  [undefined,'한국주식','미국주식','가상화폐','기타주식'].forEach(cls=>{
    pickable(cls).forEach(o=>{
      if(o.code && !codeFitsReb(o.code)) bad8.push(mode+'/'+acct+'/'+(cls||'전체')+'/'+o.code);
    });
  });
});
/* B9. '이 행에 단가를 넣어도 되나' 는 rebPriceOk 한 곳에서만 판단합니다.
   검사 안에서 판단을 다시 적으면 앱에서 판단을 지워도 통과합니다(실제로 그랬습니다).
   그래서 여기서는 앱의 rebPriceOk 를 불러 codeFitsReb 와 같은 답을 내는지만 봅니다.
   자리마다 이 함수를 실제로 거치는지는 소스 점검 R8 이 봅니다. */
const bad9 = [];
PLANS.forEach(([mode,acct])=>{
  S.reb.mode=mode; S.reb.acct=acct;
  CODES.forEach(c=>{
    const want = codeFitsReb(c);
    [c, ' '+c+' ', c.toLowerCase()].forEach(v=>{         /* 공백·대소문자가 답을 바꾸면 안 됩니다 */
      const got = rebPriceOk({name:'점검용',code:v,cls:'기타주식',price:0,have:0,target:''});
      if(got!==want) bad9.push(mode+'/'+acct+'/'+JSON.stringify(v)+'='+got);
    });
  });
  /* 코드가 없는 행은 막을 근거가 없으므로 언제나 받습니다 */
  ['', '   ', undefined].forEach(v=>{
    if(rebPriceOk({name:'직접입력',code:v,cls:'기타주식',price:0,have:0,target:''})!==true)
      bad9.push(mode+'/'+acct+'/코드없음');
  });
  if(rebPriceOk(null)!==true || rebPriceOk(undefined)!==true) bad9.push(mode+'/'+acct+'/행없음');
});
ok(bad9.length===0, 'B9 단가를 넣어도 되는지는 rebPriceOk 가 codeFitsReb 와 같은 답을 낸다'
   + (bad9.length?' ('+bad9.join(', ')+')':''));

/* B9b. 단가를 넣는 유일한 자리(setRebPrice)가 그 판단과 어긋나지 않는지 — 넣을 때는 넣고,
   못 넣을 때는 들고 있던 값까지 버려야 합니다(화면만 0 이고 S 에 남으면 셈이 달라집니다). */
const bad9b = [];
PLANS.forEach(([mode,acct])=>{
  S.reb.mode=mode; S.reb.acct=acct;
  CODES.forEach(c=>{
    const r = {name:'점검용',code:c,cls:'기타주식',price:111,have:0,target:''};
    const took = setRebPrice(r, 230);
    if(took !== rebPriceOk({code:c})) bad9b.push(mode+'/'+acct+'/'+c+' 판단 어긋남');
    if(took ? r.price!==230 : r.price!==0) bad9b.push(mode+'/'+acct+'/'+c+'='+r.price);
    /* 빌려온 단가는 출처 코드로 봅니다 — 출처를 모르면 빌리지 않습니다 */
    const b = {name:'점검용',code:'',cls:'기타주식',price:0,have:0,target:''};
    if(setRebPrice(b, 230, c) !== codeFitsReb(c)) bad9b.push(mode+'/'+acct+'/빌림 '+c);
    if(setRebPrice(b, 230, '') !== false) bad9b.push(mode+'/'+acct+'/출처 모름');
  });
});
ok(bad9b.length===0, 'B9b 단가를 넣는 자리(setRebPrice)가 그 판단과 일치'
   + (bad9b.length?' ('+bad9b.join(', ')+')':''));

/* B10. 코드와 단가는 함께 움직입니다 — setRebCode 가 앞 코드의 단가를 들고 있게 두면,
   자동매칭처럼 '코드만 붙이는' 자리에서 옛 단가로 셈됩니다. */
const bad10 = [];
S.reb.mode='all'; S.reb.acct='토스';
{
  const r = {name:'점검용',code:'005930',cls:'한국주식',price:70000,have:10,target:''};
  if(setRebCode(r,'069500')!==true || r.price!==0) bad10.push('코드가 바뀌면 버림 ('+r.price+')');
  r.price = 38000;
  [['069500','같은 코드'],[' 069500 ','공백만 다름'],['069500'.toLowerCase(),'대소문자만 다름']]
    .forEach(([c,why])=>{ if(setRebCode(r,c)!==false || r.price!==38000) bad10.push(why+' ('+r.price+')'); });
  if(setRebCode(r,'AAPL')!==true || r.price!==0) bad10.push('못 쓰는 코드로 바꾸면 0 ('+r.price+')');
  if(setRebPrice(r,230)!==false || r.price!==0) bad10.push('그 뒤로도 단가를 안 받음 ('+r.price+')');
  const r2 = {name:'점검용',code:'069500',cls:'한국주식',price:38000,have:0,target:''};
  if(setRebCode(r2,'')!==true || r2.price!==0) bad10.push('코드를 비우면 단가도 버림 ('+r2.price+')');
}
ok(bad10.length===0, 'B10 코드를 정하면 앞 코드의 단가는 남지 않는다'
   + (bad10.length?' ('+bad10.join(', ')+')':''));

/* B11. 계좌 종목 쪽도 같은 짜임새 — 판단(holdPriceOk)과 대입(setHoldPrice)이 어긋나지 않는지.
   넣지 못할 때는 들고 있던 단가·조회출처까지 버리고 이유를 남겨야 합니다. */
const bad11 = [];
[['KRW','069500',true],['KRW','KRX:005930',true],['KRW','KRW-BTC',true],
 ['KRW','AAPL',false],['KRW','BTC-ETH',false],['KRW','',true],
 ['USD','AAPL',true],['USD','NASDAQ:NVDA',true],['USD','069500',false],['USD','KRW-BTC',false]]
 .forEach(([cur,c,want])=>{
  if(holdPriceOk(cur,c)!==want) bad11.push(cur+'/'+(c||'(코드없음)')+' 판단='+holdPriceOk(cur,c));
  const h = {n:'점검용',c,q:1,b:0,m:false,v:0,p:111,ps:'옛출처',pn:'',pe:''};
  if(setHoldPrice(h, 230, cur, 'naver')!==want) bad11.push(cur+'/'+c+' 대입 판단');
  if(want ? (h.p!==230 || h.ps!=='naver' || h.pe!=='')
          : (h.p!==0 || h.ps!=='' || !h.pe)) bad11.push(cur+'/'+c+'='+h.p+'/'+JSON.stringify(h.ps));
});
ok(bad11.length===0, 'B11 계좌 종목 단가도 통화 판단과 대입이 한곳에서 일치'
   + (bad11.length?' ('+bad11.join(', ')+')':''));

/* B12. 불러온 뒤에는 어떤 행도 '쓸 수 없는 단가' 를 들고 있지 않아야 합니다.
   입력하는 길을 다 막아도 저장되어 있던 값은 불러오기로 들어옵니다 — 그대로 두면 화면의
   단가칸은 잠겨 있는데 셈은 그 단가로 돕니다. */
const bad12 = [];
[['cash','토스'],['all','토스'],['all','해외'],['all','업비트']].forEach(([mode,acct])=>{
  const st = { accounts:[
      {name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[]},
      {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[]},
      {name:'업비트',cur:'KRW',grp:'가상자산',cash:1e6,h:[]} ],
    fx:{usdkrw:1400}, mkts:{ 'AAPL':'US', '069500':'KR', 'KRW-BTC':'CRYPTO', 'BTC-ETH':'CRYPTO_ALT' },
    reb:{ acct, preset:'', mode, budget:1e7, tq:2, rows:CODES.map(c=>
      ({name:'점검용',code:c,cls:'기타주식',price:1234,have:0,target:''})) } };
  loadState(st);
  S.reb.rows.forEach(r=>{
    if(+r.price && !rebPriceOk(r)) bad12.push(mode+'/'+acct+'/'+r.code+'='+r.price);
    if(!(r.code||'').trim()) bad12.push(mode+'/'+acct+': 코드를 지워 버림');   /* 고칠 거리를 남겨야 합니다 */
  });
});
ok(bad12.length===0, 'B12 불러온 뒤 쓸 수 없는 단가는 남지 않는다(코드는 남긴다)'
   + (bad12.length?' ('+bad12.join(', ')+')':''));

/* B13. 계좌 이름이 옮겨지면 리밸런싱이 고른 계좌도 따라가야 합니다 — 안 따라가면 rebAcct()
   가 첫 계좌로 넘어가, 예수금·보유량 맞추기가 엉뚱한 계좌 기준으로 돕니다. */
const bad13 = [];
{
  /* (1) 옛 시점 복원 — 연결을 따라 이름이 옮겨지는 경우 */
  const st = { accounts:[
      {name:'토스',cur:'KRW',grp:'투자',cash:0,h:[]},
      {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[]} ],
    fx:{usdkrw:1400}, aliases:{ '해외':'해외증권' }, tq:2,
    reb:{ acct:'해외', preset:'', mode:'all', budget:0, tq:2, rows:[] } };
  canonicalizeAcctNames(st);
  loadState(st);
  if(S.accounts[1].name!=='해외증권') bad13.push('이름이 안 옮겨짐: '+S.accounts[1].name);
  if(S.reb.acct!=='해외증권') bad13.push('고른 계좌가 안 따라감: '+S.reb.acct);
  if(rebAcct().name!=='해외증권') bad13.push('rebAcct 가 다른 계좌: '+rebAcct().name);
  /* (2) 이름 바꾸기 */
  S.reb.acct = S.accounts[1].name;
  renameAcct(1, '해외증권2', { commit:true, was:'해외증권' });
  if(S.reb.acct!=='해외증권2') bad13.push('이름 바꿀 때 안 따라감: '+S.reb.acct);
  /* (3) 같은 이름 가르기 — 앞 계좌가 원래 이름을 지키므로 가리키는 이름은 그대로여야 합니다 */
  const dup = { accounts:[
      {name:'토스',cur:'KRW',grp:'투자',cash:1,h:[]},
      {name:'토스',cur:'KRW',grp:'투자',cash:2,h:[]} ],
    fx:{usdkrw:1400}, reb:{ acct:'토스', preset:'', mode:'all', budget:0, tq:2, rows:[] } };
  loadState(dup);
  if(S.reb.acct!=='토스' || rebAcct().cash!==1)
    bad13.push('가른 뒤 앞 계좌를 가리켜야 함: '+S.reb.acct+'/'+rebAcct().cash);
}
ok(bad13.length===0, 'B13 이름이 옮겨져도 고른 계좌는 그대로 따라간다'
   + (bad13.length?' ('+bad13.join(', ')+')':''));

/* 뒤 검사들이 쓰는 상태를 되돌려 둡니다 */
S = normalize({ accounts:[
  {name:'토스',cur:'KRW',grp:'투자',cash:1e7,h:[H('KODEX 200','069500','한국주식',10,38000)]},
  {name:'해외',cur:'USD',grp:'투자',cash:5000,h:[H('애플','AAPL','미국주식',3,230)]},
  {name:'업비트',cur:'KRW',grp:'가상자산',cash:1e6,h:[H('비트코인','KRW-BTC','가상화폐',0.1,1.5e8)]},
  {name:'섞인 계좌',cur:'KRW',grp:'투자',cash:0,h:[H('애플','AAPL','미국주식',5,230)]} ],
  fx:{usdkrw:1400}, reb:{acct:'토스',preset:'',mode:'all',budget:0,rows:[]} });

ok(bad8.length===0, 'B8 후보 목록에 못 쓰는 코드가 섞이지 않는다' + (bad8.length?' ('+bad8.join(', ')+')':''));
S.reb.mode='cash'; S.reb.acct='토스';

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
