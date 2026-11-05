const {test} = require('node:test');
const assert = require('node:assert/strict');
const P = require('../physics.js');
const S = require('../surface.js');
function near(a,b,tolerance){assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b} (tolerance ${tolerance})`);}

test('1s surface encloses the requested analytic probability and grows with enclosure',()=>{
    const model=S.prepare(1,0,0);
    let previousRadius=0;
    for(const probability of [.5,.9,.99,99.9/100]) {
        const mesh=S.build(model,probability), r=mesh.maxRadius;
        near(1-Math.exp(-2*r)*(1+2*r+2*r*r),probability,.001);
        assert.ok(r>previousRadius); previousRadius=r;
        for(let i=0;i<mesh.positions.length;i+=3) near(Math.hypot(...mesh.positions.subarray(i,i+3)),r,1e-6);
    }
    for(const invalid of [0,.49,1,NaN,Infinity]) assert.throws(()=>S.threshold(model,invalid),RangeError);
});

// Independent quadrature: uniform r and cos(theta), different from the
// quadratic-r / uniform-theta grid used to choose the threshold.
function enclosedMass(n,l,m,levels) {
    const nr=2400, nm=1000, dr=(2*n*n+20*n+20)/nr, dmu=2/nm;
    const angular=Array.from({length:nm},(_,j)=>P.angularDensity(l,m,-1+(j+.5)*dmu));
    const masses=levels.map(()=>0);
    for(let i=0;i<nr;i++) {
        const r=(i+.5)*dr, radial=P.radial(n,l,r)**2;
        for(const a of angular) {
            const density=radial*a/(2*Math.PI), mass=radial*a*r*r*dr*dmu;
            levels.forEach((level,k)=>{if(density>=level)masses[k]+=mass;});
        }
    }
    return masses;
}
for(const state of [[2,1,0],[2,1,1],[3,2,0],[4,2,1],[6,0,0],[6,3,1],[6,5,0],[6,5,5]]) {
    test(`density thresholds enclose the correct mass for (${state})`,()=>{
        const model=S.prepare(...state), probabilities=[.5,.9,.99,.999];
        near(model.mass,1,3e-5);
        const levels=probabilities.map(p=>S.threshold(model,p));
        const masses=enclosedMass(...state,levels);
        masses.forEach((mass,k)=>near(mass,probabilities[k],.0015));
        for(let k=1;k<levels.length;k++) assert.ok(levels[k]<levels[k-1]);
    });
}

for(const state of [[1,0,0],[2,1,0],[3,2,0],[6,0,0],[6,3,1],[6,5,0],[6,5,5]]) {
    test(`surface is closed, finite and follows a constant spatial density for (${state})`,()=>{
        const model=S.prepare(...state), mesh=S.build(model,.999);
        assert.ok(mesh.indices.length>0);
        assert.ok(mesh.positions.every(Number.isFinite)); assert.ok(mesh.normals.every(Number.isFinite));
        assert.ok(mesh.maxRadius*3/model.radius99<4.6,'surface fits the default camera');
        // Every edge is shared by two triangles with opposite winding, including
        // poles, the azimuth seam, detached lobes and inward-facing nodal shells.
        const edges=new Map();
        for(let i=0;i<mesh.indices.length;i+=3) {
            const tri=mesh.indices.subarray(i,i+3);
            for(let j=0;j<3;j++) {
                const a=tri[j], b=tri[(j+1)%3];
                assert.notEqual(a,b);
                const key=Math.min(a,b)* (mesh.positions.length/3) + Math.max(a,b);
                const entry=edges.get(key)||[0,0]; entry[0]++; entry[1]+=a<b?1:-1; edges.set(key,entry);
            }
        }
        for(const [count,winding] of edges.values()){assert.equal(count,2);assert.equal(winding,0);}
        // Sampling vertices is enough to catch using r²|psi|² instead of |psi|²,
        // interpolation errors and bad normals without slowing every test run.
        const stride=Math.max(1,Math.floor(mesh.positions.length/3/800));
        for(let i=0;i<mesh.positions.length;i+=3*stride) {
            const [x,y,z]=mesh.positions.subarray(i,i+3),r=Math.hypot(x,y,z);
            const density=P.radial(state[0],state[1],r)**2*P.angularDensity(state[1],state[2],z/r)/(2*Math.PI);
            near(density/mesh.threshold,1,.001);
            near(Math.hypot(...mesh.normals.subarray(i,i+3)),1,1e-6);
        }
    });
}

test('opposite m values generate identical surfaces',()=>{
    const a=S.prepare(4,2,-1),b=S.prepare(4,2,1);
    assert.deepEqual(S.build(a,.99),S.build(b,.99));
});
