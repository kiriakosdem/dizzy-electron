const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname, '../index.html'),'utf8');
const pageIds=new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g),m=>m[1]));
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Run the page's real handlers with deterministic layout and pointer capture.
function openLab(compact,{empty=false,random,startup=false,measureSidebar=false,devicePixelRatio=1}={}){
 const width=compact?390:1000,height=700,top=90;
 const elements=new Map(),windowListeners=new Map();
 let onCanvasResize;
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
  let context;
  return {id,hidden:id==='controlsBackdrop',dataset:{},style:{setProperty(){}},clientHeight:0,
   rect:{left:0,top:0,right:0,bottom:0,width:0,height:0},
   classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle(c,on){if(on===undefined)on=!classes.has(c);on?classes.add(c):classes.delete(c);},contains:c=>classes.has(c)},
   getBoundingClientRect(){
    if(measureSidebar&&id==='fieldCanvas'&&!compact&&!$('controlsPanel').hidden){
     const sidebarWidth=$('controlsPanel').rect.width;
     return {...this.rect,width:this.rect.width-sidebarWidth,right:this.rect.right-sidebarWidth};
    }
    return this.rect;
   },getClientRects(){return this.hidden?[]:[this.rect];},
   getContext(){return context??=canvasContext(this);},setAttribute(){},removeAttribute(){},focus(){},contains(){return false;},append(){},before(){},after(){},replaceChildren(){},
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
 let now=0;
 const drawnSprites=[],heatmapFrames=[],rasterizedSprites=[];
 const spriteCanvases=new WeakMap(),spriteBlends=new WeakMap();
 function canvasContext(destination){
  return new Proxy({
   globalAlpha:1,
   clearRect(){spriteBlends.delete(destination);},
   createImageData(width,height){return {data:new Uint8ClampedArray(width*height*4)};},
   putImageData(imageData){heatmapFrames.push({imageData,pixels:imageData.data.slice()});},
   drawImage(source,x,y,width,height){
    if(source.id==='sourceMoon'||source.id==='testAsteroid'){
     if(destination.id==='fieldCanvas')drawnSprites.push({id:source.id,width,center:{x:x+width/2,y:y+height/2}});
     else{spriteCanvases.set(destination,source.id);rasterizedSprites.push(source.id);}
     return;
    }
    const spriteId=spriteCanvases.get(source);
    if(spriteId){
     const blend=spriteBlends.get(destination)??{id:spriteId,size:source.width,layers:[]};
     blend.layers.push({x,y,alpha:this.globalAlpha,mode:this.globalCompositeOperation});
     spriteBlends.set(destination,blend);
     return;
    }
    const blend=spriteBlends.get(source);
    if(destination.id!=='fieldCanvas'||!blend)return;
    // Measure the centroid of the submitted weighted draws without rasterizing the art.
    const offset=blend.layers.reduce((point,layer)=>({
     x:point.x+layer.x*layer.alpha,y:point.y+layer.y*layer.alpha
    }),{x:0,y:0});
    const center={x:x+(blend.size/2+offset.x)*width/source.width,y:y+(blend.size/2+offset.y)*height/source.height};
    drawnSprites.push({...blend,width,center,blit:{x,y,width,height}});
   }
  },{get(target,key){
   if(key==='createRadialGradient'||key==='createLinearGradient')return ()=>({addColorStop(){}});
   return target[key]??(()=>{});
  }});
 }
 function $(id){assert.ok(pageIds.has(id)||id==='zoom','Unknown DOM id: '+id);if(!elements.has(id))elements.set(id,element(id));return elements.get(id);}
 for(const id of ['sourceMoon','testAsteroid'])Object.assign($(id),{complete:true,naturalWidth:256});
 function rect(id,left,y,w,h){$(id).rect={left,top:y,right:left+w,bottom:y+h,width:w,height:h};}
 rect('lab',0,top,width,height);rect('fieldCanvas',0,top,width,height);
 rect('controlsPanel',width-292,top,292,height);rect('controlsBackdrop',0,top,width,height);
 if(compact){
  rect('massTray',12,580,80,198);rect('addSource',19,587,66,56);rect('addTest',19,651,66,56);rect('trashZone',19,715,66,56);
 }else{
  rect('massTray',18,630,164,142);rect('addSource',31,643,64,72);rect('addTest',103,643,64,72);rect('trashZone',31,723,136,36);
 }
 rect('zoom',width-410,top+height-60,100,32);$('modeMessage').hidden=true;
 const controlsLayout=new Map([
  ['.lab-header',element()],['.lab-workspace',element()],
  ['.canvas-dock, .orbital-controls',$('canvasDock')],['.time-bar',$('testPlayback')]
 ]);
 const document={hidden:false,addEventListener(){},getElementById:$,createElement:()=>element(),querySelector:selector=>selector==='.zoom'?$('zoom'):controlsLayout.get(selector)??null,querySelectorAll:()=>[],
  elementFromPoint(){throw Error('Drop validation must not depend on the preview being absent from hit testing');}};
 const sandbox={document,window:{matchMedia:query=>({matches:!query.includes('prefers-reduced-motion')&&compact,addEventListener(){}}),devicePixelRatio,
  addEventListener(type,handler,options){if(!windowListeners.has(type))windowListeners.set(type,[]);windowListeners.get(type).push({handler,capture:options===true||!!options?.capture});}},ResizeObserver:class{constructor(callback){onCanvasResize=callback;}observe(){}},
  performance:{now:()=>now},requestAnimationFrame(){},getComputedStyle:()=>({visibility:'visible'}),HTMLInputElement:class{},HTMLTextAreaElement:class{},
  Path2D:class{moveTo(){}lineTo(){}arc(){}}};
 // These interaction tests run the standalone lab, outside a lesson iframe.
 sandbox.window.parent=sandbox.window;
 if(random){sandbox.Math=Object.create(Math);sandbox.Math.random=random;}
 vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(path.join(__dirname, "../../../assets/js/lab-scale.js"), "utf8"), sandbox);
 vm.runInContext(fs.readFileSync(path.join(__dirname, "../../../assets/js/lab-canvas.js"), "utf8"), sandbox);
 vm.runInContext(fs.readFileSync(path.join(__dirname, "../../../assets/js/lab-toggle.js"), "utf8"), sandbox);
 vm.runInContext(script.replace(/\}\)\(\);\s*$/,`globalThis.labTest={state:()=>({masses,selectedId,activeDrag,sourceDrag,camera,testMass:selectedTest()||null,testMasses,selectedTestId,placing,simulationPaused,collisionBursts}),seedSources:sources=>{masses=sources.map((c,i)=>createSourceMass({id:i+1,...c}));nextId=masses.length+1;selectedId=masses[0]?.id??null;testSelected=false;syncPanel();},toScreen,render,overWorkspace,testAcceleration,placeTestMass,advanceSimulation,sourceAccelerations,segmentContact,buildFieldLines,fieldAt,potentialAt,potentialColor,fieldLineSample,fieldLineFlow,advanceFieldLine,simulationSpeed:()=>simulationSpeed,setFixtureSpeed:()=>{simulationSpeed=100000;}};})();`),sandbox);
 const api=sandbox.labTest;
 // Run trajectory fixtures at a fixed rate independent of the startup preset.
 api.setFixtureSpeed();
 // Use a clean workspace for gesture fixtures that don't exercise startup.
 if(!startup){
  $('clear').emit('click');$('resetView').emit('click');
  if(!empty)api.seedSources([{x:-155,y:-15,mass:4.5},{x:155,y:-25,mass:4.5},{x:5,y:160,mass:2.6}]);
 }
 const point=c=>{const p=api.toScreen(c.x,c.y);return {clientX:p.x,clientY:p.y+top};};
 return {$,api,point,document,top,width,height,heatmapFrames,rasterizedSprites,emitWindow,resizeCanvas:onCanvasResize,drawAt(time,{advance=false}={}){
  now=time;drawnSprites.length=0;api.render(advance?time:undefined);return [...drawnSprites];
 },escape(){emitWindow('keydown',{key:'Escape'});}};
}

