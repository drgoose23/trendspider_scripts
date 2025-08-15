describe_indicator('RSI Divergences #TSBuild25', 'lower', {
  decimals: 2,
  shortName: 'RSI Divs'
});

/* ===================== Inputs ===================== */
const rsiLen      = input('RSI Period', 14, { min: 1, step: 1 });
const srcName     = input('RSI Source', 'close', ['close','hlc3','ohlc4','typical','weighted'], { display:'data_window' });
const lbL         = input('Pivot Lookback Left', 7,  { min: 1, step: 1, display:'data_window' });
const lbR         = input('Pivot Lookback Right', 7, { min: 1, step: 1, display:'data_window' });
const rangeUpper  = input('Max of Lookback Range', 60, { min: 2, step: 1, display:'data_window' });
const rangeLower  = input('Min of Lookback Range', 5,  { min: 1, step: 1, display:'data_window' });

const signalMode  = input('Signals', 'Regular Only', ['Regular Only','Hidden Only','All','None'], { display:'data_window' });

const showLines   = input.boolean('Show Divergence Lines', true,  { display:'data_window' });
// ADDED: Input to toggle forming divergences
const showForming = input.boolean('Show Forming?', true, { display:'data_window' });
const showMarks   = input.boolean('Show Pivot Markers',   true,  { display:'data_window' });
const lineWidth   = input('Line Width', 2, { min: 1, max: 4, display:'data_window' });

/* ===================== Colors ===================== */
const colRSI   = '#FFA500';
const colGuide = '#787B86';
const colBull  = '#00C27A';   
const colBear  = '#E05A5A';   
const colHBull = '#61D8A6';   
const colHBear = '#F08C8C';

/* ===================== Helpers ===================== */
function series_const(v){ const s=series_of(null); for(let i=0;i<time.length;i++) s[i]=v; return s; }
function pick_source(name){
  const out=series_of(null);
  for(let i=0;i<time.length;i++){
    const c=close[i],h=high[i],l=low[i],o=open[i];
    if(name==='hlc3' || name==='typical') out[i]=(h+l+c)/3;
    else if(name==='ohlc4')               out[i]=(o+h+l+c)/4;
    else if(name==='weighted')            out[i]=(o+2*c+h+l)/5;
    else out[i]=c;
  }
  return out;
}
function calc_rsi(src, L){
  const out=series_of(null); let g=0,l=0;
  for(let i=1;i<src.length;i++){
    const d=(src[i]!=null && src[i-1]!=null)?(src[i]-src[i-1]):0;
    const up=Math.max(d,0), dn=Math.max(-d,0);
    if(i<L){ g+=up; l+=dn; out[i]=null; }
    else if(i===L){ g=(g+up)/L; l=(l+dn)/L; const rs=l===0?Infinity:g/l; out[i]=100-100/(1+rs); }
    else { g=(g*(L-1)+up)/L; l=(l*(L-1)+dn)/L; const rs=l===0?Infinity:g/l; out[i]=100-100/(1+rs); }
  }
  return out;
}
function is_pivot_low(s,i,L,R){ if(i-L<0||i+R>=s.length) return false; const v=s[i]; if(v==null) return false;
  for(let k=i-L;k<=i+R;k++){ const vk=s[k]; if(vk==null) return false; if(vk < v) return false; } return true; }
function is_pivot_high(s,i,L,R){ if(i-L<0||i+R>=s.length) return false; const v=s[i]; if(v==null) return false;
  for(let k=i-L;k<=i+R;k++){ const vk=s[k]; if(vk==null) return false; if(vk > v) return false; } return true; }
function draw_segment(target,i0,i1,v0,v1){ if(i1<=i0) return; for(let j=i0;j<=i1;j++){ const t=(j-i0)/(i1-i0); target[j]=v0+t*(v1-v0);} }
// ADDED: Helper for dotted lines
function draw_segment_dotted(target,i0,i1,v0,v1){
  if(i1<=i0) return; const span=i1-i0;
  for(let j=i0;j<=i1;j++){ const t=(j-i0)/span; const on=((j-i0)%4)<2; target[j]=on?(v0+t*(v1-v0)):null; }
}

/* ===================== Core ===================== */
const src = pick_source(srcName);
const rsiS = calc_rsi(src, rsiLen);

const bullRegLine=series_of(null), bearRegLine=series_of(null);
const bullHidLine=series_of(null), bearHidLine=series_of(null);
const bullMark=series_of(null),   bearMark=series_of(null);
const hBullMark=series_of(null),  hBearMark=series_of(null);
const bullFormLine=series_of(null), bearFormLine=series_of(null);

let lastPL=null, lastPH=null;

