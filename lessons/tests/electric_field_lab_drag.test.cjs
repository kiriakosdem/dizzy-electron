const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../electric_field_lab.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

// Run the page's real handlers with deterministic layout and pointer capture.
function openLab(compact,{empty=false,random}={}){
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
 const document={hidden:false,addEventListener(){},getElementById:$,createElement:()=>element(),querySelector:selector=>selector==='.zoom'?$('zoom'):null,querySelectorAll:()=>[],
  elementFromPoint(){throw Error('Drop validation must not depend on the preview being absent from hit testing');}};
 const sandbox={document,window:{matchMedia:()=>({matches:compact,addEventListener(){}}),devicePixelRatio:1,
  addEventListener(type,handler,options){if(!windowListeners.has(type))windowListeners.set(type,[]);windowListeners.get(type).push({handler,capture:options===true||!!options?.capture});}},ResizeObserver:class{observe(){}},
  requestAnimationFrame(){},getComputedStyle:()=>({visibility:'visible'}),HTMLInputElement:class{},HTMLTextAreaElement:class{}};
 if(random){sandbox.Math=Object.create(Math);sandbox.Math.random=random;}
 vm.createContext(sandbox);
 vm.runInContext(script.replace(/\}\)\(\);\s*$/,`globalThis.labTest={state:()=>({charges,selectedId,activeDrag,sourceDrag,camera,testCharge:selectedTest()||null,testCharges,selectedTestId,placing}),seedSources:sources=>{charges=sources.map((c,i)=>({id:i+1,...c}));nextId=charges.length+1;selectedId=charges[0]?.id??null;testSelected=false;syncPanel();},toScreen,render,overWorkspace,testAcceleration,placeTestCharge,advanceTestCharge,fieldAt};})();`),sandbox);
 const api=sandbox.labTest;
 // Keep gesture tests on an explicit, deterministic fixture. Real empty startup
 // is exercised separately with {empty:true}.
 if(!empty)api.seedSources([{x:-155,y:-15,q:4.5},{x:155,y:-25,q:-4.5},{x:5,y:160,q:2.6}]);
 const point=c=>{const p=api.toScreen(c.x,c.y);return {clientX:p.x,clientY:p.y+top};};
 return {$,api,point,document,top,width,height,emitWindow,escape(){emitWindow('keydown',{key:'Escape'});}};
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

test('vertical phone tray: bin and padding accept drops while source stacks do not',()=>{
 for(const [clientX,clientY,deleted] of [[47,735,true],[20,708,true],[78,763,true],[47,680,false]]){
  const {$,api,point}=openLab(true),canvas=$('fieldCanvas'),charge=api.state().charges[0];
  $('chargeTray').rect={left:12,top:590,right:82,bottom:768,width:70,height:178};
  $('addPositive').rect={left:21,top:599,right:73,bottom:647,width:52,height:48};
  $('addNegative').rect={left:21,top:655,right:73,bottom:703,width:52,height:48};
  $('trashZone').rect={left:21,top:711,right:73,bottom:759,width:52,height:48};
  canvas.emit('pointerdown',point(charge));
  canvas.emit('pointermove',{clientX,clientY});
  assert.equal($('trashZone').classList.contains('over'),deleted);
  canvas.emit('pointerup',{clientX,clientY});
  assert.equal(api.state().charges.length,deleted?2:3);
  // Creating charges still works with vertically arranged sources.
  $('addPositive').emit('pointerdown',{clientX:47,clientY:623});
  $('addPositive').emit('pointerup',{clientX:160,clientY:540});
  assert.equal(api.state().charges.length,deleted?3:4);
 }
});

function singleSourceLab(q=4){
 const lab=openLab(false);lab.api.state().charges.splice(0,3,{id:1,x:0,y:0,q});return lab;
}
function advanceSeconds(api,seconds,fps=60){for(let frame=0;frame<Math.round(seconds*fps);frame++)api.advanceTestCharge(1/fps);}
function closeTo(actual,expected,tolerance=1e-9){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);}

test('test-charge acceleration follows Coulomb superposition and inverse mass',()=>{
 const {api}=singleSourceLab(),a=api.testAcceleration(100,0,10);
 // x=100 cm is 1 m; convert SI acceleration back to cm/s².
 closeTo(a.x,100*8.9875517923e9*4*10e-6/(1*1*10));closeTo(a.y,0);
 closeTo(api.testAcceleration(200,0,10).x,a.x/4);
 closeTo(api.testAcceleration(100,0,20).x,a.x/2);
 api.state().charges.push({id:2,x:200,y:0,q:4});
 closeTo(api.testAcceleration(100,0,10).x,0);
 api.state().charges[1].q=-4;
 closeTo(api.testAcceleration(100,0,10).x,2*a.x);
});

