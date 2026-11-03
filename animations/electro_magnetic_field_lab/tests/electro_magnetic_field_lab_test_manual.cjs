'use strict';
// Test the actual planar engine embedded in index.html. No external packages.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const P = vm.runInNewContext(html.match(/<script id="physics-engine">([\s\S]*?)<\/script>/)[1]+'\nChargeFieldPhysics;',{}, {timeout:1000});
const report = {planarSamples:0,maxRetardedResidual:0,maxSpeed:0,maxAcceleration:0,maxDerivativeError:0,maxRelativeTransversalityError:0,maxHistoryContinuityError:0};
function close(a,b,tol=1e-9) { assert.ok(Math.abs(a-b)<=tol, `${a} must equal ${b} within ${tol}`); }
function fieldClose(a,b,tol=1e-10) { for(const key of ['evx','evy','erx','ery','ex','ey','bv','br','bz']) close(a[key],b[key],tol); }
function magnitude(f) {return Math.hypot(f.erx,f.ery);}

// No imaginary charge or field before the user places one.
assert.equal(P.sample(3,4,0,{placed:false,motion:'manual'}).valid,false);

// Translation covariance of the automatic modes and exact off-origin Coulomb limit.
for(const motion of ['continuous','pulse']) {
  const base = {amplitude:.7,frequency:.1,motion};
  const translated = {...base,anchorX:5.2,anchorY:-3.7};
  for(let i=0;i<30;i++) {
    const x=12+i*.3,y=7-i*.2,t=i*.6;
    fieldClose(P.sample(x+5.2,y-3.7,t,translated),P.sample(x,y,t,base));
  }
}
const still = new P.MotionHistory(-4,2);
still.advanceTo(15,{x:-4,y:2});
assert.equal(still.segments.length,1,'Resting source history must be compacted.');
const staticField=P.sample(-1,6,10,{motion:'manual',history:still});
close(staticField.ex,3/125,1e-12);close(staticField.ey,4/125,1e-12);close(staticField.bz,0,1e-12);
assert.equal(P.isChanging(P.component(staticField,'total'),P.component(P.sample(-1,6,9.94,{motion:'manual',history:still}),'total')),false);

// Moving horizontally emits transverse radiation, and the outside of the
// initial light cone remains exactly the old static field.
const h=new P.MotionHistory(0,0), hp={motion:'manual',history:h};
h.advanceTo(2,{x:3,y:0});
const before=P.sample(0,10,0,hp), notArrived=P.sample(0,10,2,hp);
fieldClose(before,notArrived,1e-12);
close(notArrived.sourceX,0);close(notArrived.sourceY,0);close(magnitude(notArrived),0);
const nearby=P.sample(0,1,1.5,hp);
assert.ok(nearby.valid && magnitude(nearby)>1e-5,'Horizontal acceleration must produce radiation.');
assert.ok(P.isChanging(P.component(nearby,'total'),P.component(P.sample(0,1,1.44,hp),'total')));
const saved=P.sample(3,2,2,hp);
h.advanceTo(15,{x:-1,y:3});
fieldClose(saved,P.sample(3,2,2,hp),1e-12);

// Compare two paths related by a 90-degree rotation. E must rotate while Bz is unchanged.
const ha=new P.MotionHistory(-1,2), hb=new P.MotionHistory(-2,-1);
for(let i=1;i<=120;i++) {
  const t=i*.13, target={x:4*Math.sin(i*.16),y:3*Math.cos(i*.23)};
  ha.advanceTo(t,target);hb.advanceTo(t,{x:-target.y,y:target.x});
  const qa=ha.at(t-.03),qb=hb.at(t-.03);
  close(qb.x,-qa.y,1e-10);close(qb.y,qa.x,1e-10);
}
for(let i=0;i<80;i++) {
  const x=5+.08*i,y=3+.025*i,t=6+.1*i;
  const a=P.sample(x,y,t,{motion:'manual',history:ha});
  const b=P.sample(-y,x,t,{motion:'manual',history:hb});
  assert.ok(a.valid&&b.valid);
  close(b.ex,-a.ey);close(b.ey,a.ex);close(b.bz,a.bz);
  close(b.erx,-a.ery);close(b.ery,a.erx);
}

