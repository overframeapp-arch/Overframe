/**
 * Custom scrollbar injected into every WebContentsView.
 *
 * - CSS hides the native scrollbar without reserving any layout width.
 * - JS draws a fixed-position rail/thumb/arrows overlay; window hover reveals
 *   a thin thumb, rail hover reveals the full track. Background lightness is
 *   sampled to switch between dark and light palettes automatically.
 */

export const SCROLLBAR_CSS = `
html { scrollbar-width: none !important; }
html::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
`

export const SCROLLBAR_JS = `(function(){
  if(document.getElementById('__of_sb'))return;
  function bgLum(){
    function lum(c){
      const m=c.match(/[\\d.]+/g);if(!m||m.length<3)return null;
      const a=m[3]!==undefined?+m[3]:1;if(a<0.1)return null;
      return(0.299*(+m[0])+0.587*(+m[1])+0.114*(+m[2]))/255;
    }
    const l=lum(getComputedStyle(document.documentElement).backgroundColor);
    if(l!==null)return l;
    const lb=lum(getComputedStyle(document.body||document.documentElement).backgroundColor);
    return lb!==null?lb:1;
  }
  function isDark(){return bgLum()<0.5;}
  function colors(){
    const d=isDark();
    return{
      track:   d?'#16171a':'#e9e8e5',
      thumb:   d?'#8e8e91':'#787571',
      thumbHov:d?'#b4b4b7':'#4e4c4a',
      arrow:   d?'#8e8e91':'#787571',
    };
  }
  const rail=document.createElement('div');
  rail.id='__of_sb';
  rail.style.cssText='position:fixed;top:0;right:0;bottom:0;width:12px;z-index:2147483647;pointer-events:auto;background:transparent;transition:background .15s;';
  function mkArrow(up){
    const b=document.createElement('div');
    b.style.cssText='position:absolute;'+(up?'top:0':'bottom:0')+';left:0;right:0;height:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .15s;font-size:8px;user-select:none;';
    b.innerHTML=up?'\u25B2':'\u25BC';
    b.addEventListener('mousedown',(e)=>{
      e.preventDefault();
      let active=true;
      const dir=up?-1:1;
      let speed=0;
      function step(){
        if(!active)return;
        speed=Math.min(speed+1.5,24);
        window.scrollBy({top:dir*speed,behavior:'instant'});
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      document.addEventListener('mouseup',()=>{active=false;},{once:true});
    });
    return b;
  }
  const arrowUp=mkArrow(true);
  const arrowDn=mkArrow(false);
  rail.appendChild(arrowUp);
  rail.appendChild(arrowDn);
  const thumb=document.createElement('div');
  thumb.style.cssText='position:absolute;right:2px;border-radius:99px;min-height:20px;width:2px;opacity:0;transition:width .12s,right .12s,left .12s,transform .12s,opacity .2s,background .15s;';
  rail.appendChild(thumb);
  document.documentElement.appendChild(rail);
  let h,winHovered=false,railHovered=false;
  thumb.addEventListener('mousedown',(e)=>{
    e.preventDefault();e.stopPropagation();
    const startY=e.clientY;
    const d=document.documentElement,b=document.body;
    const sh=Math.max(d.scrollHeight,b?b.scrollHeight:0);
    const ch=d.clientHeight;
    const sc=sh-ch;
    const trackH=ch-32;
    const startScroll=Math.max(d.scrollTop,b?b.scrollTop:0);
    const onMove=(ev)=>{
      const dy=ev.clientY-startY;
      const ratio=sc/(trackH-Math.max(20,trackH*(ch/sh)));
      window.scrollTo(0,Math.max(0,Math.min(sc,startScroll+dy*ratio)));
    };
    const onUp=()=>{
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
    };
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp,{once:true});
  });
  rail.addEventListener('mousedown',(e)=>{
    if(e.target!==rail)return;
    e.preventDefault();
    const d=document.documentElement,b=document.body;
    const sh=Math.max(d.scrollHeight,b?b.scrollHeight:0);
    const ch=d.clientHeight;const sc=sh-ch;
    const trackH=ch-32;
    const y=e.clientY-16;
    const ratio=sc/(trackH-Math.max(20,trackH*(ch/sh)));
    window.scrollTo(0,Math.max(0,Math.min(sc,y*ratio)));
  });
  function applyColors(){
    const c=colors();
    thumb.style.background=railHovered?c.thumbHov:c.thumb;
    arrowUp.style.color=arrowDn.style.color=c.arrow;
    rail.style.background=railHovered?c.track:'transparent';
  }
  function upd(){
    const d=document.documentElement,b=document.body;
    const st=Math.max(d.scrollTop,b?b.scrollTop:0);
    const sh=Math.max(d.scrollHeight,b?b.scrollHeight:0);
    const ch=d.clientHeight;const sc=sh-ch;
    if(sc<2){thumb.style.opacity='0';return;}
    const trackH=ch-32;
    const th=Math.max(20,trackH*(ch/sh));
    thumb.style.height=th+'px';
    thumb.style.top=(16+st/sc*(trackH-th))+'px';
    if(winHovered||railHovered){
      thumb.style.opacity=railHovered?'1':'0.75';
      if(!railHovered){clearTimeout(h);h=setTimeout(()=>{if(!railHovered&&!winHovered)thumb.style.opacity='0';},1600);}
    }
  }
  document.addEventListener('mouseenter',()=>{winHovered=true;applyColors();upd();},{capture:true,passive:true});
  document.addEventListener('mouseleave',()=>{winHovered=false;if(!railHovered){clearTimeout(h);h=setTimeout(()=>{if(!railHovered)thumb.style.opacity='0';},400);}},{capture:true,passive:true});
  rail.addEventListener('mouseenter',()=>{
    railHovered=true;clearTimeout(h);applyColors();
    thumb.style.width='5px';
    thumb.style.left='50%';
    thumb.style.transform='translateX(-50%)';
    thumb.style.right='';
    arrowUp.style.opacity='1';arrowDn.style.opacity='1';
    upd();
  });
  rail.addEventListener('mouseleave',()=>{
    railHovered=false;applyColors();
    thumb.style.width='2px';
    thumb.style.left='';
    thumb.style.transform='';
    thumb.style.right='2px';
    arrowUp.style.opacity='0';arrowDn.style.opacity='0';
    clearTimeout(h);h=setTimeout(()=>{if(!railHovered&&!winHovered)thumb.style.opacity='0';},1600);
  });
  document.addEventListener('scroll',upd,{passive:true,capture:true});
  window.addEventListener('resize',upd,{passive:true});
  setTimeout(applyColors,500);setTimeout(applyColors,2500);
  upd();
})();`
