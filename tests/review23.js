require('./harness')(`
const ok = (c,l) => console.log((c?'  OK  ':'  실패') + ' ' + l);
const H=(n,c,a,q,p)=>({n,c,a,q,b:q*p,p,m:false,v:0,ps:'',pn:'',pe:''});

/* ══ 국내 ETF 가 'US 시세' 로 잡히던 문제 ══
   ACE KRX금현물 = 411060(숫자만), TIGER KRX금현물 = 0072R0(글자 섞임).
   거래소가 숫자 공간이 차서 영문·숫자 섞인 단축코드를 발급하기 시작했는데, 앱이 국내 코드를
   '6자리 숫자' 로만 알고 있어 0072R0 을 미국 티커로 보고 원화 계좌 현재가를 버렸습니다. */
SNAPS=[];
loadState({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,
    h:[H('TIGER KRX금현물','0072R0','금',10,0)]}], fx:{usdkrw:1400} });
{
  const h = S.accounts[0].h[0];
  ok(codeMarket('0072R0')==='KR',
     '글자 섞인 국내 단축코드도 KR (예전에는 US 였습니다) — 실제 ' + codeMarket('0072R0'));
  ok(codeMarketFixed('0072R0')==='KR', '모양으로 정해지는 코드에 들어감');
  ok(holdPriceOk('KRW','0072R0')===true, '원화 계좌에 단가를 넣을 수 있음');
  setCodeMarket('0072R0', srcMarket('yahoo','0072R0'));
  ok(marketOfCode('0072R0')==='KR', "출처가 'US' 라고 해도 덮이지 않음 — " + marketOfCode('0072R0'));
  ok(setHoldPrice(h, 14250, 'KRW', 'naver-basic')===true && h.p===14250,
     '현재가가 들어감 (예전에는 0 으로 버려졌습니다) — 실제 ' + h.p);
  ok(codeFitsReb('0072R0')===true, '리밸런싱 원화 계획에서도 쓸 수 있음');
  ok(codeHint('0072R0')==='', '고치라는 안내를 붙이지 않음 — 이 코드가 맞습니다');
  /* 대소문자만 다르게 적어도 같은 종목입니다 */
  ok(codeMarket('0072r0')==='KR' && mktKey('0072r0')===mktKey('0072R0'), '소문자로 적어도 같음');
}
/* 미국 티커와 겹치지 않습니다 — 미국 티커는 숫자를 섞지 않습니다 */
['AAPL','GOOGL','BRK.B','NSRGY','TSLA'].forEach(c=>
  ok(codeMarket(c)==='US', c + ' 는 그대로 US'));

/* ══ 숫자만인 국내 코드(ACE KRX금현물 411060)도 같은 규칙 ══ */
/* 시세가 해외 소스(stooq/yahoo/naver-world)로 넘어가면 그 출처만 보고 시장을 US 로 적었고,
   한 번 적히면 스스로 낫지 않아 원화 계좌의 국내 ETF 현재가가 계속 버려졌습니다. */
SNAPS=[];
loadState({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,
    h:[H('TIGER KRX금현물','411060','금',10,0)]}], fx:{usdkrw:1400} });
{
  const h = S.accounts[0].h[0];
  ok(codeMarketFixed('411060')==='KR', '6자리 숫자는 모양으로 KR 이 정해짐');
  /* 시세 반영 경로 그대로 — 출처가 해외라고 알려 와도 */
  setCodeMarket('411060', srcMarket('stooq','411060'));
  ok(marketOfCode('411060')==='KR',
     "출처가 'US' 라고 해도 대장은 KR (예전에는 US 로 덮였습니다) — 실제 " + marketOfCode('411060'));
  ok(holdPriceOk('KRW','411060')===true, '원화 계좌에 단가를 넣을 수 있음');
  ok(setHoldPrice(h, 15790, 'KRW', 'naver-basic')===true && h.p===15790,
     '현재가가 들어감 (예전에는 0 으로 버려졌습니다) — 실제 ' + h.p);
  ok(h.pe==='', '사유도 남지 않음 (' + JSON.stringify(h.pe) + ')');
  ok(codeFitsReb('411060')===true, '리밸런싱 원화 계획에서도 쓸 수 있음');
}
/* 이미 'US' 가 박힌 채 저장된 기기 — 불러올 때 스스로 고쳐집니다 */
SNAPS=[];
loadState({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,
    h:[H('TIGER KRX금현물','411060','금',10,0)]}],
  fx:{usdkrw:1400}, mkts:{ '411060':'US', 'KRX:005930':'US', 'KRW-BTC':'US', 'AAPL':'US' } });
{
  ok(S.mkts['411060']==='KR',
     '불러올 때 잘못 적힌 값이 고쳐짐 (예전에는 US 로 남아 계속 버렸습니다) — 실제 '
     + S.mkts['411060']);
  ok(S.mkts['KRX:005930']==='KR', '거래소를 밝힌 코드도 바로잡힘 (' + S.mkts['KRX:005930'] + ')');
  ok(S.mkts['KRW-BTC']==='CRYPTO', '업비트 원화 마켓도 바로잡힘 (' + S.mkts['KRW-BTC'] + ')');
  ok(S.mkts['AAPL']==='US', '모양으로 정해지지 않는 코드는 적힌 값을 그대로 둠 (' + S.mkts['AAPL'] + ')');
  const h = S.accounts[0].h[0];
  ok(setHoldPrice(h, 15790, 'KRW', 'naver-basic')===true && h.p===15790,
     '그 뒤 시세가 정상적으로 들어감 (' + h.p + ')');
}
/* 모양이 정해 주지 않는 코드는 출처가 근거입니다 — 코인 지갑에 BTC 라고 적는 사람도 있습니다 */
SNAPS=[];
loadState({ accounts:[{name:'업비트',cur:'KRW',grp:'가상자산',cash:0,h:[]}], fx:{usdkrw:1400} });
{
  setCodeMarket('BTC', srcMarket('upbit','KRW-BTC'));
  ok(marketOfCode('BTC')==='CRYPTO',
     '업비트에서 온 BTC 는 코인으로 (모양만 보면 US 로 보입니다) — 실제 ' + marketOfCode('BTC'));
  ok(holdPriceOk('KRW','BTC')===true, '원화 지갑에 단가를 넣을 수 있음');
  setCodeMarket('ZZTOP', srcMarket('yahoo','ZZTOP'));
  ok(marketOfCode('ZZTOP')==='US', '해외에서 온 알파벳 티커는 US (' + marketOfCode('ZZTOP') + ')');
}

/* ══ 코드 모양이 국내 6자리에서 벗어난 경우 — 무엇을 고쳐야 하는지 알려 줍니다 ══ */
/* 앱은 이런 코드를 미국 티커로 봅니다. 그 자체는 어쩔 수 없지만, "한국 종목인데 왜
   US 로 받아오나" 로만 보이지 않게 고칠 거리를 문장에 넣습니다. */
SNAPS=[];
loadState({ accounts:[{name:'토스',cur:'KRW',grp:'투자',cash:0,h:[]}], fx:{usdkrw:1400} });
{
  const why = c => { const h={n:'금',c,q:1,b:0,m:false,v:0,p:0,ps:'',pn:'',pe:''};
    setHoldPrice(h, 15790, 'KRW', 'naver-basic'); return h.pe; };
  ok(/411060/.test(why('A411060')),
     '증권사 표기(A411060)에는 6자리로 고치라고 알려 줌 — ' + why('A411060').slice(-40));
  /* .KS(코스피)·.KQ(코스닥)는 한국거래소를 밝힌 것이라 안내가 아니라 그냥 받습니다 —
     야후는 이 코드로 원화 시세를 돌려줍니다. */
  ok(why('411060.KS')==='' && holdPriceOk('KRW','411060.KS')===true,
     '야후식 접미사(411060.KS)는 국내로 알아보고 그대로 받음');
  ok(codeMarketFixed('411060.KQ')==='KR', '코스닥 접미사도 같음');
  ok(codeMarketFixed('BRK.B')==='' && holdPriceOk('USD','BRK.B')===true,
     '미국 클래스 주식(BRK.B)과 겹치지 않음');
  ok(/이름이 아니라 거래소 코드/.test(why('TIGER KRX금현물')),
     '이름을 코드칸에 넣은 경우에는 그것을 알려 줌');
  ok(codeHint('411060')==='' && codeHint('KRX:411060')==='' && codeHint('AAPL')==='',
     '제대로 된 코드에는 군더더기를 붙이지 않음');
  ok(!/6자리/.test(why('GLD')), '미국 티커(GLD)에는 국내 안내를 붙이지 않음');
}
`);