test('test charge starts at rest and its default mass gives observable, gradual motion',()=>{
 for(const q of [4,-4]){
  const {api}=singleSourceLab(q);assert.equal(api.placeTestCharge(100,0),true);
  const particle=api.state().testCharge;assert.equal(particle.mass,.1);assert.equal(particle.vx,0);assert.equal(particle.vy,0);
  advanceSeconds(api,.1);
  const displacement=(particle.x-100)*Math.sign(q);
  assert.ok(displacement>1&&displacement<3,'The 100 g default starts with a gradual displacement');
  assert.equal(Math.sign(particle.vx),Math.sign(q));closeTo(particle.y,0);
 }
});

test('motion agrees with conserved mechanical energy in a fixed Coulomb field',()=>{
 const {api}=singleSourceLab();api.placeTestCharge(100,0);
 const particle=api.state().testCharge;
 const energy=()=>.5*particle.mass*((particle.vx*.01)**2+(particle.vy*.01)**2)+8.9875517923e9*4*particle.q/(Math.hypot(particle.x,particle.y)*.01);
 const initial=energy();advanceSeconds(api,5);
 assert.ok(Math.abs(energy()-initial)/initial<1e-5);
});

test('a test charge coasts in centimeters at one simulated millisecond per real second',()=>{
 const {api}=openLab(false);api.state().charges.splice(0);api.placeTestCharge(0,0);
 const particle=api.state().testCharge;particle.vx=3;particle.vy=-4;
 advanceSeconds(api,2);closeTo(particle.x,.006);closeTo(particle.y,-.008);closeTo(particle.vx,3);closeTo(particle.vy,-4);
});

test('test-charge trajectories are independent of frame rate and display sensitivity',()=>{
 const slow=singleSourceLab(),fast=singleSourceLab();
 slow.$('sensitivity').value='.3';slow.$('sensitivity').emit('input');
 fast.$('sensitivity').value='4';fast.$('sensitivity').emit('input');
 slow.api.placeTestCharge(100,50);fast.api.placeTestCharge(100,50);
 advanceSeconds(slow.api,2,30);advanceSeconds(fast.api,2,144);
 for(const key of ['x','y','vx','vy'])closeTo(slow.api.state().testCharge[key],fast.api.state().testCharge[key]);
});

test('test charge does not alter the source charges or the electric field',()=>{
 const {api}=openLab(false),sources=JSON.stringify(api.state().charges),field=api.fieldAt(80,60);
 api.placeTestCharge(0,0);advanceSeconds(api,2);
 assert.equal(JSON.stringify(api.state().charges),sources);assert.deepEqual(api.fieldAt(80,60),field);
});

test('mass, pause, reset and remove controls preserve the expected motion state',()=>{
 const {$,api}=singleSourceLab();api.placeTestCharge(100,0);advanceSeconds(api,1);
 $('pauseTest').emit('click');const paused=JSON.stringify(api.state().testCharge);advanceSeconds(api,1);
 assert.equal(JSON.stringify(api.state().testCharge),paused);
 $('testMass').value='500';$('testMass').emit('input');assert.equal(api.state().testCharge.mass,.5);
 $('pauseTest').emit('click');advanceSeconds(api,1);assert.ok(api.state().testCharge.x>101);
 $('resetTest').emit('click');const particle=api.state().testCharge;
 assert.equal(particle.x,100);assert.equal(particle.vx,0);assert.equal(particle.running,false);assert.equal(particle.trail.length,1);
 $('trashZone').emit('click',{detail:0});assert.equal(api.state().testCharge,null);assert.equal($('testPlayback').hidden,true);
});

test('placement rejects the point-charge singularity without discarding an existing test charge',()=>{
 const {api}=singleSourceLab();api.placeTestCharge(100,0);const original=api.state().testCharge;
 assert.equal(api.placeTestCharge(0,0),false);assert.equal(api.state().testCharge,original);assert.equal(api.state().placing,'test');
 assert.equal(api.placeTestCharge(2100,0),false);
});

test('source contact removes a fast test charge and its entire trail without tunneling',()=>{
 const {$,api}=singleSourceLab(-4);api.placeTestCharge(-100,0);const particle=api.state().testCharge;particle.vx=100000000;
 particle.trail.push({x:-90,y:0});api.advanceTestCharge(1/240);
 assert.equal(api.state().testCharge,null);assert.equal(particle.trail.length,0);
 assert.equal($('testPlayback').hidden,true);assert.equal($('lab').classList.contains('test-active'),false);
 assert.equal(api.state().charges.length,1);api.advanceTestCharge(1/60);
 // Moving a source onto the particle removes it before evaluating the singular field.
 const second=singleSourceLab();second.api.placeTestCharge(100,0);second.api.state().charges[0].x=100;
 second.api.advanceTestCharge(1/240);assert.equal(second.api.state().testCharge,null);
});

test('the test charge and trail disappear at world boundaries and long frame gaps stay bounded',()=>{
 const {api,document}=openLab(false);api.state().charges.splice(0);api.placeTestCharge(1990,0);
 const particle=api.state().testCharge;particle.vx=10000000;api.advanceTestCharge(1/240);
 assert.equal(api.state().testCharge,null);assert.equal(particle.trail.length,0);
 api.placeTestCharge(0,0);api.state().testCharge.vx=10;
 document.hidden=true;api.advanceTestCharge(60);assert.equal(api.state().testCharge.x,0);
 document.hidden=false;api.advanceTestCharge(60);closeTo(api.state().testCharge.x,.001);
});

