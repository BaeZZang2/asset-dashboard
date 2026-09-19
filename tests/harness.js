/* 브라우저 없이 앱 스크립트를 돌리는 공용 껍데기 */
const fs=require('fs'), vm=require('vm');
module.exports = function run(test, file){
  const src=[...fs.readFileSync(file||require('path').join(__dirname,'..','index.html'),'utf8')
    .matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)][0][1];
  const store={};
  const el = ()=>({appendChild(){},remove(){},style:{},innerHTML:'',value:'',textContent:'',
                   dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}}});
  const sandbox={ console,
    localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>store[k]=v},
    document:{addEventListener(){},getElementById:()=>null,querySelector:el,querySelectorAll:()=>[],
              createElement:el,documentElement:{}},
    navigator:{userAgent:'node'}, location:{hash:'',href:'http://x/'},
    fetch:()=>Promise.reject(new Error('no net')), setTimeout, clearTimeout, confirm:()=>true };
  sandbox.window=sandbox; sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src.replace(/document\.addEventListener\('DOMContentLoaded', init\);/,'') + test, sandbox);
};