// Gravitational physics, units, and the controls that differ from the electric lab.
const earthGM=3.98600435507e14, metersPerAU=149597870700, metersPerUnit=metersPerAU/25, secondsPerYear=31557600;
const gridUnitsPerKm=1000/metersPerUnit;
const gravityAt100=earthGM/(100*metersPerUnit)**2;
const potentialAt100=-earthGM/(100*metersPerUnit);
function closeTo(actual,expected,tolerance=1e-18){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);}
function singleSourceLab(){const lab=openLab(false);lab.api.seedSources([{x:0,y:0,mass:4}]);return lab;}
function advanceSeconds(api,seconds,fps=60){for(let i=0;i<Math.round(seconds*fps);i++)api.advanceSimulation(1/fps);}

function timeReadout($) {
 const timer=$('timeReadout');
 return timer.querySelector('.time-value').textContent+' '+timer.querySelector('.time-unit').textContent;
}

test('single-row desktop tray deletes both kinds of mass on the Delete tile',()=>{
 for(const kind of ['source','test']){
  const {$,api,point}=openLab(false),canvas=$('fieldCanvas');
  if(kind==='test')api.placeTestMass(0,230);
  const body=kind==='test'?api.state().testMass:api.state().masses[0];
  $('massTray').rect={left:300,top:650,right:537,bottom:740,width:237,height:90};
  for(const [id,left] of [['addSource',309],['addTest',384],['trashZone',459]]){
   $(id).rect={left,top:659,right:left+72,bottom:731,width:72,height:72};
  }
  canvas.emit('pointerdown',point(body));
  canvas.emit('pointermove',{clientX:420,clientY:695});
  assert.equal($('trashZone').classList.contains('over'),false);
  canvas.emit('pointermove',{clientX:495,clientY:695});
  assert.equal($('trashZone').classList.contains('over'),true);
  canvas.emit('pointerup',{clientX:495,clientY:695});
  assert.equal(api.state().masses.length,kind==='source'?2:3);
  assert.equal(api.state().testMasses.length,0);
 }
});

test('field uses attractive Newtonian superposition, Earth masses, and metre distances',()=>{
 const {api}=singleSourceLab();
 closeTo(api.fieldAt(100,0).x,-gravityAt100*4);closeTo(api.fieldAt(100,0).y,0);
 closeTo(api.fieldAt(200,0).x,-gravityAt100);closeTo(api.fieldAt(-100,0).x,gravityAt100*4);
 closeTo(api.fieldAt(0,100).y,-gravityAt100*4);closeTo(api.testAcceleration(100,0).x,-gravityAt100*4/metersPerUnit);
 api.seedSources([{x:0,y:0,mass:8}]);closeTo(api.fieldAt(100,0).x,-gravityAt100*8);
 api.seedSources([{x:-100,y:0,mass:4},{x:100,y:0,mass:4}]);
 closeTo(api.fieldAt(0,0).mag,0);assert.ok(api.fieldAt(0,100).y<0);
 assert.ok(api.fieldAt(-50,0).x<0);assert.ok(api.fieldAt(50,0).x>0);
 assert.ok(Number.isFinite(api.fieldAt(100,0).mag));
});

test('potential is negative, adds at a field null, and has the correct gradient',()=>{
 const {api}=singleSourceLab();closeTo(api.potentialAt(100,0),potentialAt100*4);closeTo(api.potentialAt(200,0),potentialAt100*2);
 const h=.001,dPhi=(api.potentialAt(100+h,40)-api.potentialAt(100-h,40))/(2*h*metersPerUnit);
 closeTo(api.fieldAt(100,40).x,-dPhi,1e-12);
 assert.ok(Number.isFinite(api.potentialAt(0,0)));assert.ok(api.potentialAt(1000,0)>api.potentialAt(100,0));
 api.seedSources([{x:-100,y:0,mass:4},{x:100,y:0,mass:4}]);
 closeTo(api.fieldAt(0,0).mag,0);closeTo(api.potentialAt(0,0),potentialAt100*8);
 api.seedSources([]);closeTo(api.potentialAt(100,0),0);closeTo(api.fieldAt(100,0).mag,0);
});

test('field lines follow the same inward field even at very weak physical magnitudes',()=>{
 const {api}=singleSourceLab();
 for(const [x,y] of [[100,0],[-100,0],[0,100],[0,-100],[1800,1200]]){
  const field=api.fieldAt(x,y),sample=api.fieldLineSample(x,y),flow=api.fieldLineFlow(x,y,1);
  assert.ok(sample.valid);closeTo(sample.mag,field.mag);
  closeTo(flow.x,field.x/field.mag,1e-12);closeTo(flow.y,field.y/field.mag,1e-12);
  assert.ok(flow.x*x+flow.y*y<0);
  const next=api.advanceFieldLine(x,y,1,1);assert.ok(Math.hypot(next.x,next.y)<Math.hypot(x,y));
 }
 api.seedSources([{x:-100,y:0,mass:4},{x:100,y:0,mass:4}]);assert.equal(api.fieldLineSample(0,0).valid,false);
});

test('potential color grows blue toward deeper potential and fades to transparent at zero',()=>{
 const {api}=singleSourceLab(),strong=Array.from(api.potentialColor(potentialAt100*10)),weak=Array.from(api.potentialColor(potentialAt100));
 assert.deepEqual(strong.slice(0,3),[0,133,229]);assert.ok(strong[3]>weak[3]);assert.equal(api.potentialColor(0)[3],0);
});

test('test particles start at rest and accelerate toward a source visibly and gradually',()=>{
 const {api}=singleSourceLab();assert.equal(api.placeTestMass(100,0),true);
 const p=api.state().testMass;assert.equal(p.mass,.05);assert.equal(p.vx,0);assert.equal(p.vy,0);
 advanceSeconds(api,.1);assert.ok(p.x<100&&p.x>99);assert.ok(p.vx<0);closeTo(p.y,0);
});

test('test mass changes stored Earth masses but leaves acceleration and trajectory unchanged',()=>{
 const light=singleSourceLab(),heavy=singleSourceLab();
 light.api.placeTestMass(200,100);heavy.api.placeTestMass(200,100);
 for(const mass of [.01,.05,1]){
  heavy.$('massStrength').value=String(mass);heavy.$('massStrength').emit('input');
  assert.equal(heavy.api.state().testMass.mass,mass);
  closeTo(heavy.api.testAcceleration(200,100).x,light.api.testAcceleration(200,100).x);
 }
 advanceSeconds(light.api,1);advanceSeconds(heavy.api,1);
 for(const key of ['x','y','vx','vy'])closeTo(light.api.state().testMass[key],heavy.api.state().testMass[key]);
});

test('Verlet motion conserves gravitational mechanical energy before contact',()=>{
 const {api}=singleSourceLab();api.placeTestMass(200,100);const p=api.state().testMass;
 const energy=()=>.5*p.mass*((p.vx*metersPerUnit)**2+(p.vy*metersPerUnit)**2)+p.mass*api.potentialAt(p.x,p.y);
 const initial=energy();advanceSeconds(api,1);assert.equal(api.state().testMasses.length,1);
 assert.ok(Math.abs((energy()-initial)/initial)<1e-5);
});