// Random-looking, rapidly reversed two-dimensional targets and very long jumps.
const history = new P.MotionHistory(2,-1);
for(let i=1;i<=500;i++) {
  history.advanceTo(i*.17,{x:10*Math.sin(i*2.413),y:8*Math.cos(i*1.715)});
}
for(const segment of history.segments) {
  const t=segment.t0+.37*(segment.t1-segment.t0),q=history.at(t);
  report.maxSpeed=Math.max(report.maxSpeed,Math.hypot(q.vx,q.vy));
  report.maxAcceleration=Math.max(report.maxAcceleration,Math.hypot(q.ax,q.ay));
  if (segment.t1-segment.t0<.005) continue;
  const eps=1e-5,qp=history.at(t+eps),qm=history.at(t-eps);
  report.maxDerivativeError=Math.max(report.maxDerivativeError,
    Math.abs(q.vx-(qp.x-qm.x)/(2*eps)),Math.abs(q.vy-(qp.y-qm.y)/(2*eps)),
    Math.abs(q.ax-(qp.vx-qm.vx)/(2*eps)),Math.abs(q.ay-(qp.vy-qm.vy)/(2*eps)));
}
for(let i=1;i<history.segments.length;i++) {
  const a=history.segments[i-1],b=history.segments[i],dt=a.t1-a.t0;
  report.maxHistoryContinuityError=Math.max(report.maxHistoryContinuityError,
    Math.abs(a.x+a.vx*dt+.5*a.ax*dt*dt-b.x),Math.abs(a.y+a.vy*dt+.5*a.ay*dt*dt-b.y),
    Math.abs(a.vx+a.ax*dt-b.vx),Math.abs(a.vy+a.ay*dt-b.vy));
}
assert.ok(report.maxSpeed<=P.MAX_BETA*P.C+1e-12);
assert.ok(report.maxAcceleration<=1.5+1e-10);
assert.ok(report.maxDerivativeError<1e-7);
assert.ok(report.maxHistoryContinuityError<1e-10);
for(let i=0;i<1200;i++) {
  const f=P.sample(15*Math.sin(i*.72)+.9,11*Math.cos(i*.35)+.1,i*.068,{motion:'manual',history});
  if(!f.valid) continue;
  report.planarSamples++;
  report.maxRetardedResidual=Math.max(report.maxRetardedResidual,Math.abs(f.residual));
  report.maxRelativeTransversalityError=Math.max(report.maxRelativeTransversalityError,
    Math.abs(f.nx*f.erx+f.ny*f.ery)/Math.max(1e-15,magnitude(f)));
  close(f.bz,(f.nx*f.ey-f.ny*f.ex)/P.C,1e-10);
  close(f.ex,f.evx+f.erx,1e-10);close(f.ey,f.evy+f.ery,1e-10);
}
assert.ok(report.maxRetardedResidual<1.1e-10);
assert.ok(report.maxRelativeTransversalityError<1e-12);

// Continuous-wave history survives conversion to manual control with no
// invented discontinuity in position or velocity, including negative times.
const automatic={motion:'continuous',amplitude:.7,frequency:.1,anchorX:3,anchorY:2};
const time=6.2,q=P.trajectory(time,automatic);
const switched=new P.MotionHistory(q.x,q.y,time,automatic);
switched.advanceTo(7,{x:6,y:1});
for(const t of [-10,0,3,6.1]) {
  const a=P.trajectory(t,automatic),b=switched.at(t);
  for(const key of ['x','y','vx','vy','ax','ay']) close(a[key],b[key],1e-12);
}
const distant=P.sample(30,20,6.8,{motion:'manual',history:switched});
fieldClose(distant,P.sample(30,20,6.8,automatic));

// All waves eventually leave a finite observation region after the drop settles.
const rest=new P.MotionHistory(0,0);rest.advanceTo(80,{x:3,y:2});
const settled=rest.at(80);
close(settled.x,3,1e-6);close(settled.y,2,1e-6);close(settled.vx,0,1e-12);close(settled.vy,0,1e-12);
const tail=P.sample(8,7,80,{motion:'manual',history:rest});
close(magnitude(tail),0,1e-12);
assert.equal(P.isChanging(P.component(tail,'total'),P.component(P.sample(8,7,79.94,{motion:'manual',history:rest}),'total')),false);

// Highlight semantics detect both magnitude-only and direction-only changes.
assert.equal(P.isChanging({x:1,y:0},{x:.95,y:0}),true);
assert.equal(P.isChanging({x:0,y:1},{x:1,y:0}),true);
assert.equal(P.isChanging({x:1,y:0},{x:1,y:0}),false);
assert.equal(P.isChanging({x:1e-13,y:0},{x:0,y:0}),false);
assert.throws(()=>history.advanceTo(0,{x:0,y:0}));
assert.throws(()=>new P.MotionHistory(NaN,0));
assert.throws(()=>new P.MotionHistory(0,0,2,{motion:'continuous',amplitude:1.2,frequency:.1}));
console.log('All manual-motion and highlight checks passed.');
console.log(JSON.stringify(report,null,2));