test('a particle outside any world edge is removed with its trail on the next simulation step',()=>{
 for(const [x,y] of [[2001,0],[-2001,0],[0,1501],[0,-1501]]){
  const {api}=openLab(false);api.placeTestCharge(0,0);const particle=api.state().testCharge;
  particle.x=x;particle.y=y;api.advanceTestCharge(1/240);
  assert.equal(api.state().testCharge,null);assert.equal(particle.trail.length,0);
 }
});

for(const compact of [false,true]){
 test(`${compact?'mobile':'desktop'}: tray dragging and click-to-place append moving test charges`,()=>{
  const {$,api,point}=openLab(compact),sources=api.state().charges.length,source=$('addTest');
  source.emit('pointerdown',{clientX:50,clientY:660});
  source.emit('pointermove',{clientX:160,clientY:540});assert.equal($('chargeGhost').classList.contains('test'),true);
  source.emit('pointerup',{clientX:160,clientY:540});
  assert.ok(api.state().testCharge);assert.equal(api.state().charges.length,sources);
  const first=api.state().testCharge;
  closeTo(point(api.state().testCharge).clientX,160);closeTo(point(api.state().testCharge).clientY,540);
  $('addTest').emit('click',{detail:0});assert.equal(api.state().placing,'test');assert.equal(api.state().testCharge.running,true);
  $('fieldCanvas').emit('pointerdown',{clientX:170,clientY:550});$('fieldCanvas').emit('pointerup',{clientX:170,clientY:550});
  closeTo(point(api.state().testCharge).clientX,170);assert.equal(api.state().placing,0);
  assert.equal(api.state().testCharges.length,2);assert.ok(api.state().testCharges.includes(first));assert.equal(first.running,true);
 });
}

test('keyboard placement and scene clearing also manage the test charge',()=>{
 const {$,api}=openLab(false);$('addTest').emit('click',{detail:0});$('fieldCanvas').emit('keydown',{key:'Enter'});
 assert.ok(api.state().testCharge);assert.equal(api.state().placing,0);
 $('presetDipole').emit('click');assert.equal(api.state().testCharge,null);
 api.placeTestCharge(0,0);$('clear').emit('click');assert.equal(api.state().testCharge,null);assert.equal(api.state().charges.length,0);
});

test('a source charge dropped over the new test-charge tray button is not deleted',()=>{
 const {$,api,point}=openLab(false),canvas=$('fieldCanvas'),charge=api.state().charges[0];
 $('chargeTray').rect={left:18,top:638,right:271,bottom:772,width:253,height:134};
 $('addTest').rect={left:31,top:645,right:258,bottom:689,width:227,height:44};
 canvas.emit('pointerdown',point(charge));canvas.emit('pointermove',{clientX:150,clientY:550});
 canvas.emit('pointermove',{clientX:220,clientY:665});assert.equal($('trashZone').classList.contains('over'),false);
 canvas.emit('pointerup',{clientX:220,clientY:665});assert.equal(api.state().charges.length,3);
});

test('test-charge tools and canvas selection switch the inspector and clear source selection',()=>{
 const {$,api,point}=openLab(false),canvas=$('fieldCanvas');
 assert.equal($('editBlock').hidden,false);assert.equal($('testBlock').hidden,true);
 $('addTest').emit('click',{detail:0});
 assert.equal(api.state().selectedId,null);assert.equal($('editBlock').hidden,true);assert.equal($('testBlock').hidden,false);
 api.placeTestCharge(0,0);$('cancelPlacement').emit('click');
 const source=api.state().charges[0];canvas.emit('pointerdown',point(source));canvas.emit('pointerup',point(source));
 assert.equal(api.state().selectedId,source.id);assert.equal($('editBlock').hidden,false);assert.equal($('testBlock').hidden,true);
 canvas.emit('pointerdown',point(api.state().testCharge));canvas.emit('pointerup',point(api.state().testCharge));
 assert.equal(api.state().selectedId,null);assert.equal($('editBlock').hidden,true);assert.equal($('testBlock').hidden,false);
 canvas.emit('pointerdown',point(source));canvas.emit('pointerup',point(source));
 $('pauseTest').emit('click');assert.equal(api.state().selectedId,null);assert.equal($('testBlock').hidden,false);
 const count=api.state().charges.length;$('trashZone').emit('click');
 assert.equal(api.state().testCharge,null);assert.equal(api.state().charges.length,count);
});

test('gram slider values convert to kilograms before calculating test-charge acceleration',()=>{
 const {$,api}=singleSourceLab();api.placeTestCharge(100,0);
 const unitMassAcceleration=api.testAcceleration(100,0,1).x;
 for(const [grams,mass] of [[1,.001],[500,.5],[1000,1]]){
  $('testMass').value=String(grams);$('testMass').emit('input');
  assert.equal(api.state().testCharge.mass,mass);
  closeTo(api.testAcceleration(100,0).x,unitMassAcceleration/mass,Math.abs(unitMassAcceleration/mass)*1e-12);
 }
});