test('time speed changes simulated elapsed time without changing the field or test mass',()=>{
 const {$,api}=openLab(false);api.seedSources([]);api.placeTestMass(0,0);const p=api.state().testMass;p.vx=100/(125*secondsPerYear);
 $('simulationSpeed').value='125';$('simulationSpeed').emit('input');
 advanceSeconds(api,1);closeTo(p.x,100,1e-8);
 $('simulationSpeed').value='200';$('simulationSpeed').emit('input');advanceSeconds(api,1);closeTo(p.x,260,1e-8);
 assert.equal(p.mass,.05);assert.equal($('simulationSpeedText').textContent,'1s = 200 yr');assert.match($('timeScaleHint').textContent,/200 simulated years/);
 for(const [input,expected] of [[-1,125*secondsPerYear],[0,125*secondsPerYear],[1e9,1600*secondsPerYear]]){
  $('simulationSpeed').value=String(input);$('simulationSpeed').emit('input');assert.equal(api.simulationSpeed(),expected);
 }
 const seeded=singleSourceLab(),field=seeded.api.fieldAt(100,0);
 seeded.$('simulationSpeed').value='80';seeded.$('simulationSpeed').emit('input');assert.deepEqual(seeded.api.fieldAt(100,0),field);
});

test('playback clock follows the simulation slider rate',()=>{
 const {$,api}=openLab(false,{empty:true});
 $('presetPair').emit('click');
 $('simulationSpeed').value='1600';$('simulationSpeed').emit('input');
 assert.equal($('simulationSpeed').value,'1600');
 advanceSeconds(api,1);
 assert.equal(timeReadout($),'1.60 kyr');
 $('pauseTest').emit('click');
 $('simulationSpeed').value='400';$('simulationSpeed').emit('input');
 assert.equal($('simulationSpeedText').textContent,'1s = 400 yr');
 advanceSeconds(api,1);
 assert.equal(timeReadout($),'1.60 kyr');
 $('pauseTest').emit('click');
 advanceSeconds(api,1);
 assert.equal(timeReadout($),'2.00 kyr');
 $('resetTest').emit('click');
 assert.equal(timeReadout($),'0.00 yr');
});

test('trajectories are independent of frame rate and display sensitivity',()=>{
 const slow=singleSourceLab(),fast=singleSourceLab();
 slow.$('sensitivity').value='.3';slow.$('sensitivity').emit('input');fast.$('sensitivity').value='4';fast.$('sensitivity').emit('input');
 slow.api.placeTestMass(200,100);fast.api.placeTestMass(200,100);advanceSeconds(slow.api,1,30);advanceSeconds(fast.api,1,144);
 for(const key of ['x','y','vx','vy'])closeTo(slow.api.state().testMass[key],fast.api.state().testMass[key],1e-10);
});

test('a lone source is unaffected by test particles',()=>{
 const together=singleSourceLab(),alone=singleSourceLab(),sources=JSON.stringify(together.api.state().masses),field=together.api.fieldAt(80,60);
 together.api.placeTestMass(200,100);const first=together.api.state().testMass;together.api.placeTestMass(200,-100);
 alone.api.placeTestMass(200,100);advanceSeconds(together.api,1);advanceSeconds(alone.api,1);
 for(const key of ['x','y','vx','vy'])closeTo(first[key],alone.api.state().testMass[key]);
 assert.equal(JSON.stringify(together.api.state().masses),sources);assert.deepEqual(together.api.fieldAt(80,60),field);
});

test('individual masses, pause, resume, reset and individual deletion preserve simulation state',()=>{
 const {$,api}=singleSourceLab();api.placeTestMass(200,100);const first=api.state().testMass;api.placeTestMass(200,-100);const second=api.state().testMass;
 $('massStrength').value='0.08';$('massStrength').emit('input');assert.equal(first.mass,.05);assert.equal(second.mass,.08);
 advanceSeconds(api,.2);$('pauseTest').emit('click');const frozen=JSON.stringify(api.state().testMasses);advanceSeconds(api,.5);assert.equal(JSON.stringify(api.state().testMasses),frozen);
 $('pauseTest').emit('click');const x=first.x;advanceSeconds(api,.2);assert.ok(first.x<x);
 $('resetTest').emit('click');assert.equal(first.x,200);assert.equal(first.y,100);assert.equal(second.y,-100);
 assert.ok(api.state().testMasses.every(t=>!t.running&&t.vx===0&&t.vy===0&&t.trail.length===1));
 api.placeTestMass(300,0);assert.equal(api.state().testMass.mass,.05);assert.equal(api.state().testMass.running,false);
 $('trashZone').emit('click',{detail:0});assert.equal(api.state().testMasses.length,2);
 $('clear').emit('click');assert.equal(api.state().testMasses.length,0);assert.equal(first.trail.length,0);assert.equal($('lab').classList.contains('test-active'),false);
});

test('contact, world edges and background frames handle particles without tunneling or catch-up jumps',()=>{
 const {$,api,document}=singleSourceLab();api.placeTestMass(-100,0);const p=api.state().testMass;p.vx=1;
 api.advanceSimulation(1/240);assert.equal(api.state().testMass,null);assert.equal(p.trail.length,0);assert.equal($('lab').classList.contains('test-active'),true);
 assert.equal(api.state().collisionBursts.length,1);closeTo(api.state().collisionBursts[0].x,-40,1e-9);
 api.seedSources([]);api.placeTestMass(1990,0);api.state().testMass.vx=1;api.advanceSimulation(1/240);assert.equal(api.state().testMass,null);
 assert.equal(api.state().collisionBursts.length,1);
 api.placeTestMass(0,0);api.state().testMass.vx=.001;
 document.hidden=true;api.advanceSimulation(60);assert.equal(api.state().testMass.x,0);
 document.hidden=false;api.advanceSimulation(60);closeTo(api.state().testMass.x,10,1e-8);
});

test('mass sliders synchronize, enforce positive masses and only strengthen attraction',()=>{
 const {$,api}=singleSourceLab(),source=api.state().masses[0];
 for(const [id,value,expected] of [['massStrength','0.62',.62],['canvasMassStrength','0',.01],['massStrength','-5',.01],['canvasMassStrength','50',1]]){
  $(id).value=value;$(id).emit('input');assert.equal(source.mass,expected);
  assert.equal($('massStrength').value,String(expected));assert.equal($('canvasMassStrength').value,String(expected));
  assert.equal($('strengthText').textContent,expected.toFixed(2));assert.equal($('canvasStrengthText').textContent,expected.toFixed(2));
  closeTo(api.fieldAt(100,0).x,-gravityAt100*expected);assert.ok(api.testAcceleration(100,0).x<0);
 }
});

test('the source moon and test asteroid resize with their mass sliders',()=>{
 const {$,api,drawAt}=openLab(false,{empty:true});
 api.seedSources([{x:0,y:0,mass:.01}]);
 const [smallSource]=drawAt(0);
 $('canvasMassStrength').value='1';$('canvasMassStrength').emit('input');
 const [largeSource]=drawAt(0);
 assert.equal(smallSource.id,'sourceMoon');
 assert.equal(largeSource.id,smallSource.id);
 assert.ok(smallSource.width>0&&largeSource.width>smallSource.width*2);
 api.placeTestMass(100,0);
 $('massStrength').value='.01';$('massStrength').emit('input');
 const [,smallTest]=drawAt(0);
 $('massStrength').value='1';$('massStrength').emit('input');
 const [,largeTest]=drawAt(0);
 assert.equal(smallTest.id,'testAsteroid');
 assert.equal(largeTest.id,smallTest.id);
 assert.ok(smallTest.width>0&&largeTest.width>smallTest.width*2&&largeTest.width<largeSource.width);
});

