import { fact, fredCSV, netLiquidity } from './engine.js';

export const CONTEXT_SOURCES = {
  WALCL: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=WALCL',
  WTREGEN: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=WTREGEN',
  RRPONTSYD: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=RRPONTSYD',
  calendar: 'https://www.bls.gov/schedule/news_release/bls.ics',
  news: 'https://www.federalreserve.gov/feeds/press_monetary.xml',
  releases: 'https://www.bls.gov/feed/bls_latest.rss'
};

function plainText(text) {
  return String(text).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, x) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[x]).replace(/\s+/g, ' ').trim();
}

export function parseNews(text, now = Date.now()) {
  if (!/<rss\b|<feed\b/i.test(text)) throw Error('FEED_NOTICIAS_INVALIDO');
  const items = [...text.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].flatMap(([, item]) => {
    const get = tag => plainText(item.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'))?.[1] || '');
    const title = get('title'), link = get('link'), published = Date.parse(get('pubDate'));
    if (!title || !Number.isFinite(published) || published > now + 300000 || !/^https:\/\/(www\.)?(federalreserve|bls)\.gov\//.test(link)) return [];
    return [{ title, link, published, summary:get('description').slice(0,700), source:link.includes('bls.gov')?'BLS':'Federal Reserve' }];
  }).sort((a, b) => b.published - a.published).slice(0, 8);
  if (!items.length) throw Error('SIN_NOTICIAS_FECHADAS_VALIDAS');
  return items;
}

function calendarTime(value, zone) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, minute, second, utc] = match;
  const wall = Date.UTC(+y, +m - 1, +d, +h, +minute, +second);
  if (utc) return wall;
  if (!['US-Eastern', 'US/Eastern', 'America/New_York'].includes(zone)) return null;
  const fmt = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let stamp = wall;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(stamp).map(x => [x.type, x.value]));
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    stamp += wall - represented;
  }
  return stamp;
}