test('multiple test charges follow the same independent Coulomb trajectories as isolated probes',()=>{
 const together=singleSourceLab(),one=singleSourceLab(),two=singleSourceLab();
 together.api.placeTestCharge(100,100);const first=together.api.state().testCharge;
 together.api.placeTestCharge(200,100);const second=together.api.state().testCharge;
 together.$('testMass').value='500';together.$('testMass').emit('input');
 one.api.placeTestCharge(100,100);one.$('testMass').value='500';one.$('testMass').emit('input');two.api.placeTestCharge(200,100);two.$('testMass').value='500';two.$('testMass').emit('input');
 advanceSeconds(together.api,1);advanceSeconds(one.api,1);advanceSeconds(two.api,1);
 for(const key of ['x','y','vx','vy']){closeTo(first[key],one.api.state().testCharge[key]);closeTo(second[key],two.api.state().testCharge[key]);}
 assert.notEqual(first.id,second.id);assert.notEqual(first.trail,second.trail);
});

test('mass and playback apply to every test charge while removal stays individual',()=>{
 const {$,api,point}=singleSourceLab();api.placeTestCharge(100,100);const first=api.state().testCharge;
 api.placeTestCharge(200,100);const second=api.state().testCharge;
 $('testMass').value='500';$('testMass').emit('input');advanceSeconds(api,.5);
 $('fieldCanvas').emit('pointerdown',point(first));$('fieldCanvas').emit('pointerup',point(first));
 assert.equal(api.state().selectedTestId,first.id);assert.equal($('testMass').value,'500');
 $('testMass').value='250';$('testMass').emit('input');assert.equal(first.mass,.25);assert.equal(second.mass,.25);
 $('pauseTest').emit('click');assert.equal(first.running,false);assert.equal(second.running,false);
 const paused=JSON.stringify(api.state().testCharges);advanceSeconds(api,.5);assert.equal(JSON.stringify(api.state().testCharges),paused);
 $('pauseTest').emit('click');assert.equal(first.running,true);assert.equal(second.running,true);
 const firstX=first.x,secondX=second.x;advanceSeconds(api,.5);assert.ok(first.x>firstX);assert.ok(second.x>secondX);
 $('resetTest').emit('click');assert.equal(first.x,100);assert.equal(first.y,100);assert.equal(second.x,200);assert.equal(second.y,100);
 assert.equal(first.running,false);assert.equal(second.running,false);assert.equal(first.vx,0);assert.equal(second.vx,0);assert.equal(first.trail.length,1);assert.equal(second.trail.length,1);
 $('trashZone').emit('click',{detail:0});assert.equal(api.state().testCharges.length,1);assert.equal(api.state().testCharge,second);
});

for(const compact of [false,true]){
 test(`${compact?'mobile':'desktop'}: pick up a moving test charge while the other keeps moving`,()=>{
  const {$,api,point}=openLab(compact),canvas=$('fieldCanvas');api.state().charges.splice(0);
  api.placeTestCharge(0,150);const first=api.state().testCharge;first.vx=12;first.vy=-3;
  api.placeTestCharge(100,200);const second=api.state().testCharge;second.vx=5;second.vy=2;
  advanceSeconds(api,.2);const pick=point(first),secondX=second.x;
  canvas.emit('pointerdown',{...pick,clientX:pick.clientX-4});
  assert.equal(first.running,false);assert.equal(second.running,true);assert.equal(api.state().selectedTestId,first.id);assert.equal(api.state().selectedId,null);
  canvas.emit('pointermove',{clientX:160,clientY:540});api.render();
  assert.equal($('chargeGhost').classList.contains('test'),true);assert.equal(first.trail.length,0);
  advanceSeconds(api,.1);assert.ok(second.x>secondX);
  canvas.emit('pointerup',{clientX:170,clientY:550});
  closeTo(point(first).clientX,174);closeTo(point(first).clientY,550);
  assert.equal(first.vx,0);assert.equal(first.vy,0);assert.equal(first.running,true);assert.equal(first.trail.length,1);
  assert.equal(api.state().testCharges.length,2);assert.equal(api.state().activeDrag,null);
  assert.equal(first.startX,first.x);assert.equal(first.startY,first.y);
 });

 test(`${compact?'mobile':'desktop'}: clicking a test charge preserves its velocity and trail`,()=>{
  const {$,api,point}=openLab(compact);api.state().charges.splice(0);api.placeTestCharge(0,150);
  const t=api.state().testCharge;t.vx=10;t.vy=3;advanceSeconds(api,.2);
  const before=JSON.stringify(t),p=point(t);$('fieldCanvas').emit('pointerdown',p);$('fieldCanvas').emit('pointerup',p);
  assert.equal(JSON.stringify(t),before);
 });

 test(`${compact?'mobile':'desktop'}: cancelling a moving test-charge drag restores its motion and trail`,()=>{
  for(const cancel of ['pointercancel','escape','blur']){
   const {$,api,point,escape,emitWindow}=openLab(compact);api.state().charges.splice(0);api.placeTestCharge(0,150);
   const t=api.state().testCharge;t.vx=10;advanceSeconds(api,.2);const before=JSON.stringify(t),canvas=$('fieldCanvas');
   canvas.emit('pointerdown',point(t));canvas.emit('pointermove',{clientX:160,clientY:540});
   if(cancel==='escape')escape();else if(cancel==='blur')emitWindow('blur');else canvas.emit('pointercancel',{clientX:160,clientY:540});
   assert.equal(JSON.stringify(t),before);assert.equal(api.state().activeDrag,null);
  }
 });

 test(`${compact?'mobile':'desktop'}: test-charge drag survives capture loss and keeps the last valid drop`,()=>{
  const {$,api,point}=openLab(compact),canvas=$('fieldCanvas');api.state().charges.splice(0);api.placeTestCharge(0,150);
  const t=api.state().testCharge;canvas.emit('pointerdown',point(t));canvas.emit('pointermove',{clientX:160,clientY:540});
  canvas.releasePointerCapture(1);$('addPositive').emit('pointermove',{clientX:63,clientY:731});$('addPositive').emit('pointerup',{clientX:63,clientY:731});
  closeTo(point(t).clientX,160);closeTo(point(t).clientY,540);assert.equal(t.running,true);
  assert.equal(api.state().testCharges.length,1);assert.equal(api.state().activeDrag,null);
 });

 test(`${compact?'mobile':'desktop'}: dropping a test charge into Trash removes only that particle`,()=>{
  const {$,api,point}=openLab(compact),canvas=$('fieldCanvas');api.state().charges.splice(0);
  api.placeTestCharge(0,150);const first=api.state().testCharge;api.placeTestCharge(100,200);const second=api.state().testCharge;
  canvas.emit('pointerdown',point(first));$('trashZone').emit('pointerup',{clientX:220,clientY:731});
  $('trashZone').emit('click',{clientX:220,clientY:731});
  assert.equal(api.state().testCharges.length,1);assert.equal(api.state().testCharge,second);assert.equal(second.running,true);
 });
}