test('touch sprites preserve motion within a native pixel using a reusable raster',()=>{
 const dpr=2,{api,drawAt,rasterizedSprites}=openLab(true,{empty:true,devicePixelRatio:dpr});
 api.seedSources([{x:15.125,y:13.375,mass:.4}]);
 const [mass]=api.state().masses;
 function checkSprite(time){
  const [sprite]=drawAt(time),expected=api.toScreen(mass.x,mass.y);
  assert.equal(sprite.id,'sourceMoon');
  assert.ok(Number.isInteger(sprite.blit.x*dpr)&&Number.isInteger(sprite.blit.y*dpr));
  assert.equal(sprite.blit.width*dpr,sprite.size+1);
  assert.equal(sprite.blit.height*dpr,sprite.size+1);
  assert.deepEqual(sprite.layers.map(({x,y})=>[x,y]),[[0,0],[1,0],[0,1],[1,1]]);
  assert.ok(sprite.layers.every(({alpha,mode})=>alpha>0&&mode==='lighter'));
  closeTo(sprite.layers.reduce((sum,{alpha})=>sum+alpha,0),1,1e-12);
  closeTo(sprite.center.x,expected.x,1e-12);
  closeTo(sprite.center.y,expected.y,1e-12);
  return sprite;
 }
 const before=checkSprite(0);
 mass.x+=.08;mass.y-=.10;
 const after=checkSprite(16);
 assert.deepEqual(after.blit,before.blit);
 assert.notDeepEqual(after.layers,before.layers);
 assert.deepEqual(rasterizedSprites,['sourceMoon']);
});

test('presets use positive masses, cancellation at a pair midpoint, and evenly spaced rows',()=>{
 const {$,api}=openLab(false);
 $('presetSingle').emit('click');assert.equal(api.state().masses.length,1);assert.equal(api.state().masses[0].mass,.4);
 $('presetPair').emit('click');assert.equal(api.state().masses.length,2);assert.ok(api.state().masses.every(c=>c.mass===.4));closeTo(api.fieldAt(0,0).mag,0);assert.ok(api.potentialAt(0,0)<0);
 $('presetRow').emit('click');const row=api.state().masses;assert.equal(row.length,5);assert.ok(row.every(c=>c.mass===.3&&c.y===0));
 for(let i=1;i<row.length;i++)assert.equal(row[i].x-row[i-1].x,120);
});

test('random presets always produce five separated positive masses',()=>{
 for(const random of [undefined,()=>.5]){
  const {$,api}=openLab(false,{random});
  for(let run=0;run<5;run++){
   $('presetRandom').emit('click');const masses=api.state().masses;assert.equal(masses.length,5);
   assert.ok(masses.every(c=>c.mass>0&&c.mass<=1));
   for(let i=0;i<masses.length;i++)for(let j=i+1;j<masses.length;j++){
    assert.ok(Math.hypot(masses[i].x-masses[j].x,masses[i].y-masses[j].y)>=110);
    assert.ok(Math.abs(masses[i].x-masses[j].x)>=20);assert.ok(Math.abs(masses[i].y-masses[j].y)>=20);
   }
  }
 }
});

test('step pauses the orbital pair and advances the sources and test masses together',()=>{
 const {$,api,emitWindow}=openLab(false,{startup:true});
 $('simulationSpeed').value='150';$('simulationSpeed').emit('input');
 const source=api.state().masses[0],sourceY=source.y;
 api.placeTestMass(0,230);
 const probe=api.state().testMass;
 assert.equal(emitWindow('keydown',{key:'.'}).defaultPrevented,true);
 assert.equal(api.state().simulationPaused,true);
 assert.notEqual(source.y,sourceY);
 assert.ok(probe.y<230);
 assert.equal(probe.running,false);
 assert.equal(timeReadout($),'2.50 yr');
 api.advanceSimulation(.1);
 assert.equal(timeReadout($),'2.50 yr');
 assert.equal(emitWindow('keydown',{key:'.'}).defaultPrevented,true);
 assert.equal(timeReadout($),'5.00 yr');
});

for(const compact of [false,true]){
 test(`${compact?'mobile':'desktop'}: the running orbital pair and all presets fit the canvas`,()=>{
  const {$,api,point,top,width,height,resizeCanvas}=openLab(compact,{startup:true,measureSidebar:true});
  assert.deepEqual(Array.from(api.state().masses,c=>c.mass),[.4,.4]);
  assert.equal(api.state().simulationPaused,false);
  const initialVisibleWidth=width-($('controlsPanel').hidden?0:292);
  for(const mass of api.state().masses){
   const p=point(mass);assert.ok(p.clientX>=40&&p.clientX<=initialVisibleWidth-40);assert.ok(p.clientY-top>=40&&p.clientY-top<=height-40);
  }
  api.render();
  for(const id of ['presetSingle','presetPair','presetRow','presetRandom']){
   const {x,y,zoom}=api.state().camera;
   $('controlsToggle').emit('click');resizeCanvas();
   assert.equal(point({x,y}).clientX,$('fieldCanvas').getBoundingClientRect().width/2);
   assert.equal(point({x,y}).clientY,top+height/2);
   assert.equal(api.state().camera.zoom,zoom);
   $(id).emit('click');
   const visibleWidth=width-($('controlsPanel').hidden?0:292);
   for(const c of api.state().masses){const p=point(c);assert.ok(p.clientX>=40&&p.clientX<=visibleWidth-40);assert.ok(p.clientY-top>=40&&p.clientY-top<=height-40);}
   if(compact)assert.equal($('controlsPanel').hidden,true);
   assert.equal(api.state().testMasses.length,0);api.placeTestMass(700,700);
  }
 });
 test(`${compact?'mobile':'desktop'}: test-particle dragging, cancellation and keyboard placement work`,()=>{
  const {$,api,point,escape}=openLab(compact);api.seedSources([]);const canvas=$('fieldCanvas');
  $('addTest').emit('click',{detail:0});canvas.emit('keydown',{key:'Enter'});assert.equal(api.state().testMasses.length,1);
  const first=api.state().testMass;first.vx=.0001;advanceSeconds(api,.1);
  const before=JSON.stringify(first);canvas.emit('pointerdown',point(first));canvas.emit('pointermove',{clientX:160,clientY:540});escape();assert.equal(JSON.stringify(first),before);
  canvas.emit('pointerdown',point(first));canvas.emit('pointerup',{clientX:160,clientY:540});
  closeTo(point(first).clientX,160,1e-8);closeTo(point(first).clientY,540,1e-8);assert.equal(first.vx,.0001);assert.equal(first.trail.length,1);
  canvas.emit('pointerdown',point(first));canvas.emit('pointerup',center($('trashZone')));assert.equal(api.state().testMasses.length,0);
 });
 test(`${compact?'mobile':'desktop'}: source coordinates, zoom, and floating mass editor remain functional`,()=>{
  const {$,api,point}=openLab(compact),c=api.state().masses[0],canvas=$('fieldCanvas');
  $('massX').value=String(100*metersPerUnit/149597870700);$('massX').emit('change');$('massY').value=String(50*metersPerUnit/149597870700);$('massY').emit('keydown',{key:'Enter'});closeTo(c.x,100,1e-12);closeTo(c.y,50,1e-12);
  const camera=JSON.stringify(api.state().camera);canvas.emit('wheel',{...point(c),deltaY:100});assert.notEqual(JSON.stringify(api.state().camera),camera);assert.equal(api.state().selectedId,c.id);
  canvas.emit('pointermove',point(c));api.render();assert.equal($('massPopover').hidden,false);
  $('canvasMassStrength').value='0.25';$('canvasMassStrength').emit('input');assert.equal(c.mass,.25);closeTo(c.x,100,1e-12);closeTo(c.y,50,1e-12);
  assert.equal(api.state().activeDrag,null);
 });
}

