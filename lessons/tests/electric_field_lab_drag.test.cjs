const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../electric_field_lab.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

// Run the page's real handlers with deterministic layout and pointer capture.
function openLab(compact){
 const width=compact?390:1000,height=700,top=90;
 const elements=new Map(),windowListeners=new Map();
 function event(type,target,values={}){
  return {type,target,button:0,buttons:type==='pointerup'||type==='pointercancel'?0:1,pointerId:1,pointerType:'mouse',detail:1,
   defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},
   stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediateStopped=true;},...values};
 }
 function runWindow(e,capture){
  for(const listener of windowListeners.get(e.type)||[]){
   if(listener.capture!==capture)continue;
   listener.handler(e);if(e.immediateStopped)break;
  }
 }
 function emitWindow(type,values={}){
  const e=event(type,null,values);runWindow(e,true);if(!e.stopped)runWindow(e,false);return e;
 }
 function element(id=''){
  const classes=new Set(),listeners=new Map(),children=new Map(),capture=new Set();
  return {id,hidden:id==='controlsBackdrop',dataset:{},style:{setProperty(){}},clientHeight:0,
   rect:{left:0,top:0,right:0,bottom:0,width:0,height:0},
   classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle(c,on){if(on===undefined)on=!classes.has(c);on?classes.add(c):classes.delete(c);},contains:c=>classes.has(c)},
   getBoundingClientRect(){return this.rect;},getClientRects(){return this.hidden?[]:[this.rect];},
   getContext(){return context;},setAttribute(){},focus(){},contains(){return false;},append(){},replaceChildren(){},
   querySelector(selector){if(selector==='.selected')return null;if(!children.has(selector))children.set(selector,element());return children.get(selector);},
   addEventListener(type,handler){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(handler);},
   emit(type,values={}){
    const e=event(type,this,values);runWindow(e,true);
    if(!e.stopped){for(const handler of listeners.get(type)||[]){handler(e);if(e.immediateStopped)break;}
     if(!e.immediateStopped&&this['on'+type])this['on'+type](e);}
    if(!e.stopped)runWindow(e,false);return e;
   },
   setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),
   releasePointerCapture(id){capture.delete(id);this.emit('lostpointercapture',{pointerId:id});}
  };
 }
 const context=new Proxy({}, {get:(_,key)=>key==='createRadialGradient'||key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});
 function $(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id);}
 function rect(id,left,y,w,h){$(id).rect={left,top:y,right:left+w,bottom:y+h,width:w,height:h};}
 rect('lab',0,top,width,height);rect('fieldCanvas',0,top,width,height);
 rect('controlsPanel',width-292,top,292,height);rect('controlsBackdrop',0,top,width,height);
 rect('chargeTray',18,top+height-100,253,82);rect('addPositive',31,top+height-87,64,56);
 rect('addNegative',105,top+height-87,64,56);rect('trashZone',182,top+height-87,76,56);
 rect('zoom',width-410,top+height-60,100,32);$('modeMessage').hidden=true;
 const document={getElementById:$,createElement:()=>element(),querySelector:selector=>selector==='.zoom'?$('zoom'):null,querySelectorAll:()=>[],
  elementFromPoint(){throw Error('Drop validation must not depend on the preview being absent from hit testing');}};
 const sandbox={document,window:{matchMedia:()=>({matches:compact,addEventListener(){}}),devicePixelRatio:1,
  addEventListener(type,handler,options){if(!windowListeners.has(type))windowListeners.set(type,[]);windowListeners.get(type).push({handler,capture:options===true||!!options?.capture});}},ResizeObserver:class{observe(){}},
  requestAnimationFrame(){},getComputedStyle:()=>({visibility:'visible'}),HTMLInputElement:class{},HTMLTextAreaElement:class{}};
 vm.createContext(sandbox);
 vm.runInContext(script.replace(/\}\)\(\);\s*$/,`globalThis.labTest={state:()=>({charges,activeDrag,sourceDrag,camera}),toScreen,render,overWorkspace};})();`),sandbox);
 const api=sandbox.labTest;
 const point=c=>{const p=api.toScreen(c.x,c.y);return {clientX:p.x,clientY:p.y+top};};
 return {$,api,point,top,width,height,emitWindow,escape(){emitWindow('keydown',{key:'Escape'});}};
}