test('automatic removal of one particle preserves the remaining simulation and its trail',()=>{
 const {api}=singleSourceLab(-4);api.placeTestCharge(-100,0);const first=api.state().testCharge;first.vx=100000000;
 api.placeTestCharge(300,100);const second=api.state().testCharge;advanceSeconds(api,.1);
 assert.equal(api.state().testCharges.length,1);assert.equal(api.state().testCharge,second);assert.equal(first.trail.length,0);
 assert.equal(second.running,true);assert.ok(second.trail.length>1);assert.ok(second.x<300);
});

test('clearing and loading a preset remove every test charge and trail',()=>{
 for(const action of ['clear','presetSingle']){
  const {$,api}=openLab(false);api.placeTestCharge(0,0);api.placeTestCharge(0,100);
  const particles=[...api.state().testCharges];$(action).emit('click');
  assert.equal(api.state().testCharges.length,0);assert.equal(api.state().testCharge,null);
  assert.ok(particles.every(t=>t.trail.length===0));assert.equal($('testPlayback').hidden,true);
 }
});

test('new test charges inherit the shared mass and global pause state',()=>{
 const {$,api}=singleSourceLab();api.placeTestCharge(100,100);
 $('testMass').value='100';$('testMass').emit('input');$('pauseTest').emit('click');
 api.placeTestCharge(200,100);assert.equal(api.state().testCharges.length,2);
 assert.ok(api.state().testCharges.every(t=>t.mass===.1&&!t.running));
 const paused=JSON.stringify(api.state().testCharges);advanceSeconds(api,.2);assert.equal(JSON.stringify(api.state().testCharges),paused);
 $('pauseTest').emit('click');assert.ok(api.state().testCharges.every(t=>t.running));advanceSeconds(api,.2);
 assert.ok(api.state().testCharges.every(t=>t.x>t.startX));
});

test('global pause and continue remain authoritative when a test charge is being dragged',()=>{
 const {$,api,point}=openLab(false),canvas=$('fieldCanvas');api.state().charges.splice(0);
 api.placeTestCharge(0,150);const first=api.state().testCharge;api.placeTestCharge(100,200);const second=api.state().testCharge;
 canvas.emit('pointerdown',point(first));canvas.emit('pointermove',{clientX:160,clientY:540});
 $('pauseTest').emit('click',{detail:0});assert.equal(first.running,false);assert.equal(second.running,false);
 canvas.emit('pointerup',{clientX:160,clientY:540});assert.equal(first.running,false);assert.equal(second.running,false);
 $('pauseTest').emit('click',{detail:0});assert.equal(first.running,true);assert.equal(second.running,true);
 canvas.emit('pointerdown',point(first));canvas.emit('pointermove',{clientX:180,clientY:520});
 $('pauseTest').emit('click',{detail:0});$('pauseTest').emit('click',{detail:0});
 assert.equal(first.running,false);assert.equal(second.running,true);
 canvas.emit('pointerup',{clientX:180,clientY:520});assert.equal(first.running,true);
});