test('legend follows independent arrow and line toggles and exclusive heatmap modes',()=>{
 const {$}=openLab(false);$('potentialToggle').emit('click');assert.equal($('gravitationalFieldLegend').hidden,false);assert.equal($('potentialLegend').hidden,false);
 $('fieldArrowsToggle').emit('click');assert.equal($('gravitationalFieldLegend').hidden,true);
 $('fieldLinesToggle').emit('click');assert.equal($('gravitationalFieldLegend').hidden,false);
 $('heatmapToggle').emit('click');assert.equal($('potentialLegend').hidden,true);
 $('fieldLinesToggle').emit('click');
 assert.equal($('gravitationalFieldLegend').hidden,true);
 assert.equal($('strengthLegend').hidden,false);
 assert.equal($('fieldLegend').hidden,false);
 $('heatmapToggle').emit('click');
 assert.equal($('strengthLegend').hidden,true);
 assert.equal($('fieldLegend').hidden,true);
});

test('mobile: the heatmap follows a moving mass and reuses the same pixel buffer',()=>{
 const {$,api,drawAt,heatmapFrames}=openLab(true,{empty:true});
 api.seedSources([{x:0,y:0,mass:.4,vx:.001}]);
 $('heatmapToggle').emit('click');
 drawAt(0);
 drawAt(16);
 assert.equal(heatmapFrames.length,1);

 api.advanceSimulation(.1);
 assert.ok(api.state().masses[0].x>0);
 drawAt(100);
 assert.equal(heatmapFrames.length,2);
 const [before,after]=heatmapFrames;
 assert.equal(after.imageData,before.imageData);
 assert.notDeepEqual(after.pixels,before.pixels);
});

function center(element){const r=element.getBoundingClientRect();return {clientX:r.left+r.width/2,clientY:r.top+r.height/2};}

test('two source masses accelerate toward each other without any test particles',()=>{
 const {$,api}=openLab(false,{empty:true});$('presetPair').emit('click');const [a,b]=api.state().masses;
 assert.equal($('lab').classList.contains('test-active'),true);const forces=api.sourceAccelerations();assert.ok(forces[0].x>0);assert.ok(forces[1].x<0);
 closeTo(forces[0].x,-forces[1].x);advanceSeconds(api,.2);
 assert.ok(a.x>-120&&b.x<120);assert.ok(a.vx>0&&b.vx<0);assert.equal(api.state().testMasses.length,0);
 closeTo(a.x,-b.x,1e-10);closeTo(a.vx,-b.vx,1e-12);
});

test('unequal source masses conserve total momentum and center of mass',()=>{
 const {api}=openLab(false,{empty:true});api.seedSources([{x:-300,y:0,mass:2},{x:100,y:0,mass:6}]);
 const before=api.sourceAccelerations();closeTo(before[0].x,-3*before[1].x);advanceSeconds(api,.5);
 const [a,b]=api.state().masses;assert.ok(a.x>-300&&b.x<100);
 closeTo(a.mass*a.vx+b.mass*b.vx,0,1e-12);closeTo(a.mass*a.x+b.mass*b.x,0,1e-8);
});

test('source integration conserves mechanical energy before collision',()=>{
 const {api}=openLab(false,{empty:true});api.seedSources([{x:-150,y:0,mass:3},{x:150,y:0,mass:7}]);
 const energy=()=>{const [a,b]=api.state().masses;return .5*a.mass*((a.vx*metersPerUnit)**2+(a.vy*metersPerUnit)**2)+.5*b.mass*((b.vx*metersPerUnit)**2+(b.vy*metersPerUnit)**2)-earthGM*a.mass*b.mass/(Math.hypot(a.x-b.x,a.y-b.y)*metersPerUnit);};
 const initial=energy();advanceSeconds(api,.4);assert.equal(api.state().masses.length,2);assert.ok(Math.abs((energy()-initial)/initial)<1e-5);
});

test('a source never accelerates under its own field and coasts with its existing velocity',()=>{
 const {api}=singleSourceLab();const c=api.state().masses[0];c.vx=.001;c.vy=-.0002;
 closeTo(api.sourceAccelerations()[0].x,0);closeTo(api.sourceAccelerations()[0].y,0);advanceSeconds(api,.2);
 closeTo(c.x,20,1e-9);closeTo(c.y,-4,1e-9);closeTo(c.vx,.001);
});

test('source trajectories are unchanged by test mass, placement, absorption, or deletion',()=>{
 const without=openLab(false,{empty:true}),withTests=openLab(false,{empty:true});
 for(const lab of [without,withTests]){
  lab.api.seedSources([{x:-300,y:0,mass:3},{x:300,y:0,mass:7}]);
  lab.$('simulationSpeed').value='400';lab.$('simulationSpeed').emit('input');
 }
 withTests.api.placeTestMass(-250,0);withTests.$('massStrength').value='0.01';withTests.$('massStrength').emit('input');
 advanceSeconds(without.api,4);advanceSeconds(withTests.api,4);
 assert.equal(withTests.api.state().testMasses.length,0,'The first probe must actually be absorbed during this comparison');
 withTests.api.placeTestMass(0,300);withTests.$('trashZone').emit('click',{detail:0});
 advanceSeconds(without.api,.2);advanceSeconds(withTests.api,.2);
 for(let i=0;i<2;i++)for(const key of ['x','y','vx','vy','mass'])closeTo(withTests.api.state().masses[i][key],without.api.state().masses[i][key],1e-10);
});

test('source and test trajectories stay in sync across render frame rates',()=>{
 const low=openLab(false,{empty:true}),high=openLab(false,{empty:true});
 for(const lab of [low,high]){lab.api.seedSources([{x:-200,y:0,mass:3},{x:200,y:0,mass:5}]);lab.api.placeTestMass(0,300);}
 advanceSeconds(low.api,.5,30);advanceSeconds(high.api,.5,144);
 for(let i=0;i<2;i++)for(const key of ['x','y','vx','vy'])closeTo(low.api.state().masses[i][key],high.api.state().masses[i][key],1e-10);
 for(const key of ['x','y','vx','vy'])closeTo(low.api.state().testMass[key],high.api.state().testMass[key],1e-10);
});

test('mobile: source and probe sprites move smoothly between physics steps and snap on pause and reset',()=>{
 const {$,api,drawAt}=openLab(true,{empty:true});
 const paths=[{x:-140,y:80,vx:.003,vy:.002},{x:120,y:-80,vx:.002,vy:-.001}];
 const [sourcePath,probePath]=paths;
 api.seedSources([{...sourcePath,mass:.01}]);
 assert.equal(api.placeTestMass(probePath.x,probePath.y),true);
 Object.assign(api.state().testMass,{vx:probePath.vx,vy:probePath.vy});

 const step=1/240,rate=api.simulationSpeed();
 function checkSprites(time,elapsed){
  const sprites=drawAt(time,{advance:true});
  assert.equal(sprites.length,paths.length);
  for(const [i,{x,y,vx,vy}] of paths.entries()){
   const expected=api.toScreen(x+vx*elapsed*rate,y+vy*elapsed*rate);
   closeTo(sprites[i].center.x,expected.x,1e-7);
   closeTo(sprites[i].center.y,expected.y,1e-7);
  }
 }

 for(const time of [0,2,7,11,15,28,40])checkSprites(time,Math.max(0,time/1000-step));
 const fixedElapsed=Math.floor(.040/step)*step;
 const {masses:[source],testMass:probe}=api.state();
 closeTo(source.x,sourcePath.x+sourcePath.vx*fixedElapsed*rate,1e-7);
 closeTo(probe.x,probePath.x+probePath.vx*fixedElapsed*rate,1e-7);
 $('pauseTest').emit('click');
 checkSprites(45,fixedElapsed);
 checkSprites(65,fixedElapsed);
 $('pauseTest').emit('click');
 checkSprites(70,fixedElapsed);
 checkSprites(72,fixedElapsed);
 checkSprites(83,fixedElapsed+.013-step);
 $('resetTest').emit('click');
 checkSprites(90,0);
 checkSprites(110,0);
});

