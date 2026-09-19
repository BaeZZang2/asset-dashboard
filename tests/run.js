#!/usr/bin/env node
/* 전체 점검 — 규칙 점검(invariants) 을 먼저, 그다음 회귀 테스트를 돌립니다.
   쓰는 법:  node tests/run.js
   하나라도 어긋나면 0 이 아닌 값으로 끝나므로, 커밋 전에 이것만 보면 됩니다. */
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter(f=>/\.js$/.test(f) && !['harness.js','run.js','invariants.js'].includes(f))
  .sort((a,b)=>{
    const n = s => (s.match(/\d+/)||[0])[0]*1;
    return a.replace(/\d+/,'')===b.replace(/\d+/,'') ? n(a)-n(b) : a.localeCompare(b);
  });

let fail = 0, pass = 0;
const run = f => {
  let out = '', died = '';
  try { out = execFileSync(process.execPath, [path.join(dir,f)], {encoding:'utf8'}); }
  catch(e){
    out = (e.stdout||'') + (e.stderr||'');
    /* 검사가 어긋나면 일부러 1 로 끝냅니다(invariants). 그 밖의 종료는 '죽은' 것입니다. */
    const lines = out.split('\n').filter(l=>/Error|error:/.test(l));
    if(!/^ {2}(실패|위반) /m.test(out) || lines.length) died = lines[0] || '알 수 없는 오류';
  }
  const okN  = (out.match(/^ {2}OK /gm)||[]).length;
  const badN = (out.match(/^ {2}(실패|위반) /gm)||[]).length;
  pass += okN; fail += badN + (died?1:0);
  console.log(`${f.padEnd(15)} 통과 ${String(okN).padStart(3)}`
    + (badN?`  어긋남 ${badN}`:'') + (died?'  중간에 죽음':''));
  if(badN) console.log(out.split('\n').filter(l=>/^ {2}(실패|위반) /.test(l)).join('\n'));
  if(died) console.log('        ' + died.trim());
};

console.log('── 규칙 점검 ──');
run('invariants.js');
console.log('\n── 회귀 테스트 ──');
files.forEach(run);

console.log(`\n합계 통과 ${pass}` + (fail?`, 어긋남 ${fail}` : '') );
if(fail){ console.log('\n어긋난 것이 있습니다. 고치기 전에는 커밋하지 마세요.'); process.exit(1); }
console.log('모두 통과했습니다.');