export function parseCalendar(text, now = Date.now()) {
  if (!text.includes('BEGIN:VCALENDAR')) throw Error('CALENDARIO_ICAL_INVALIDO');
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const items = [...unfolded.matchAll(/BEGIN:VEVENT\s*([\s\S]*?)END:VEVENT/g)].flatMap(([, block]) => {
    const fields = Object.fromEntries(block.split(/\r?\n/).map(line => {const colon=line.indexOf(':');return colon<0?['','']:[line.slice(0,colon),line.slice(colon+1)];}));
    const startKey = Object.keys(fields).find(k => k === 'DTSTART' || k.startsWith('DTSTART;'));
    const zone = startKey?.match(/TZID=([^;]+)/)?.[1];
    const startsAt = calendarTime(fields[startKey] || '', zone);
    const title = (fields.SUMMARY || '').replace(/\\[nN]/g, ' ').replace(/\\([,;\\])/g, '$1');
    if (!title || startsAt === null || startsAt < now - 3600000 || startsAt > now + 120 * 86400000 || fields.STATUS === 'CANCELLED') return [];
    return [{ id: fields.UID || String(startsAt) + title, title, startsAt, source: 'BLS', sourceTimezone: zone || 'UTC',
      link: /^https:\/\/(www\.)?bls\.gov\//.test(fields.URL || '') ? fields.URL : 'https://www.bls.gov/schedule/' }];
  }).sort((a,b) => a.startsAt - b.startsAt);
  return [...new Map(items.map(x => [x.id, x])).values()].slice(0, 24);
}

export function fedContext(series, now = Date.now()) {
  const result = netLiquidity(series, now);
  result.sources = Object.keys(series).map(id => ({id, url:CONTEXT_SOURCES[id], observations:series[id].length,
    latestDate:series[id].at(-1)?.date || null, latestValue:series[id].at(-1)?.value ?? null,
    unit:id==='RRPONTSYD'?'miles de millones USD':'millones USD'}));
  if (!result.value) return result;
  const date = result.value.date, at = id => series[id].find(x => x.date === date)?.value;
  result.value.components = {WALCL:at('WALCL')/1000,WTREGEN:at('WTREGEN')/1000,RRPONTSYD:at('RRPONTSYD')};
  const older = Object.fromEntries(Object.entries(series).map(([id, rows]) => [id, rows.filter(x => x.date < date)]));
  const prior = netLiquidity(older, now);
  result.value.previousDate = prior.value?.date || null;
  result.value.changeBillions = prior.value ? result.value.usdBillions - prior.value.usdBillions : null;
  return result;
}

let contextInFlight = null;
export const CONTEXT_MIRROR='https://raw.githubusercontent.com/bebe2020/bot-nuevo/market-data/context.json';
const CONTEXT_CAPTURE='__BUILD_PUBLIC_CONTEXT_CAPTURE__';
export function validateContextMirror(value,now=Date.now()){
 const received=x=>Number.isFinite(x?.received)&&x.received<=now+30000&&x.received>0;
 const status=x=>now-x.received>10800000?'STALE':x.status;
 const result={};
 const m=value?.macro;
 if(received(m)&&Number.isFinite(m.value?.usdBillions)&&m.value.scope==='PROXY_USD_FED; NO_LIQUIDEZ_GLOBAL'&&/^\d{4}-\d{2}-\d{2}$/.test(m.value.date)&&Date.parse(m.value.date)<=now){
  result.macro={...m,status:now-Date.parse(m.value.date)>10*86400000?'STALE':status(m),transport:'RESPALDO_PUBLICO_GITHUB'};
 }
 for(const id of ['calendar','news']){
  const source=value?.[id];if(!received(source)||!Array.isArray(source.items))continue;
  const items=source.items.filter(x=>typeof x.title==='string'&&typeof x.link==='string'&&/^https:\/\/(www\.)?(bls|federalreserve)\.gov\//.test(x.link)&&(id==='calendar'?Number.isFinite(x.startsAt)&&x.startsAt>=now-3600000:Number.isFinite(x.published)&&x.published<=now+30000)).slice(0,24);
  if(items.length)result[id]={...source,items,status:status(source),transport:'RESPALDO_PUBLICO_GITHUB'};
 }
 return result;
}
async function readContextSources(bucket, fetcher, now) {
  const oldObject = await bucket?.get('context/latest.json');
  const old = oldObject ? await oldObject.json() : null;
  if (old?.nextCheck > now&&(old.macro?.value||old.calendar?.items?.length||old.news?.items?.length)) return old;
  const read = async url => {
    const response = await fetcher(url, {signal:AbortSignal.timeout(12000),headers:{Accept:'text/csv, application/rss+xml, text/calendar, text/xml'}});
    if (!response.ok) throw Error('HTTP_' + response.status);
    const text = await response.text();
    if (text.length > 2000000) throw Error('FUENTE_DEMASIADO_GRANDE');
    return text;
  };
  const errors = [], series = {};
  const tasks = Object.keys(CONTEXT_SOURCES).map(async id => {
    try {
      const text = await read(CONTEXT_SOURCES[id] + (['WALCL','WTREGEN','RRPONTSYD'].includes(id) ? '&cosd=' + new Date(now-90*86400000).toISOString().slice(0,10) : ''));
      if (['WALCL','WTREGEN','RRPONTSYD'].includes(id)) {series[id] = fredCSV(text,id);return [id,null];}
      const items = id === 'calendar' ? parseCalendar(text,now) : parseNews(text,now);
      return [id,{status:'OK',items,received:now,source:CONTEXT_SOURCES[id]}];
    } catch (e) {
      errors.push(id + ': ' + e.message);
      const prior = old?.[id];
      return [id,prior?.received ? {...prior,status:'STALE',error:e.message} : {status:'UNKNOWN',items:[],received:null,source:CONTEXT_SOURCES[id],error:e.message}];
    }
  });
  const loaded = Object.fromEntries(await Promise.all(tasks));
  let macro = fedContext(series, now);
  if (macro.value) macro = {...macro,received:now};
  else if (old?.macro?.value) macro = {...old.macro,status:'STALE',error:macro.reason};
  else macro = {...macro,received:null};
  const combinedNews=[...loaded.news.items,...loaded.releases.items].sort((a,b)=>b.published-a.published).slice(0,8);
  const news={status:combinedNews.length?(loaded.news.status==='OK'&&loaded.releases.status==='OK'?'OK':'PARTIAL'):'UNKNOWN',items:combinedNews,
    received:Math.max(loaded.news.received||0,loaded.releases.received||0)||null,sources:[loaded.news,loaded.releases].map(({items,...source})=>source)};
  const value = {macro,calendar:loaded.calendar,news,releases:loaded.releases,checkedAt:now,errors,nextCheck:now+(errors.length?300000:3600000)};
  if(errors.length){
   try{
    const response=await fetcher(CONTEXT_MIRROR+'?slot='+Math.floor(now/300000),{signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
    if(response.ok){const text=await response.text();if(text.length<2000000){const mirror=validateContextMirror(JSON.parse(text),now);for(const id of ['macro','calendar','news'])if(mirror[id]&&(!value[id]?.received||value[id].status==='UNKNOWN'||value[id].status==='STALE'&&mirror[id].received>value[id].received))value[id]=mirror[id];}}
   }catch{}
   if(typeof CONTEXT_CAPTURE==='object'){
    const capture=validateContextMirror(CONTEXT_CAPTURE,now);
    for(const id of ['macro','calendar','news'])if(capture[id]&&(!value[id]?.received||value[id].status==='UNKNOWN'||value[id].status==='STALE'&&capture[id].received>value[id].received))value[id]={...capture[id],transport:'CAPTURA_OFICIAL_FECHADA'};
   }
  }
  if (bucket) await bucket.put('context/latest.json',JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
  return value;
}

export function publicContext(bucket, fetcher = fetch, now = Date.now()) {
  if (fetcher !== fetch) return readContextSources(bucket,fetcher,now);
  if (!contextInFlight) contextInFlight = readContextSources(bucket,fetcher,now).finally(() => {contextInFlight=null;});
  return contextInFlight;
}