test('source mergers conserve mass and momentum and reset restores the unmerged arrangement',()=>{
 const {$,api}=openLab(false,{empty:true});api.seedSources([{x:-100,y:0,mass:2,vx:.5},{x:100,y:0,mass:6,vx:-.1}]);
 api.advanceSimulation(1/240);assert.equal(api.state().masses.length,1);const merged=api.state().masses[0];
 assert.equal(merged.mass,8);closeTo(merged.mass*merged.vx,.4,1e-12);closeTo(merged.x,50+.05*100000/240,1e-9);
 $('resetTest').emit('click');assert.equal(api.state().masses.length,2);assert.equal(api.state().simulationPaused,true);
 assert.deepEqual(Array.from(api.state().masses,c=>[c.x,c.y,c.mass,c.vx,c.vy]),[[-100,0,2,.5,0],[100,0,6,-.1,0]]);
 $('pauseTest').emit('click');advanceSeconds(api,.1);assert.ok(api.state().masses[0].x>-100);
});

test('source mergers use the bodies’ radii and create a burst that expires during pause',()=>{
 const {$,api,drawAt}=openLab(false,{empty:true});
 api.seedSources([{x:0,y:0,mass:.01},{x:32,y:0,mass:.01}]);
 api.advanceSimulation(1/240);
 assert.equal(api.state().masses.length,2);
 assert.equal(api.state().collisionBursts.length,0);
 $('massStrength').value='1';$('massStrength').emit('input');
 const [before]=drawAt(0);
 api.advanceSimulation(1/240);
 assert.equal(api.state().masses.length,1);
 const [burst]=api.state().collisionBursts;
 assert.ok(burst.x>23&&burst.x<26);
 closeTo(burst.y,0);
 $('pauseTest').emit('click');
 assert.ok(drawAt(200)[0].width>before.width);
 assert.equal(api.state().collisionBursts.length,1);
 drawAt(800);
 assert.equal(api.state().collisionBursts.length,0);
 $('resetTest').emit('click');
 $('pauseTest').emit('click');api.advanceSimulation(1/240);
 assert.equal(api.state().collisionBursts.length,1);
 $('resetTest').emit('click');
 assert.equal(api.state().collisionBursts.length,0);
});

test('mergers conserve mass above one Earth mass while keeping both sliders capped',()=>{
 const {$,api}=openLab(false,{empty:true});api.seedSources([{x:0,y:0,mass:1},{x:0,y:0,mass:1},{x:0,y:0,mass:1}]);
 api.advanceSimulation(1/240);const merged=api.state().masses[0];assert.equal(api.state().masses.length,1);assert.equal(merged.mass,3);
 assert.ok(['x','y','vx','vy'].every(key=>Number.isFinite(merged[key])));
 assert.equal($('massStrength').value,'1');assert.equal($('canvasMassStrength').value,'1');
 assert.equal($('strengthText').textContent,'3.00');assert.equal($('canvasStrengthText').textContent,'3.00');
 $('massStrength').value='0.75';$('massStrength').emit('input');$('resetTest').emit('click');
 assert.equal(api.state().masses.length,3);assert.ok(api.state().masses.every(c=>c.mass===.25));
});

test('a moving source absorbs a probe it sweeps through even when the endpoints miss it',()=>{
 const {api}=openLab(false,{empty:true});api.seedSources([{x:-100,y:0,mass:4,vx:.5}]);api.placeTestMass(0,0);const probe=api.state().testMass;
 api.advanceSimulation(1/240);assert.equal(api.state().testMasses.length,0);assert.equal(probe.trail.length,0);assert.ok(api.state().masses[0].x>100);
});

test('sidebar position edits move only the selected test mass and survive reset',()=>{
 const {$,api}=singleSourceLab();api.placeTestMass(200,0);const first=api.state().testMass;
 api.placeTestMass(300,0);const second=api.state().testMass;
 $('massX').value='0';$('massX').emit('change');assert.equal(second.x,300,'cannot move onto a source');
 $('massX').value='1.5';$('massX').emit('change');assert.equal(second.x,300,'cannot overlap the edge of a source');
 $('massX').value='2.5';$('massX').emit('change');
 const x=2.5*metersPerAU/metersPerUnit;
 closeTo(second.x,x,1e-12);assert.equal(first.x,200);
 $('resetTest').emit('click');closeTo(second.x,x,1e-12);assert.equal($('massX').value,'2.5');
});

test('pause, speed and reset work in a scene containing only source masses',()=>{
 const {$,api}=openLab(false,{empty:true});$('presetPair').emit('click');
 $('pauseTest').emit('click');const frozen=JSON.stringify(api.state().masses);advanceSeconds(api,.5);assert.equal(JSON.stringify(api.state().masses),frozen);
 assert.equal($('editBlock').hidden,false);
 $('simulationSpeed').value='200';$('simulationSpeed').emit('input');$('pauseTest').emit('click');advanceSeconds(api,.2);assert.notEqual(JSON.stringify(api.state().masses),frozen);
 $('resetTest').emit('click');assert.equal(api.state().masses[0].x,-120);assert.equal(api.state().masses[1].x,120);assert.equal(api.state().simulationPaused,true);
});