test('reset during a drag restores every original release position and clears all trails',()=>{
 const {$,api,point}=openLab(false),canvas=$('fieldCanvas');api.state().charges.splice(0);
 api.placeTestCharge(0,150);const first=api.state().testCharge;first.vx=10;
 api.placeTestCharge(100,200);const second=api.state().testCharge;second.vy=5;advanceSeconds(api,.5);
 canvas.emit('pointerdown',point(first));canvas.emit('pointermove',{clientX:160,clientY:540});
 $('resetTest').emit('click',{detail:0});canvas.emit('pointerup',{clientX:160,clientY:540});
 assert.equal(first.x,0);assert.equal(first.y,150);assert.equal(second.x,100);assert.equal(second.y,200);
 assert.equal(api.state().activeDrag,null);assert.ok(api.state().testCharges.every(t=>!t.running&&t.vx===0&&t.vy===0&&t.trail.length===1));
});

for(const compact of [false,true]){
 for(const kind of ['source','test']){
  test(`${compact?'mobile':'desktop'}: background clicks, pans and zoom preserve ${kind} selection`,()=>{
   for(const button of [0,1]){
    const {$,api,point}=openLab(compact),canvas=$('fieldCanvas');api.placeTestCharge(0,100);
    if(kind==='source'){const source=api.state().charges[0];canvas.emit('pointerdown',point(source));canvas.emit('pointerup',point(source));}
    const sourceId=api.state().selectedId,testId=api.state().selectedTestId;
    const testVisible=$('testBlock').hidden,sourceVisible=$('editBlock').hidden;
    const assertSelection=()=>{assert.equal(api.state().selectedId,sourceId);assert.equal(api.state().selectedTestId,testId);assert.equal($('testBlock').hidden,testVisible);assert.equal($('editBlock').hidden,sourceVisible);};
    const p={clientX:compact?300:600,clientY:600,button};
    canvas.emit('pointerdown',p);assertSelection();canvas.emit('pointerup',p);assertSelection();
    canvas.emit('pointerdown',p);canvas.emit('pointermove',{...p,clientX:p.clientX+20,clientY:p.clientY+30});
    canvas.emit('pointerup',{...p,clientX:p.clientX+20,clientY:p.clientY+30});assertSelection();
    canvas.emit('wheel',{...p,deltaY:100});assertSelection();
   }
  });
 }
}

test('the global charge slider scales force and enforces positive charges on existing and new probes',()=>{
 const {$,api}=singleSourceLab();api.placeTestCharge(100,100);api.placeTestCharge(200,100);
 const first=api.state().testCharges[0],sources=JSON.stringify(api.state().charges),field=api.fieldAt(100,100);
 const original=api.testAcceleration(100,100);
 $('testChargeStrength').value='5';$('testChargeStrength').emit('input');
 assert.ok(api.state().testCharges.every(t=>Math.abs(t.q-5e-6)<1e-15));
 closeTo(api.testAcceleration(100,100).x,original.x/2,1e-7);closeTo(api.testAcceleration(100,100).y,original.y/2,1e-7);
 advanceSeconds(api,1);assert.ok(first.x>100);assert.ok(first.vx>0);
 for(const value of ['0','-5','-20']){
  $('testChargeStrength').value=value;$('testChargeStrength').emit('input');
  assert.ok(api.state().testCharges.every(t=>Math.abs(t.q-.1e-6)<1e-15));
  closeTo(api.testAcceleration(100,100).x,original.x*.01,1e-7);
 }
 api.placeTestCharge(300,100);closeTo(api.state().testCharge.q,.1e-6,1e-15);
 $('testChargeStrength').value='20';$('testChargeStrength').emit('input');
 assert.ok(api.state().testCharges.every(t=>Math.abs(t.q-20e-6)<1e-15));
 closeTo(api.testAcceleration(100,100).x,original.x*2,1e-7);
 assert.equal(JSON.stringify(api.state().charges),sources);assert.deepEqual(api.fieldAt(100,100),field);
});

test('static charge sliders share signed values, cross zero and reverse the resulting field',()=>{
 const {$,api}=singleSourceLab(),source=api.state().charges[0],original=api.fieldAt(100,0).x;
 const selectedId=api.state().selectedId;
 $('chargeStrength').value='-6.2';$('chargeStrength').emit('input');
 assert.equal(source.q,-6.2);assert.equal($('canvasChargeStrength').value,'-6.2');assert.equal($('canvasStrengthText').textContent,'-6.2 C');
 closeTo(api.fieldAt(100,0).x,original*(-6.2/4));assert.ok(api.testAcceleration(100,0).x<0);
 $('canvasChargeStrength').value='0';$('canvasChargeStrength').emit('input');
 assert.equal(source.q,0);assert.equal($('chargeStrength').value,'0');assert.equal($('strengthText').textContent,'0.0 C');
 closeTo(api.fieldAt(100,0).mag,0);closeTo(api.testAcceleration(100,0).x,0);
 $('canvasChargeStrength').value='3.1';$('canvasChargeStrength').emit('input');
 assert.equal(source.q,3.1);assert.equal($('chargeStrength').value,'3.1');assert.equal($('strengthText').textContent,'+3.1 C');
 closeTo(api.fieldAt(100,0).x,original*(3.1/4));assert.equal(api.state().selectedId,selectedId);
});