for(const compact of [false,true]){
 const layout=compact?'mobile':'desktop';
 test(`${layout}: source drag survives capture loss and release on a different element`,()=>{
  const {$,api,point}=openLab(compact),source=$('addPositive');
  source.emit('pointerdown',{clientX:63,clientY:731});
  source.emit('pointermove',{clientX:100,clientY:650});
  source.releasePointerCapture(1);
  assert.notEqual(api.state().sourceDrag,null);
  $('fieldCanvas').emit('pointermove',{clientX:150,clientY:550});
  $('fieldCanvas').emit('pointerup',{clientX:160,clientY:540});
  assert.equal(api.state().charges.length,4);
  assert.ok(Math.abs(point(api.state().charges.at(-1)).clientX-160)<1e-8);
  assert.equal(api.state().sourceDrag,null);
 });
 test(`${layout}: bin drop survives capture loss without a second deletion from click`,()=>{
  const {$,api,point}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0];
  canvas.emit('pointerdown',point(charge));canvas.emit('pointermove',{clientX:150,clientY:550});
  canvas.releasePointerCapture(1);
  assert.equal(api.state().activeDrag?.kind,'charge');
  $('trashZone').emit('pointermove',{clientX:220,clientY:731});
  $('trashZone').emit('pointerup',{clientX:220,clientY:731});
  $('trashZone').emit('click',{clientX:220,clientY:731});
  canvas.emit('dblclick',{clientX:220,clientY:731});
  assert.equal(api.state().charges.length,2);
  assert.equal(api.state().charges.some(c=>c.id===charge.id),false);
  assert.equal(api.state().activeDrag,null);
 });
 test(`${layout}: synthesized double-click after a drag cannot add an extra charge`,()=>{
  const {$,api}=openLab(compact),source=$('addPositive'),canvas=$('fieldCanvas');
  source.emit('pointerdown',{clientX:63,clientY:731});
  source.emit('pointerup',{clientX:160,clientY:540});
  // An off-center/retargeted double-click must not invoke canvas placement.
  canvas.emit('dblclick',{clientX:220,clientY:540});
  assert.equal(api.state().charges.length,4);
 });
 test(`${layout}: a mouse release missed by the page completes at the last drag position`,()=>{
  {
   const {$,api,point}=openLab(compact),source=$('addPositive');
   source.emit('pointerdown',{clientX:63,clientY:731});
   source.emit('pointermove',{clientX:150,clientY:550});source.releasePointerCapture(1);
   $('fieldCanvas').emit('pointermove',{clientX:200,clientY:500,buttons:0});
   assert.equal(api.state().charges.length,4);
   assert.ok(Math.abs(point(api.state().charges.at(-1)).clientX-150)<1e-8);
   assert.ok(Math.abs(point(api.state().charges.at(-1)).clientY-550)<1e-8);
   assert.equal(api.state().sourceDrag,null);
  }
  {
   const {$,api,point}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0];
   canvas.emit('pointerdown',point(charge));canvas.emit('pointermove',{clientX:220,clientY:731});canvas.releasePointerCapture(1);
   canvas.emit('pointermove',{clientX:300,clientY:500,buttons:0});
   assert.equal(api.state().charges.length,2);assert.equal(api.state().activeDrag,null);
  }
 });
 test(`${layout}: unrelated pointer releases cannot finish the active source drag`,()=>{
  const {$,api}=openLab(compact),source=$('addPositive');
  source.emit('pointerdown',{clientX:63,clientY:731});
  $('fieldCanvas').emit('pointerup',{clientX:160,clientY:540,pointerId:2});
  assert.notEqual(api.state().sourceDrag,null);assert.equal(api.state().charges.length,3);
  source.emit('pointerup',{clientX:160,clientY:540});assert.equal(api.state().charges.length,4);
 });
 test(`${layout}: keyboard bin activation remains available after dragging`,()=>{
  const {$,api}=openLab(compact),source=$('addPositive');
  source.emit('pointerdown',{clientX:63,clientY:731});source.emit('pointerup',{clientX:160,clientY:540});
  $('trashZone').emit('click',{detail:0,pointerId:-1});
  assert.equal(api.state().charges.length,3);
 });
 test(`${layout}: cancellation and blur discard pending source drags and allow a new one`,()=>{
  for(const interruption of ['pointercancel','blur']){
   const {$,api,emitWindow}=openLab(compact),source=$('addPositive');
   source.emit('pointerdown',{clientX:63,clientY:731});source.releasePointerCapture(1);
   $('fieldCanvas').emit('pointermove',{clientX:150,clientY:550});
   if(interruption==='blur')emitWindow('blur');else $('fieldCanvas').emit('pointercancel',{clientX:150,clientY:550});
   assert.equal(api.state().sourceDrag,null);assert.equal(api.state().charges.length,3);
   source.emit('pointerdown',{clientX:63,clientY:731});source.emit('pointerup',{clientX:160,clientY:540});
   assert.equal(api.state().charges.length,4);
  }
 });
 test(`${layout}: blur ends a canvas drag without deleting and permits a new tray drag`,()=>{
  const {$,api,point,emitWindow}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0];
  canvas.emit('pointerdown',point(charge));canvas.emit('pointermove',{clientX:150,clientY:550});
  canvas.emit('pointermove',{clientX:220,clientY:731});emitWindow('blur');
  assert.equal(api.state().activeDrag,null);assert.equal(api.state().charges.length,3);
  assert.ok(Math.abs(point(charge).clientX-150)<1e-8);
  $('addPositive').emit('pointerdown',{clientX:63,clientY:731});
  $('addPositive').emit('pointerup',{clientX:160,clientY:540});assert.equal(api.state().charges.length,4);
 });
 test(`${layout}: Escape clears pointer ownership without waiting for pointerup`,()=>{
  const {$,api,point,escape}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0],start=point(charge);
  canvas.emit('pointerdown',start);canvas.emit('pointermove',{clientX:220,clientY:731});escape();
  assert.equal(api.state().activeDrag,null);assert.deepEqual(point(charge),start);
  $('addPositive').emit('pointerdown',{clientX:63,clientY:731});
  $('addPositive').emit('pointerup',{clientX:160,clientY:540});assert.equal(api.state().charges.length,4);
 });
 test(`${layout}: cancelled drags cannot activate a later synthesized canvas double-click`,()=>{
  for(const interruption of ['escape','blur']){
   const {$,api,escape,emitWindow}=openLab(compact),source=$('addPositive'),canvas=$('fieldCanvas');
   source.emit('pointerdown',{clientX:63,clientY:731});
   source.emit('pointermove',{clientX:150,clientY:550});source.releasePointerCapture(1);
   if(interruption==='escape')escape();else emitWindow('blur');
   canvas.emit('pointerup',{clientX:160,clientY:540});canvas.emit('dblclick',{clientX:220,clientY:540});
   assert.equal(api.state().charges.length,3);
  }
 });
 test(`${layout}: bin drops include the surrounding tray padding and gap`,()=>{
  for(const [clientX,clientY] of [[177,731],[220,698],[263,731],[220,772]]){
   const {$,api,point}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0];
   canvas.emit('pointerdown',point(charge));
   canvas.emit('pointermove',{clientX,clientY});
   assert.equal($('trashZone').classList.contains('over'),true);
   canvas.emit('pointerup',{clientX,clientY});
   assert.equal(api.state().charges.length,2);
   assert.equal(api.state().charges.some(c=>c.id===charge.id),false);
  }
 });
 test(`${layout}: dropping the charge over the bin works when grabbed off center`,()=>{
  const {$,api,point}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0],start=point(charge);
  canvas.emit('pointerdown',{clientX:start.clientX-20,clientY:start.clientY});
  // Cursor is over the gap/source edge; the charge itself is over the bin.
  canvas.emit('pointerup',{clientX:164,clientY:731});
  assert.equal(api.state().charges.length,2);
 });
 test(`${layout}: a missed drop cannot leave an off-center charge hidden behind the tray`,()=>{
  const {$,api,point}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0],start=point(charge);
  canvas.emit('pointerdown',{clientX:start.clientX,clientY:start.clientY-20});
  canvas.emit('pointermove',{clientX:60,clientY:550});
  // Pointer is just outside the tray, but the charge's center is underneath it.
  canvas.emit('pointermove',{clientX:60,clientY:685});
  canvas.emit('pointerup',{clientX:60,clientY:685});
  assert.equal(api.state().charges.length,3);
  assert.ok(Math.abs(point(charge).clientY-570)<1e-8);
 });
 test(`${layout}: dropping over a source stack does not delete the charge`,()=>{
  const {$,api,point}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0];
  canvas.emit('pointerdown',point(charge));
  canvas.emit('pointermove',{clientX:150,clientY:550});
  canvas.emit('pointermove',{clientX:137,clientY:731});
  assert.equal($('trashZone').classList.contains('over'),false);
  canvas.emit('pointerup',{clientX:137,clientY:731});
  assert.equal(api.state().charges.length,3);
  assert.ok(Math.abs(point(charge).clientY-550)<1e-8);
 });
 test(`${layout}: a source drop overlapping the tray edge cannot hide a new charge`,()=>{
  const {$,api}=openLab(compact),source=$('addPositive');
  source.emit('pointerdown',{clientX:63,clientY:731});
  source.emit('pointermove',{clientX:63,clientY:685});
  assert.equal($('chargeGhost').classList.contains('invalid'),true);
  source.emit('pointerup',{clientX:63,clientY:685});
  assert.equal(api.state().charges.length,3);
 });
 test(`${layout}: fast tray drags use the release position even without a movement event`,()=>{
  for(const [id,sign,x] of [['addPositive',1,63],['addNegative',-1,137]]){
   for(const intermediateMove of [false,true]){
    const {$,api,point}=openLab(compact),source=$(id);
    source.emit('pointerdown',{clientX:x,clientY:731});
    if(intermediateMove)source.emit('pointermove',{clientX:x+2,clientY:730});
    source.emit('pointerup',{clientX:160,clientY:540});
    assert.equal(api.state().charges.length,4);
    const charge=api.state().charges.at(-1);
    assert.equal(Math.sign(charge.q),sign);
    assert.ok(Math.abs(point(charge).clientX-160)<1e-8);
    assert.ok(Math.abs(point(charge).clientY-540)<1e-8);
    assert.equal($('modeMessage').hidden,true);
   }
  }
 });
 test(`${layout}: fast bin drops work without a movement event`,()=>{
  const {$,api,point}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0];
  canvas.emit('pointerdown',point(charge));
  canvas.emit('pointerup',{clientX:220,clientY:731});
  assert.equal(api.state().charges.length,2);
  assert.equal(api.state().charges.some(c=>c.id===charge.id),false);
 });
 test(`${layout}: a tap on the tray still starts click-to-place without adding a charge`,()=>{
  const {$,api}=openLab(compact),source=$('addPositive');
  source.emit('pointerdown',{clientX:63,clientY:731});
  source.emit('pointerup',{clientX:65,clientY:730});
  assert.equal(api.state().charges.length,3);
  assert.equal($('modeMessage').hidden,false);
  assert.equal(source.classList.contains('active'),true);
 });
 test(`${layout}: fast grid moves keep the grab offset at the release position`,()=>{
  const {$,api,point}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0],start=point(charge);
  canvas.emit('pointerdown',{clientX:start.clientX+10,clientY:start.clientY-5});
  canvas.emit('pointerup',{clientX:160,clientY:540});
  assert.ok(Math.abs(point(charge).clientX-150)<1e-8);
  assert.ok(Math.abs(point(charge).clientY-545)<1e-8);
 });
 test(`${layout}: charge preview reaches the bin and drop removes only that charge`,()=>{
  const {$,api,point}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0];
  canvas.emit('pointerdown',point(charge));
  canvas.emit('pointermove',{clientX:220,clientY:731});api.render();
  const preview=$('chargeGhost').style.transform;
  assert.equal(preview,'translate(196px,617px)');
  assert.equal($('trashZone').classList.contains('over'),true);
  canvas.emit('pointerup',{clientX:220,clientY:731});
  assert.equal(api.state().charges.length,2);assert.equal(api.state().charges.some(c=>c.id===charge.id),false);
  assert.equal(api.state().activeDrag,null);assert.equal($('chargeGhost').hidden,true);
 });
 test(`${layout}: both source charges follow the pointer out of the tray and stay at the drop`,()=>{
  for(const [id,sign,x] of [['addPositive',1,63],['addNegative',-1,137]]){
   const {$,api,point}=openLab(compact),source=$(id);
   source.emit('pointerdown',{clientX:x,clientY:731});
   source.emit('pointermove',{clientX:x,clientY:690});
   assert.equal($('chargeGhost').hidden,false);assert.equal($('chargeGhost').style.transform,`translate(${x-24}px,576px)`);
   source.emit('pointermove',{clientX:150,clientY:550});
   assert.equal($('chargeGhost').classList.contains('invalid'),false);
   source.emit('pointerup',{clientX:160,clientY:540});
   assert.equal(api.state().charges.length,4);
   const charge=api.state().charges.at(-1),p=point(charge);
   assert.ok(Math.abs(p.clientX-160)<1e-8);assert.ok(Math.abs(p.clientY-540)<1e-8);assert.equal(Math.sign(charge.q),sign);
   assert.equal(api.state().sourceDrag,null);
   // A second gesture must pick up the placed charge, rather than the source.
   $('fieldCanvas').emit('pointerdown',p);$('fieldCanvas').emit('pointermove',{clientX:180,clientY:500});
   $('fieldCanvas').emit('pointerup',{clientX:180,clientY:500});
   assert.ok(Math.abs(point(charge).clientX-180)<1e-8);
  }
 });
 test(`${layout}: moving back out of the tray resumes the charge at the pointer`,()=>{
  const {$,api,point}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0];
  canvas.emit('pointerdown',point(charge));canvas.emit('pointermove',{clientX:220,clientY:731});
  canvas.emit('pointermove',{clientX:150,clientY:550});canvas.emit('pointerup',{clientX:160,clientY:540});
  assert.equal(api.state().charges.length,3);assert.ok(Math.abs(point(charge).clientX-160)<1e-8);
  assert.ok(Math.abs(point(charge).clientY-540)<1e-8);
 });
 test(`${layout}: invalid drops and cancellation retain the last valid grid position`,()=>{
  for(const type of ['pointerup','pointercancel']){
   const {$,api,point}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0];
   canvas.emit('pointerdown',point(charge));canvas.emit('pointermove',{clientX:150,clientY:550});
   canvas.emit('pointermove',{clientX:60,clientY:731});canvas.emit(type,{clientX:60,clientY:731});
   assert.ok(Math.abs(point(charge).clientX-150)<1e-8);assert.ok(Math.abs(point(charge).clientY-550)<1e-8);
   assert.equal(api.state().activeDrag,null);
  }
 });
 test(`${layout}: Escape restores the start and source drops inside the tray add nothing`,()=>{
  const {$,api,point,escape}=openLab(compact),canvas=$('fieldCanvas'),charge=api.state().charges[0],start=point(charge);
  canvas.emit('pointerdown',start);canvas.emit('pointermove',{clientX:220,clientY:731});escape();
  assert.deepEqual(point(charge),start);canvas.emit('pointerup',{clientX:220,clientY:731});
  $('addPositive').emit('pointerdown',{clientX:63,clientY:731});
  $('addPositive').emit('pointermove',{clientX:90,clientY:731});
  $('addPositive').emit('pointerup',{clientX:90,clientY:731});assert.equal(api.state().charges.length,3);
 });
}