const wantReg   = (signalMode==='Regular Only' || signalMode==='All');
const wantHidden= (signalMode==='Hidden Only'  || signalMode==='All');

for(let i=0;i<time.length;i++){
  const p=i-lbR; if(p<0) continue;

  const pl=is_pivot_low(rsiS,p,lbL,lbR);
  const ph=is_pivot_high(rsiS,p,lbL,lbR);

  if(pl){
    if(lastPL){
      const bars=p-lastPL.idx;
      if(bars>=rangeLower && bars<=rangeUpper){
        const rsiHL=rsiS[p] > lastPL.rsi, rsiLL=rsiS[p] < lastPL.rsi;
        const priceLL=low[p] < lastPL.price, priceHL=low[p] > lastPL.price;

        if(wantReg && priceLL && rsiHL){
          if(showLines) draw_segment(bullRegLine,lastPL.idx,p,lastPL.rsi,rsiS[p]);
          if(showMarks) bullMark[p]=rsiS[p];
        }
        if(wantHidden && priceHL && rsiLL){
          if(showLines) draw_segment(bullHidLine,lastPL.idx,p,lastPL.rsi,rsiS[p]);
          if(showMarks) hBullMark[p]=rsiS[p];
        }
      }
    }
    lastPL={ idx:p, rsi:rsiS[p], price:low[p] };
  }

  if(ph){
    if(lastPH){
      const bars=p-lastPH.idx;
      if(bars>=rangeLower && bars<=rangeUpper){
        const rsiLH=rsiS[p] < lastPH.rsi, rsiHH=rsiS[p] > lastPH.rsi;
        const priceHH=high[p] > lastPH.price, priceLH=high[p] < lastPH.price;

        if(wantReg && priceHH && rsiLH){
          if(showLines) draw_segment(bearRegLine,lastPH.idx,p,lastPH.rsi,rsiS[p]);
          if(showMarks) bearMark[p]=rsiS[p];
        }
        if(wantHidden && priceLH && rsiHH){
          if(showLines) draw_segment(bearHidLine,lastPH.idx,p,lastPH.rsi,rsiS[p]);
          if(showMarks) hBearMark[p]=rsiS[p];
        }
      }
    }
    lastPH={ idx:p, rsi:rsiS[p], price:high[p] };
  }
}

if (showForming && (wantReg || wantHidden)) {
    const iLast = time.length - 1;
    const rsiNow = rsiS[iLast];

    if (rsiNow != null) {
        if (lastPL && iLast > lastPL.idx) {
            const lowNow = low[iLast];
            const regularCond = wantReg && (lowNow < lastPL.price) && (rsiNow > lastPL.rsi);
            const hiddenCond = wantHidden && (lowNow > lastPL.price) && (rsiNow < lastPL.rsi);
            if (regularCond || hiddenCond) {
                draw_segment_dotted(bullFormLine, lastPL.idx, iLast, lastPL.rsi, rsiNow);
            }
        }
        if (lastPH && iLast > lastPH.idx) {
            const highNow = high[iLast];
            const regularCond = wantReg && (highNow > lastPH.price) && (rsiNow < lastPH.rsi);
            const hiddenCond = wantHidden && (highNow < lastPH.price) && (rsiNow > lastPH.rsi);
            if (regularCond || hiddenCond) {
                draw_segment_dotted(bearFormLine, lastPH.idx, iLast, lastPH.rsi, rsiNow);
            }
        }
    }
}

paint(series_const(50), { name:'', color:colGuide, style:'line', thickness:1, opacity:40 });
paint(series_const(70), { name:'', color:colGuide, style:'line', thickness:1, opacity:25 });
paint(series_const(30), { name:'', color:colGuide, style:'line', thickness:1, opacity:25 });
paint(rsiS, { name:'RSI', color:colRSI, style:'line', thickness:2 });

paint(showLines && wantReg ? bullRegLine : series_of(null),{ name:'', color:colBull,  style:'line', thickness:lineWidth, opacity:80 });
paint(showLines && wantReg ? bearRegLine : series_of(null),{ name:'', color:colBear,  style:'line', thickness:lineWidth, opacity:80 });
paint(showLines && wantHidden ? bullHidLine : series_of(null),{ name:'', color:colHBull, style:'line', thickness:lineWidth, opacity:50 });
paint(showLines && wantHidden ? bearHidLine : series_of(null),{ name:'', color:colHBear, style:'line', thickness:lineWidth, opacity:50 });

if (showForming) {
    paint(bullFormLine, { name:'', color:colBull, style:'line', thickness:lineWidth, opacity:65 });
    paint(bearFormLine, { name:'', color:colBear, style:'line', thickness:lineWidth, opacity:65 });
}
