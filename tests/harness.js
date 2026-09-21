/* 브라우저 없이 앱 스크립트를 돌리는 공용 껍데기.

   화면 이벤트는 돌지 않습니다(그래서 tests/browser/ 가 따로 있습니다). 다만 '어느 칸을
   찾아오나' 는 여기서도 봐야 해서, 아주 작은 칸 등록부를 둡니다 — DOM.put() 으로 칸을 놓으면
   document.querySelector/All 이 그 칸을 셀렉터로 찾아 줍니다.
   (초안 되돌리기 검사를 손으로 흉내 내다가 '앱의 함수를 부르지 않는 검사' 가 된 적이
   있습니다. 그래서 진짜 pendingEdits/restoreEdits 를 부를 수 있게 해 둡니다.) */
const fs=require('fs'), vm=require('vm');
module.exports = function run(test, file){
  const src=[...fs.readFileSync(file||require('path').join(__dirname,'..','index.html'),'utf8')
    .matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)][0][1];
  const store={};
  const el = ()=>({appendChild(){},remove(){},style:{},innerHTML:'',value:'',textContent:'',
                   dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}}});
  /* 등록부 — 셀렉터 그대로를 열쇠로 씁니다(맞춰 보기가 아니라 그대로 찾기). */
  const boxes = new Map();
  const DOM = {
    put(sel, box){ boxes.set(sel, box); return box; },
    clear(){ boxes.clear(); DOM.active = null; },
    active: null,
    /* '#tReb [data-rf="code"]' 처럼 짧게 물어도 찾게 합니다 — 물어본 토막이 모두 열쇠에
       들어 있으면 그 칸입니다. '[data-acct]' 는 값이 무엇이든 맞습니다.
       (처음엔 열쇠를 통째로 견주다가 $$ 가 아무것도 못 찾아, 검사가 빈손으로 통과했습니다.) */
    all(sel){
      const toks = String(sel).trim().split(/\s+/);
      return [...boxes.entries()].filter(([k])=>toks.every(t=>{
        const bare = /^\[([\w-]+)\]$/.exec(t);
        return bare ? (k.includes('['+bare[1]+'=') || k.includes('['+bare[1]+']')) : k.includes(t);
      })).map(([,v])=>v);
    }
  };
  const sandbox={ console, DOM,
    localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>store[k]=v},
    document:{addEventListener(){},getElementById:()=>null,
              querySelector:sel=>boxes.has(sel) ? boxes.get(sel) : (DOM.all(sel)[0] || el()),
              querySelectorAll:sel=>DOM.all(sel),
              createElement:el,documentElement:{},
              get activeElement(){ return DOM.active; }},
    navigator:{userAgent:'node'}, location:{hash:'',href:'http://x/'},
    fetch:()=>Promise.reject(new Error('no net')), setTimeout, clearTimeout, confirm:()=>true };
  sandbox.window=sandbox; sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src.replace(/document\.addEventListener\('DOMContentLoaded', init\);/,'') + test, sandbox);
};
