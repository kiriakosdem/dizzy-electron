const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../physics.js'),S=require('../real-surface.js');
function near(a,b,t){assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`);}
test('every n/l offers the complete real basis, including eleven h orbitals',()=>{
 for(let n=1;n<=6;n++)for(let l=0;l<n;l++){
  const states=P.realOrbitals(n,l);assert.equal(states.length,2*l+1);
  assert.equal(new Set(states.map(s=>`${s.m}:${s.basis}`)).size,2*l+1);
  for(const s of states)assert.ok(P.validState(n,l,s.m));
 }
 assert.deepEqual(P.realOrbitals(2,1).map(s=>s.label),['2p · z','2p · y','2p · x']);
});
test('real p orbitals have correct axes and phase signs',()=>{
 const a=(m,b,x,y,z)=>P.realAmplitude(2,1,m,x,y,z,b);
 near(a(1,'cos',1,0,0),a(1,'sin',0,1,0),1e-12);
 near(a(1,'cos',1,0,0),a(0,'cos',0,0,1),1e-12);
 near(a(1,'cos',0,1,0),0,1e-12);
 assert.equal(P.phase(2,1,1,-1,0,0,'cos'),Math.PI);
});
test('real angular basis is orthonormal through l=5',()=>{
 for(let l=0;l<=5;l++){
  const states=P.realOrbitals(l+1,l), sums=states.map(()=>states.map(()=>0));
  const radial=P.radial(l+1,l,1);
  for(let j=0;j<500;j++)for(let k=0;k<64;k++){
   const mu=-1+(j+.5)*2/500,phi=(k+.5)*2*Math.PI/64,s=Math.sqrt(1-mu*mu);
   const v=states.map(o=>P.realAmplitude(l+1,l,o.m,s*Math.cos(phi),s*Math.sin(phi),mu,o.basis)/radial);
   for(let a=0;a<v.length;a++)for(let b=0;b<=a;b++)sums[a][b]+=v[a]*v[b]*4*Math.PI/(500*64);
  }
  for(let a=0;a<states.length;a++)for(let b=0;b<=a;b++)near(sums[a][b],a===b?1:0,.0005);
 }
});
test('real cloud sampling follows px and py angular distributions',()=>{
 for(const basis of ['cos','sin']){
  const {positions}=P.sample(2,1,1,40000,42,basis);let x2=0,y2=0;
  for(let i=0;i<positions.length;i+=3){const [x,y,z]=positions.subarray(i,i+3),r2=x*x+y*y+z*z;x2+=x*x/r2;y2+=y*y/r2;}
  near(x2/40000,basis==='cos'?.6:.2,.009);near(y2/40000,basis==='sin'?.6:.2,.009);
 }
});
for(const state of [[2,1,1,'cos'],[6,5,5,'sin']])test(`real surface enclosure and nodal separation ${state}`,()=>{
 const model=S.prepare(...state),mesh=S.build(model,.99);
 near(model.mass,1,.003);assert.ok(mesh.indices.length>0);assert.ok(mesh.normals.every(Number.isFinite));
 const points=P.sample(...state.slice(0,3),60000,435,state[3]).positions;let enclosed=0;
 for(let i=0;i<points.length;i+=3){const a=P.realAmplitude(...state.slice(0,3),...points.subarray(i,i+3),state[3]);if(a*a>=mesh.threshold)enclosed++;}
 near(enclosed/60000,.99,.004);
 for(let i=0;i<mesh.indices.length;i+=3){
  const signs=Array.from(mesh.indices.subarray(i,i+3),v=>Math.sign(P.realAmplitude(...state.slice(0,3),...mesh.positions.subarray(v*3,v*3+3),state[3])));
  assert.ok(signs.every(s=>s===signs[0]),'triangles must not bridge opposite-phase lobes');
 }
});