for(const compact of [false,true]){
 const layout=compact?'mobile':'desktop';
 test(`${layout}: source tray drag survives lost capture and creates one mass at rest`,()=>{
  const {$,api}=openLab(compact,{empty:true}),button=$('addSource');button.emit('pointerdown',center(button));button.emit('pointermove',{clientX:160,clientY:540});button.releasePointerCapture(1);
  $('fieldCanvas').emit('pointerup',{clientX:160,clientY:540});$('fieldCanvas').emit('dblclick',{clientX:160,clientY:540});
  assert.equal(api.state().masses.length,1);assert.equal(api.state().masses[0].mass,.4);assert.equal(api.state().masses[0].vx,0);assert.equal($('lab').classList.contains('test-active'),true);
 });
 test(`${layout}: source dragging freezes motion and preserves grab offset and velocity`,()=>{
  const {$,api,point}=openLab(compact),c=api.state().masses[0],canvas=$('fieldCanvas');c.vx=.001;
  const p=point(c),other=api.state().masses[1],otherX=other.x;
  canvas.emit('pointerdown',{clientX:p.clientX-8,clientY:p.clientY});canvas.emit('pointermove',{clientX:160,clientY:540});advanceSeconds(api,.2);assert.equal(other.x,otherX);
  canvas.emit('pointerup',{clientX:160,clientY:540});closeTo(point(c).clientX,168,1e-8);closeTo(point(c).clientY,540,1e-8);assert.equal(c.vx,.001);
  const x=c.x,y=c.y;$('resetTest').emit('click');const reset=api.state().masses.find(m=>m.id===c.id);assert.equal(reset.x,x);assert.equal(reset.y,y);
 });
 test(`${layout}: Escape restores a moving source and its velocity after pickup`,()=>{
  const {$,api,point,escape}=openLab(compact),c=api.state().masses[0],canvas=$('fieldCanvas');c.vx=.001;const before=JSON.stringify(c);
  canvas.emit('pointerdown',point(c));canvas.emit('pointermove',{clientX:160,clientY:540});escape();assert.equal(JSON.stringify(c),before);
 });
 test(`${layout}: both tray tools are protected and the delete button plus padding accept drops`,()=>{
  for(const target of ['addSource','addTest','trashZone','padding']){
   const {$,api,point}=openLab(compact),c=api.state().masses[0],canvas=$('fieldCanvas');canvas.emit('pointerdown',point(c));canvas.emit('pointermove',{clientX:160,clientY:540});
   const tray=$('massTray').rect,p=target==='padding'?{clientX:tray.left+2,clientY:tray.bottom-2}:center($(target));
   canvas.emit('pointermove',p);const deleted=target==='trashZone'||target==='padding';assert.equal($('trashZone').classList.contains('over'),deleted);
   canvas.releasePointerCapture(1);$('trashZone').emit('pointerup',p);$('trashZone').emit('click',p);assert.equal(api.state().masses.length,deleted?2:3);
  }
 });
 test(`${layout}: cancelling tray placement adds nothing and a keyboard tap still enables placement`,()=>{
  const {$,api}=openLab(compact,{empty:true}),source=$('addSource');source.emit('pointerdown',center(source));source.emit('pointermove',{clientX:160,clientY:540});source.emit('pointercancel',{clientX:160,clientY:540});
  assert.equal(api.state().masses.length,0);source.emit('click',{detail:0});assert.equal(api.state().placing,.4);assert.equal($('modeMessage').hidden,false);
  $('fieldCanvas').emit('pointerdown',{clientX:160,clientY:540});$('fieldCanvas').emit('pointerup',{clientX:160,clientY:540});assert.equal(api.state().masses.length,1);
 });
}

function momentum(bodies){return {x:bodies.reduce((n,c)=>n+c.mass*c.vx,0),y:bodies.reduce((n,c)=>n+c.mass*c.vy,0)};}
function energy(bodies){
 let value=bodies.reduce((sum,c)=>sum+.5*c.mass*((c.vx*metersPerUnit)**2+(c.vy*metersPerUnit)**2),0);
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)value-=earthGM*bodies[i].mass*bodies[j].mass/(Math.hypot(bodies[i].x-bodies[j].x,bodies[i].y-bodies[j].y)*metersPerUnit);
 return value;
}
function setVelocity($,x,y){$('velocityX').value=String(x);$('velocityY').value=String(y);$('velocityX').emit('keydown',{key:'Enter'});}

test('the pair has the circular-orbit speed and remains in orbit over three periods',()=>{
 const {$,api}=openLab(false,{empty:true});$('presetPair').emit('click');const initial=Array.from(api.state().masses,c=>({...c})),v=Math.sqrt(earthGM*.4/(2*240*metersPerUnit))/metersPerUnit;
 closeTo(initial[0].vx,0);closeTo(initial[0].vy,-v);closeTo(initial[1].vy,v);closeTo(momentum(initial).y,0);
  $('simulationSpeed').value='125';$('simulationSpeed').emit('input');
 const initialEnergy=energy(initial),period=2*Math.PI*120/v/api.simulationSpeed();
 for(let frame=0;frame<Math.ceil(3*period*60);frame++){
  api.advanceSimulation(1/60);const bodies=api.state().masses;assert.equal(bodies.length,2);
  closeTo(Math.hypot(bodies[0].x-bodies[1].x,bodies[0].y-bodies[1].y),240,.02);
 }
 assert.ok(Math.abs((energy(api.state().masses)-initialEnergy)/initialEnergy)<1e-6);
 closeTo(momentum(api.state().masses).x,0,1e-12);closeTo(momentum(api.state().masses).y,0,1e-12);
 $('resetTest').emit('click');for(let i=0;i<2;i++)for(const key of ['x','y','vx','vy'])closeTo(api.state().masses[i][key],initial[i][key]);
});

test('row starts with angular momentum, zero bulk drift and negative total energy',()=>{
 const {$,api}=openLab(false,{empty:true});$('presetRow').emit('click');const bodies=api.state().masses;
 assert.ok(bodies[0].vy<0);assert.ok(bodies.at(-1).vy>0);assert.equal(bodies[2].vy,0);
 const angular=bodies.reduce((sum,c)=>sum+c.mass*(c.x*c.vy-c.y*c.vx),0);assert.ok(angular>0);
 closeTo(momentum(bodies).x,0,1e-12);closeTo(momentum(bodies).y,0,1e-12);assert.ok(energy(bodies)<0);
 advanceSeconds(api,.1);assert.ok(bodies[0].y<0&&bodies.at(-1).y>0);
});

test('random presets have varied finite velocities, zero momentum and bound initial energy',()=>{
 for(const random of [undefined,()=>.5]){
  const {$,api}=openLab(false,{empty:true,random});
  for(let trial=0;trial<4;trial++){
   $('presetRandom').emit('click');const bodies=api.state().masses;
   assert.ok(bodies.every(c=>Number.isFinite(c.vx)&&Number.isFinite(c.vy)));
   assert.ok(new Set(bodies.map(c=>c.vx+','+c.vy)).size>1);assert.ok(bodies.some(c=>Math.hypot(c.vx,c.vy)>0));
   closeTo(momentum(bodies).x,0,1e-12);closeTo(momentum(bodies).y,0,1e-12);assert.ok(energy(bodies)<0);
  }
 }
});

test('single preset drifts with its configured velocity and reset restores that velocity',()=>{
 const {$,api}=openLab(false,{empty:true});$('presetSingle').emit('click');const c=api.state().masses[0],vx=c.vx,vy=c.vy;assert.ok(vx>0&&vy>0);
 advanceSeconds(api,.1);closeTo(c.x,vx*10000,1e-8);closeTo(c.y,vy*10000,1e-8);
 $('resetTest').emit('click');const reset=api.state().masses[0];assert.equal(reset.x,0);assert.equal(reset.y,0);assert.equal(reset.vx,vx);assert.equal(reset.vy,vy);
});