for(const compact of [false,true]){
 test(`${compact?'mobile':'desktop'}: the canvas slider follows its selected point and stays inside the workspace`,()=>{
  const {$,api}=openLab(compact),editor=$('chargePopover'),canvas=$('fieldCanvas');api.render();
  assert.equal(editor.hidden,false);const x=parseFloat(editor.style.left),y=parseFloat(editor.style.top);
  const availableWidth=compact?390:708;
  assert.ok(x>=8&&x+190<=availableWidth-8);assert.ok(y>=8&&y+80<=700-8);
  const p={clientX:compact?300:600,clientY:600};canvas.emit('pointerdown',p);
  canvas.emit('pointermove',{clientX:p.clientX+20,clientY:p.clientY+30});api.render();
  assert.equal(editor.hidden,false);assert.notEqual(parseFloat(editor.style.top),y);
  canvas.emit('pointerup',{clientX:p.clientX+20,clientY:p.clientY+30});
  api.placeTestCharge(0,100);assert.equal(editor.hidden,true);
 });
}

test('the floating charge slider edits the source without starting a canvas gesture',()=>{
 const {$,api}=openLab(false),source=api.state().charges[0],camera=JSON.stringify(api.state().camera);
 const x=source.x,y=source.y,id=source.id;
 $('canvasChargeStrength').emit('pointerdown',{clientX:360,clientY:400});
 $('canvasChargeStrength').emit('pointermove',{clientX:420,clientY:400});
 $('canvasChargeStrength').value='-2';$('canvasChargeStrength').emit('input');
 $('canvasChargeStrength').emit('pointerup',{clientX:420,clientY:400});
 assert.equal(source.q,-2);assert.equal(source.x,x);assert.equal(source.y,y);assert.equal(api.state().selectedId,id);
 assert.equal(api.state().activeDrag,null);assert.equal(JSON.stringify(api.state().camera),camera);
});

test('the floating editor blocks charge drops while visible and gets out of the way during dragging',()=>{
 const {$,api}=openLab(false),editor=$('chargePopover');
 editor.rect={left:300,top:300,right:490,bottom:380,width:190,height:80};editor.hidden=false;
 const p={clientX:400,clientY:340};assert.equal(api.overWorkspace(p),false);
 $('addPositive').emit('pointerdown',{clientX:63,clientY:731});
 assert.equal(editor.hidden,true);assert.equal(api.overWorkspace(p),true);
 $('addPositive').emit('pointercancel',{clientX:63,clientY:731});
});

test('single, dipole and row presets create their expected electrostatic arrangements',()=>{
 const {$,api}=openLab(false);
 $('presetSingle').emit('click');assert.equal(api.state().charges.length,1);assert.ok(api.state().charges[0].q>0);
 const single=api.state().charges[0];assert.ok(api.fieldAt(single.x+100,single.y).x>0);
 $('presetDipole').emit('click');const dipole=api.state().charges;
 assert.equal(dipole.length,2);closeTo(dipole[0].q,-dipole[1].q);assert.equal(dipole[0].y,dipole[1].y);
 const midpoint={x:(dipole[0].x+dipole[1].x)/2,y:dipole[0].y};
 assert.ok(api.fieldAt(midpoint.x,midpoint.y).x>0);closeTo(api.fieldAt(midpoint.x,midpoint.y).y,0);
 $('presetRow').emit('click');const row=api.state().charges;
 assert.equal(row.length,5);assert.ok(row.every(c=>c.q>0&&c.y===row[0].y));
 const spacing=row[1].x-row[0].x;assert.ok(spacing>0);
 for(let i=1;i<row.length;i++)closeTo(row[i].x-row[i-1].x,spacing);
});

test('random configurations scatter five separated charges without aligned rows or columns',()=>{
 const {$,api}=openLab(false);
 for(let scene=0;scene<8;scene++){
  $('presetRandom').emit('click');const charges=api.state().charges;
  assert.equal(charges.length,5);assert.equal(new Set(charges.map(c=>c.id)).size,5);
  assert.ok(charges.filter(c=>c.q>0).length>=2);assert.ok(charges.filter(c=>c.q<0).length>=2);
  assert.ok(charges.every(c=>Number.isInteger(c.x)&&Number.isInteger(c.y)&&Math.abs(c.q)<=10&&Math.abs(c.q)>0));
  for(let i=0;i<charges.length;i++)for(let j=i+1;j<charges.length;j++){
   assert.ok(Math.hypot(charges[i].x-charges[j].x,charges[i].y-charges[j].y)>=110);
   assert.ok(Math.abs(charges[i].x-charges[j].x)>=20);assert.ok(Math.abs(charges[i].y-charges[j].y)>=20);
  }
 }
});

