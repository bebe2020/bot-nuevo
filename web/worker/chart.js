import {createChart,CandlestickSeries,LineSeries,HistogramSeries,ColorType,CrosshairMode,LineStyle} from '/vendor/lightweight-charts.js';
import {technicalSeries} from '/technicals.js';
import {endOfBar} from '/engine.js';
let chartSerial=0;
export class TerminalChart{
 constructor(container,onHover){
  this.host=container;this.series=new Map();this.priceLines=[];this.serial=++chartSerial;this.aux=['MACD','OBV'];
  this.chart=createChart(container,{autoSize:true,layout:{background:{type:ColorType.Solid,color:'#050a16'},textColor:'#b9cee9',fontSize:11,attributionLogo:true,panes:{separatorColor:'#263357',separatorHoverColor:'#00e5ff',enableResize:true}},grid:{vertLines:{color:'#13203b'},horzLines:{color:'#13203b'}},crosshair:{mode:CrosshairMode.Normal},rightPriceScale:{borderColor:'#375275'},timeScale:{timeVisible:true,secondsVisible:false,rightOffset:6,borderColor:'#375275'},localization:{locale:'es-AR'}});
  this.candles=this.chart.addSeries(CandlestickSeries,{upColor:'#00f5c4',downColor:'#ff3e85',borderVisible:false,wickUpColor:'#00f5c4',wickDownColor:'#ff3e85'});
  this.vol=this.chart.addSeries(HistogramSeries,{priceFormat:{type:'volume'},lastValueVisible:false,priceLineVisible:false},1);
  this.rsi=this.line('RSI14','#d6b6ff',2);this.line('RSI6','#ffe162',2);this.line('RSI12','#ff61ce',2);this.line('RSI24','#9f83ff',2);
  for(const price of [30,70])this.rsi.createPriceLine({price,color:'#655075',lineStyle:LineStyle.Dashed,axisLabelVisible:true,title:'RSI '+price});
  this.liveLine=this.candles.createPriceLine({price:1,color:'#00dcff',lineStyle:LineStyle.Dashed,lineWidth:1,axisLabelVisible:true,title:'Precio'});
  this.svg=document.createElementNS('http://www.w3.org/2000/svg','svg');this.svg.classList.add('chart-drawings');container.append(this.svg);
  this.drawings={};try{this.drawings=JSON.parse(localStorage.getItem('terminal54-drawings-v1')||'{}');}catch{}
  this.chart.subscribeCrosshairMove(param=>{const c=param.seriesData.get(this.candles),v=param.seriesData.get(this.rsi);if(c)onHover({...c,rsi:v?.value??null});});
  this.chart.subscribeClick(param=>this.drawingClick(param));
  this.chart.timeScale().subscribeVisibleLogicalRangeChange(()=>this.paintDrawings());
 }
 line(key,color,pane=0,extra={}){let s=this.series.get(key);if(!s){s=this.chart.addSeries(LineSeries,{color,lineWidth:1,priceLineVisible:false,lastValueVisible:false,title:key,...extra},pane);this.series.set(key,s);}return s;}
 values(key,values,bars,color,pane=0,visible=true,extra={}){const s=this.line(key,color,pane,extra);s.setData(values.flatMap((value,i)=>Number.isFinite(value)&&bars[i]?[{time:bars[i][0]/1000,value}]:[]));s.applyOptions({visible});return s;}
 setOscillator(slot,name){this.aux[slot]=name;if(this.bars)this.setData(this.bars,this.options);}
 oscillator(name,pane,ind,bars){
  const colors=['#00e7ff','#ff5dc6','#f5df56'],out=[];
  if(name==='MACD'){
   out.push(['DIF',ind.macd.dif],['DEA',ind.macd.dea]);let hist=this.series.get('MACDhist'+pane);
   if(!hist){hist=this.chart.addSeries(HistogramSeries,{priceLineVisible:false,lastValueVisible:false,title:'MACD'},pane);this.series.set('MACDhist'+pane,hist);}
   hist.setData(ind.macd.histogram.flatMap((v,i)=>Number.isFinite(v)?[{time:bars[i][0]/1000,value:v,color:v>=0?'#00a88e':'#cb3474'}]:[]));hist.applyOptions({visible:true});
  }else if(name==='OBV')out.push(['OBV',ind.obv],['MAOBV30',ind.obvMA]);
  else if(name==='KDJ')out.push(['K',ind.kdj.k],['D',ind.kdj.d],['J',ind.kdj.j]);
  else if(name==='STOCH_RSI')out.push(['StochRSI K',ind.stochRSI.k],['StochRSI D',ind.stochRSI.d]);
  else if(name==='DMI')out.push(['DI+',ind.dmi.plus],['DI-',ind.dmi.minus],['ADX',ind.dmi.adx]);
  else if(name==='DMA')out.push(['DMA',ind.dma.dif],['AMA10',ind.dma.signal]);
  else if(name==='MTM')out.push(['MTM12',ind.mtm.value],['MTM MA6',ind.mtm.signal]);
  else if(name==='EMV')out.push(['EMV14',ind.emv.value],['EMV MA9',ind.emv.signal]);
  else if(['MFI','ROC','CCI','WR'].includes(name))out.push([name,ind[name.toLowerCase()]]);
  out.forEach(([key,values],i)=>this.values('AUX'+pane+' '+key,values,bars,colors[i%colors.length],pane));
 }
 setData(bars,options={}){
  this.options=options;const {fib,profile,zones=[],gaps=[],layers={},tick=null,tf='15m',key='',forming=null,pivots=[]}=options;
  const changed=this.key!==key;this.key=key;this.tf=tf;this.bars=bars;this.fib=fib;this.forming=forming?forming.map(Number):null;
  const data=bars.map(r=>({time:r[0]/1000,open:r[1],high:r[2],low:r[3],close:r[4]}));
  if(tick>0)this.candles.applyOptions({priceFormat:{type:'price',precision:Math.min(12,Math.max(0,Math.ceil(-Math.log10(tick)))),minMove:tick}});
  this.candles.setData(data);const ind=technicalSeries(bars);this.ind=ind;
  this.vol.setData(bars.map(r=>({time:r[0]/1000,value:r[5],color:r[4]>=r[1]?'#00a58f':'#c13975'})));
  for(const [p,color]of [[14,'#d6b6ff'],[6,'#ffe162'],[12,'#ff61ce'],[24,'#9f83ff']])this.values('RSI'+p,ind.rsi[p],bars,color,2);
  const colors={5:'#e5ff66',9:'#00ffc3',10:'#ff61ce',20:'#9870ff',21:'#ffe267',50:'#52c5ff',100:'#f3a0ff',200:'#ff955d'};
  for(const p of [5,9,10,20,21,50,100,200])this.values('EMA'+p,ind.ema[p],bars,colors[p],0,!!layers['ema'+p]);
  for(const p of [5,10,20])this.values('MA'+p,ind.ma[p],bars,colors[p],0,!!layers.ma);
  this.values('BOLL20',ind.boll.middle,bars,'#ea5bd5',0,!!layers.boll);
  this.values('BOLL superior',ind.boll.upper,bars,'#f2d25d',0,!!layers.boll);
  this.values('BOLL inferior',ind.boll.lower,bars,'#ac6fff',0,!!layers.boll);
  this.values('VWAP UTC',ind.vwap,bars,'#ffab45',0,!!layers.vwap);
  this.values('SAR .02/.2',ind.sar,bars,'#00e7ff',0,!!layers.sar,{lineVisible:false,pointMarkersVisible:true,pointMarkersRadius:2});
  this.values('SuperTrend10×3',ind.supertrend,bars,'#45ffc0',0,!!layers.super);
  this.values('Tenkan9',ind.ichimoku.tenkan,bars,'#78bfff',0,!!layers.ichi);this.values('Kijun26',ind.ichimoku.kijun,bars,'#ffa25b',0,!!layers.ichi);
  for(const [name,values,color]of [['Senkou A',ind.ichimoku.spanA,'#43bba0'],['Senkou B',ind.ichimoku.spanB,'#c484b9']]){
   const shifted=values.flatMap((value,i)=>Number.isFinite(value)?[{time:this.timeAt(i+26)/1000,value}]:[]);const series=this.line(name,color);series.setData(shifted);series.applyOptions({visible:!!layers.ichi});
  }
  this.values('VOL MA5',ind.volMA5,bars,'#f3df5a',1,true);this.values('VOL MA10',ind.volMA10,bars,'#ff61ce',1,true);
  for(const [key,s]of this.series)if(key.startsWith('AUX')||key.startsWith('MACDhist')){s.setData([]);s.applyOptions({visible:false});}
  this.aux.forEach((name,i)=>this.oscillator(name,3+i,ind,bars));
  const heights=[350,70,100,95,95];this.chart.panes().forEach((p,i)=>p.setHeight(heights[i]||80));
  for(const line of this.priceLines)this.candles.removePriceLine(line);this.priceLines=[];
  const addLine=(price,title,color,style=LineStyle.Dashed)=>{if(price>0)this.priceLines.push(this.candles.createPriceLine({price,title,color,lineWidth:1,lineStyle:style,axisLabelVisible:true}));};
  if(layers.fib&&fib?.status==='OK')for(const l of fib.levels)if([0,.236,.382,.5,.618,.705,.786,1].includes(l.ratio))addLine(l.price,'Fib '+l.ratio,'#bb87ff');
  if(layers.vp&&profile?.poc){addLine(profile.poc,'POC ≈','#ffe56b',LineStyle.Solid);addLine(profile.val,'VAL ≈','#c4a15d');addLine(profile.vah,'VAH ≈','#c4a15d');}
  if(layers.zones)for(const z of zones.filter(x=>x.state!=='INVALIDATED').slice(-2)){addLine(z.low,'OB '+z.side,'#52beff');addLine(z.high,'OB '+z.side,'#52beff');}
  if(layers.fvg)for(const g of gaps.slice(-2)){addLine(g.low,'FVG '+g.side,'#7887ef');addLine(g.high,'FVG '+g.side,'#7887ef');}
  if(layers.resist)for(const kind of ['HIGH','LOW']){const p=pivots.filter(x=>x.type===kind).at(-1);if(p)addLine(p.price,kind==='HIGH'?'Resistencia 2+2':'Soporte 2+2',kind==='HIGH'?'#ff688e':'#45e9c1');}
  this.host.dataset.candles=String(bars.length);this.host.dataset.indicatorSeries=String(this.series.size);this.host.dataset.fibLevels=String(layers.fib&&fib?.status==='OK'?8:0);
  if(changed&&bars.length)this.chart.timeScale().setVisibleLogicalRange({from:Math.max(0,bars.length-85),to:bars.length+5});
  this.resize();return ind;
 }
 timeAt(i){if(!this.bars.length)return 0;if(i<this.bars.length)return this.bars[i][0];let ts=this.bars.at(-1)[0];for(let j=this.bars.length-1;j<i;j++)ts=endOfBar(ts,this.tf);return ts;}
 startDrawing(type){if(!['TREND','EXTENDED','HORIZONTAL','VERTICAL','RAY','CHANNEL','FIB','WAVE3','WAVE5'].includes(type))return;this.drawingType=type;this.pending=[];this.host.style.cursor='crosshair';}
 drawingClick(param){
  if(!this.drawingType||!param.point||!param.time||param.paneIndex>0)return;
  const price=this.candles.coordinateToPrice(param.point.y),time=Number(param.time);if(!Number.isFinite(price)||!Number.isFinite(time)||price<=0)return;
  this.pending.push({time,price});const required=['HORIZONTAL','VERTICAL'].includes(this.drawingType)?1:this.drawingType==='CHANNEL'?3:this.drawingType==='WAVE3'?4:this.drawingType==='WAVE5'?6:2;
  if(this.pending.length<required)return;
  const item={type:this.drawingType,points:this.pending,created:Date.now()};(this.drawings[this.key]??=[]).push(item);this.drawingType=null;this.pending=[];this.host.style.cursor='';
  try{localStorage.setItem('terminal54-drawings-v1',JSON.stringify(this.drawings));}catch{}
  this.paintDrawings();
 }
 clearDrawings(){delete this.drawings[this.key];try{localStorage.setItem('terminal54-drawings-v1',JSON.stringify(this.drawings));}catch{}this.paintDrawings();}
 paintDrawings(){
  const width=this.host.clientWidth,height=this.chart.panes()[0]?.getHeight()||350;if(!width)return;this.svg.setAttribute('viewBox',`0 0 ${width} ${this.host.clientHeight}`);
  const px=p=>({x:this.chart.timeScale().timeToCoordinate(p.time),y:this.candles.priceToCoordinate(p.price)}),line=(a,b,color='#00f5e1',dashed=false)=>`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="1.5" ${dashed?'stroke-dasharray="5 4"':''}/>`;
  let out=`<defs><clipPath id="clip${this.serial}"><rect width="${Math.max(0,width-60)}" height="${height}"/></clipPath></defs><g clip-path="url(#clip${this.serial})">`;
  const fib=this.fib;if(this.options?.layers?.fib&&fib?.status==='OK'){
   const a=this.candles.priceToCoordinate(fib.ote[0]),b=this.candles.priceToCoordinate(fib.ote[1]);if(a!==null&&b!==null)out+=`<rect x="0" y="${Math.min(a,b)}" width="${width-60}" height="${Math.abs(a-b)}" fill="#a364ef" opacity=".10"/>`;
  }
  for(const item of this.drawings[this.key]||[]){const points=item.points.map(px);if(points.some(p=>p.x===null||p.y===null))continue;const [a,b,c]=points;
   if(item.type==='HORIZONTAL')out+=line({x:0,y:a.y},{x:width,y:a.y});
   else if(item.type==='VERTICAL')out+=line({x:a.x,y:0},{x:a.x,y:height});
   else if(item.type==='EXTENDED'&&b.x!==a.x){const slope=(b.y-a.y)/(b.x-a.x);out+=line({x:0,y:a.y-slope*a.x},{x:width,y:a.y+slope*(width-a.x)});}
   else if(item.type==='FIB'){
    out+=`<rect x="${Math.min(a.x,b.x)}" y="${Math.min(a.y,b.y)}" width="${Math.abs(a.x-b.x)}" height="${Math.abs(a.y-b.y)}" fill="#00e9ef" opacity=".13"/>`;
    for(const r of [0,.236,.382,.5,.618,.705,.786,1]){const y=a.y+(b.y-a.y)*r,p=item.points[0].price+(item.points[1].price-item.points[0].price)*r;out+=line({x:a.x,y},{x:b.x,y},'#00e9ef')+`<text x="${Math.min(a.x,b.x)+4}" y="${y-4}" fill="#62f4f3" font-size="10">${r} · ${p.toPrecision(6)}</text>`;}
   }else{for(let i=1;i<(item.type==='CHANNEL'?2:points.length);i++)out+=line(points[i-1],points[i]);if(item.type==='RAY'&&b.x!==a.x)out+=line(b,{x:width,y:b.y+(b.y-a.y)/(b.x-a.x)*(width-b.x)},'#00f5e1',true);if(item.type==='CHANNEL')out+=line(c,{x:c.x+b.x-a.x,y:c.y+b.y-a.y},'#ff68d1');}
  }
  this.svg.innerHTML=out+'</g>';
 }
 quote(q){if(!q||!this.bars?.length)return;this.liveLine.applyOptions({price:q.price,title:q.source==='WS'?'Vivo':'REST',color:'#00dcff'});if(this.forming&&q.ts>=this.forming[0]&&q.ts<endOfBar(this.forming[0],this.tf)){this.forming[2]=Math.max(this.forming[2],q.price);this.forming[3]=Math.min(this.forming[3],q.price);this.forming[4]=q.price;this.candles.update({time:this.forming[0]/1000,open:this.forming[1],high:this.forming[2],low:this.forming[3],close:q.price});this.host.dataset.openCandle='PROVISIONAL_EXCLUDED_FROM_SIGNALS';}this.host.dataset.livePrice=String(q.price);this.host.dataset.liveAsOf=String(q.ts);}
 fit(){this.chart.timeScale().fitContent();this.paintDrawings();}
 resize(){this.chart.applyOptions({width:this.host.clientWidth,height:this.host.clientHeight||700});requestAnimationFrame(()=>this.paintDrawings());}
 destroy(){this.chart.remove();this.svg.remove();}
}