for(const compact of [false,true]){
 const layout=compact?'mobile':'desktop';
 test(`${layout}: velocity input pauses motion and changes only the selected source in correct units`,()=>{
  const {$,api,document}=openLab(compact),source=api.state().masses[0],other=api.state().masses[1],beforeOther=JSON.stringify(other),field=api.fieldAt(100,0);
  document.activeElement=$('velocityX');$('velocityX').emit('focus');assert.equal(api.state().simulationPaused,true);
  $('velocityX').value='-4.5';$('velocityY').value='7.25';$('velocityX').emit('change');
  closeTo(source.vx,-4.5*gridUnitsPerKm);closeTo(source.vy,7.25*gridUnitsPerKm);assert.equal(JSON.stringify(other),beforeOther);assert.deepEqual(api.fieldAt(100,0),field);
  assert.equal($('velocityX').value,'-4.5');assert.equal($('velocityY').value,'7.25');
  const initial=source.resetMembers[0];closeTo(initial.vx,source.vx);closeTo(initial.vy,source.vy);
  const x=source.x,y=source.y;advanceSeconds(api,.1);assert.equal(source.x,x);assert.equal(source.y,y);
  document.activeElement=null;$('pauseTest').emit('click');advanceSeconds(api,.1);assert.notEqual(source.y,y);
  $('resetTest').emit('click');const reset=api.state().masses.find(c=>c.id===source.id);assert.equal(reset.x,x);assert.equal(reset.y,y);closeTo(reset.vx,-4.5*gridUnitsPerKm);closeTo(reset.vy,7.25*gridUnitsPerKm);
 });
 test(`${layout}: each test particle has an independent velocity and reset reuses its launch vector`,()=>{
  const {$,api}=openLab(compact,{empty:true});api.placeTestMass(0,0);const first=api.state().testMass;setVelocity($,3,-4);
  api.placeTestMass(100,100);const second=api.state().testMass;setVelocity($,-2,5);
  assert.equal($('velocityBlock').hidden,false);closeTo(first.vx,3*gridUnitsPerKm);closeTo(first.vy,-4*gridUnitsPerKm);closeTo(second.vx,-2*gridUnitsPerKm);closeTo(second.vy,5*gridUnitsPerKm);
  $('pauseTest').emit('click');advanceSeconds(api,.1);closeTo(first.x,3*gridUnitsPerKm*10000,1e-8);closeTo(first.y,-4*gridUnitsPerKm*10000,1e-8);closeTo(second.x,100+-2*gridUnitsPerKm*10000,1e-8);closeTo(second.y,100+5*gridUnitsPerKm*10000,1e-8);
  $('resetTest').emit('click');assert.equal(first.x,0);assert.equal(first.y,0);assert.equal(second.x,100);assert.equal(second.y,100);closeTo(first.vx,3*gridUnitsPerKm);closeTo(second.vy,5*gridUnitsPerKm);
 });
 test(`${layout}: repositioning keeps the configured launch velocity for sources and test particles`,()=>{
  const {$,api,point}=openLab(compact),canvas=$('fieldCanvas'),source=api.state().masses[0];setVelocity($,2,3);
  canvas.emit('pointerdown',point(source));canvas.emit('pointerup',{clientX:160,clientY:540});closeTo(source.vx,2*gridUnitsPerKm);closeTo(source.vy,3*gridUnitsPerKm);
  const sourceX=source.x,sourceY=source.y;api.placeTestMass(0,100);const probe=api.state().testMass;setVelocity($,5,-6);
  canvas.emit('pointerdown',point(probe));canvas.emit('pointerup',{clientX:200,clientY:500});closeTo(probe.vx,5*gridUnitsPerKm);closeTo(probe.vy,-6*gridUnitsPerKm);
  const probeX=probe.x,probeY=probe.y;$('resetTest').emit('click');const reset=api.state().masses.find(c=>c.id===source.id);
  closeTo(reset.x,sourceX);closeTo(reset.y,sourceY);closeTo(reset.vx,2*gridUnitsPerKm);closeTo(probe.x,probeX);closeTo(probe.y,probeY);closeTo(probe.vy,-6*gridUnitsPerKm);
 });
}

test('velocity validation rejects blanks/nonfinite values, clamps extremes and supports stop',()=>{
 const {$,api}=singleSourceLab(),c=api.state().masses[0];setVelocity($,3,4);
 for(const [x,y] of [['','3'],['NaN','3'],['3','Infinity'],['3','']]){setVelocity($,x,y);closeTo(c.vx,3*gridUnitsPerKm);closeTo(c.vy,4*gridUnitsPerKm);}
 setVelocity($,5000,-5000);closeTo(c.vx,1000*gridUnitsPerKm);closeTo(c.vy,-1000*gridUnitsPerKm);assert.equal($('velocityX').value,'1000');assert.equal($('velocityY').value,'-1000');
 $('stopSelected').emit('click');assert.equal(c.vx,0);assert.equal(c.vy,0);assert.equal($('velocitySpeedText').textContent,'0 km/s');assert.equal(api.state().simulationPaused,true);
 $('resetTest').emit('click');assert.equal(api.state().masses[0].vx,0);assert.equal(api.state().masses[0].vy,0);
});

test('Escape discards an uncommitted velocity edit without closing the inspector',()=>{
 const {$,api,document}=singleSourceLab();setVelocity($,3,4);document.activeElement=$('velocityX');$('velocityX').emit('focus');$('velocityX').value='9';
 const escaped=$('velocityX').emit('keydown',{key:'Escape'});assert.equal(escaped.stopped,true);assert.equal($('velocityX').value,'3');closeTo(api.state().masses[0].vx,3*gridUnitsPerKm);
 assert.equal($('velocityBlock').hidden,false);
});

test('velocity controls follow source/test selection and do not overwrite a draft',()=>{
 const {$,api,document,point}=singleSourceLab();setVelocity($,3,4);const source=api.state().masses[0];api.placeTestMass(200,0);const probe=api.state().testMass;setVelocity($,-5,6);
 const canvas=$('fieldCanvas');canvas.emit('pointerdown',point(source));canvas.emit('pointerup',point(source));assert.equal($('velocityX').value,'3');assert.equal($('velocityY').value,'4');
 canvas.emit('pointerdown',point(probe));canvas.emit('pointerup',point(probe));assert.equal($('velocityX').value,'-5');assert.equal($('velocityY').value,'6');
 document.activeElement=$('velocityX');$('velocityX').emit('focus');$('velocityX').value='12';$('simulationSpeed').value='60';$('simulationSpeed').emit('input');assert.equal($('velocityX').value,'12');
 $('clear').emit('click');assert.equal($('velocityBlock').hidden,true);
});

test('editing a merged mass preserves reset members and their relative velocities',()=>{
 const {$,api}=openLab(false,{empty:true});api.seedSources([{x:0,y:0,mass:4,vx:.001},{x:0,y:0,mass:6,vx:-.002}]);api.advanceSimulation(1/240);assert.equal(api.state().masses.length,1);
 setVelocity($,8,2);const c=api.state().masses[0];closeTo(c.vx,8*gridUnitsPerKm);closeTo(c.vy,2*gridUnitsPerKm);
 $('resetTest').emit('click');const bodies=api.state().masses;assert.equal(bodies.length,2);closeTo(momentum(bodies).x/10,8*gridUnitsPerKm);closeTo(momentum(bodies).y/10,2*gridUnitsPerKm);closeTo(bodies[0].vx-bodies[1].vx,.003);
});

test('moving focus from X to Y preserves the first uncommitted velocity component',()=>{
 const {$,api,document}=singleSourceLab();document.activeElement=$('velocityX');$('velocityX').emit('focus');$('velocityX').value='3.5';
 document.activeElement=$('velocityY');$('velocityY').emit('focus');assert.equal($('velocityX').value,'3.5');
 $('velocityY').value='-6';$('velocityY').emit('keydown',{key:'Enter'});
 closeTo(api.state().masses[0].vx,3.5*gridUnitsPerKm);closeTo(api.state().masses[0].vy,-6*gridUnitsPerKm);
});

test('moving sources leave bounded trails that restart on reposition and reset',()=>{
 const {$,api}=openLab(false,{empty:true});
 $('presetSingle').emit('click');
 const body=api.state().masses[0];
 advanceSeconds(api,10);
 assert.equal(body.trail.length,240);
 assert.ok(body.trail[0].x<body.trail.at(-1).x);
 $('massX').value='1.5';$('massX').emit('change');
 assert.equal(body.trail.length,1);assert.equal(body.trail[0].x,body.x);
 advanceSeconds(api,.5);assert.ok(body.trail.length>1);
 $('resetTest').emit('click');assert.equal(api.state().masses[0].trail.length,1);
});