for(const compact of [false,true]){
 test(`${compact?'mobile':'desktop'}: loading presets fits every source into the visible canvas`,()=>{
  const {$,api,point,top,width,height}=openLab(compact);
  for(const id of ['presetSingle','presetDipole','presetRow','presetRandom']){
   $('controlsToggle').emit('click');$(id).emit('click');
   const visibleWidth=width-($('controlsPanel').hidden?0:292);
   for(const source of api.state().charges){
    const p=point(source);assert.ok(p.clientX>=40&&p.clientX<=visibleWidth-40);
    assert.ok(p.clientY-top>=40&&p.clientY-top<=height-40);
   }
   assert.ok(api.state().charges.some(c=>c.id===api.state().selectedId));
   if(compact)assert.equal($('controlsPanel').hidden,true);
  }
 });
}

test('loading a preset clears moving particles, trails, placement and pointer ownership',()=>{
 const {$,api,point}=openLab(false);api.placeTestCharge(0,0);api.placeTestCharge(0,100);
 const particles=[...api.state().testCharges],canvas=$('fieldCanvas');
 $('testMass').value='250';$('testMass').emit('input');$('testChargeStrength').value='5';$('testChargeStrength').emit('input');
 canvas.emit('pointerdown',point(particles[0]));canvas.emit('pointermove',{clientX:160,clientY:540});
 $('presetDipole').emit('click',{detail:0});
 assert.equal(api.state().testCharges.length,0);assert.ok(particles.every(t=>t.trail.length===0));
 assert.equal(api.state().activeDrag,null);assert.equal(api.state().sourceDrag,null);assert.equal(api.state().placing,0);
 assert.equal($('chargeGhost').hidden,true);assert.equal($('testPlayback').hidden,true);
 assert.equal($('editBlock').hidden,false);assert.equal($('testBlock').hidden,true);
 api.placeTestCharge(0,100);assert.equal(api.state().testCharge.mass,.25);closeTo(api.state().testCharge.q,5e-6,1e-15);
});

function useWideBinTray($){
 $('chargeTray').rect={left:12,top:600,right:262,bottom:734,width:250,height:134};
 for(const [id,left] of [['addPositive',21],['addNegative',101],['addTest',181]])$(id).rect={left,top:609,right:left+72,bottom:673,width:72,height:64};
 $('trashZone').rect={left:21,top:681,right:253,bottom:725,width:232,height:44};
}

for(const kind of ['source','test']){
 test(`wide lower bin accepts ${kind} charges under every creation button and its padding`,()=>{
  for(const [clientX,clientY] of [[16,677],[50,700],[137,700],[220,700],[258,730]]){
   const {$,api,point}=openLab(true);if(kind==='test')api.placeTestCharge(0,100);useWideBinTray($);
   const particle=kind==='test'?api.state().testCharge:api.state().charges[0],canvas=$('fieldCanvas');
   canvas.emit('pointerdown',point(particle));canvas.emit('pointermove',{clientX,clientY});
   assert.equal($('trashZone').classList.contains('over'),true);
   canvas.emit('pointerup',{clientX,clientY});
   assert.equal(api.state().charges.length,kind==='source'?2:3);assert.equal(api.state().testCharges.length,0);
  }
 });
}

test('all three creation buttons are protected from deleting a dragged source charge',()=>{
 for(const [id,clientX] of [['addPositive',57],['addNegative',137],['addTest',217]]){
  const {$,api,point}=openLab(true);useWideBinTray($);const source=api.state().charges[0],canvas=$('fieldCanvas');
  canvas.emit('pointerdown',point(source));canvas.emit('pointermove',{clientX:160,clientY:540});
  $(id).emit('pointermove',{clientX,clientY:641});assert.equal($('trashZone').classList.contains('over'),false);
  $(id).emit('pointerup',{clientX,clientY:641});assert.equal(api.state().charges.length,3);assert.equal(api.state().testCharges.length,0);
  closeTo(point(source).clientX,160);closeTo(point(source).clientY,540);
 }
});

for(const compact of [false,true]){
 test(`${compact?'mobile':'desktop'}: the real page starts with an empty canvas and no selected charge`,()=>{
  const {$,api}=openLab(compact,{empty:true});
  assert.equal(api.state().charges.length,0);assert.equal(api.state().testCharges.length,0);assert.equal(api.state().selectedId,null);
  assert.equal($('editBlock').hidden,true);assert.equal($('testBlock').hidden,true);assert.equal($('chargePopover').hidden,true);assert.equal($('testPlayback').hidden,true);
  closeTo(api.fieldAt(100,100).mag,0);api.render();
  $('presetSingle').emit('click');assert.equal(api.state().charges.length,1);assert.equal($('editBlock').hidden,false);
 });
}

test('random configuration always completes with five spaced points even for an unlucky generator',()=>{
 const {$,api}=openLab(false,{empty:true,random:()=>.5});$('presetRandom').emit('click');
 const charges=api.state().charges;assert.equal(charges.length,5);
 for(let i=0;i<charges.length;i++)for(let j=i+1;j<charges.length;j++){
  assert.ok(Math.hypot(charges[i].x-charges[j].x,charges[i].y-charges[j].y)>=110);
  assert.notEqual(charges[i].x,charges[j].x);assert.notEqual(charges[i].y,charges[j].y);
 }
});
