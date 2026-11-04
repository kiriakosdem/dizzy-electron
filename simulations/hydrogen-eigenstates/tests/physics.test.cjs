const {test} = require('node:test');
const assert = require('node:assert/strict');
const P = require('../physics.js');
function near(a,b,tolerance=1e-6){assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);}

test('invalid combinations are rejected; dependent controls preserve or clamp values',()=>{
    for(const s of [[0,0,0],[2,2,0],[2,1,2],[2,-1,0],[1.5,0,0],[2,1,.5]]) {
        assert.equal(P.validState(...s),false); assert.throws(()=>P.distributions(...s),RangeError);
    }
    assert.deepEqual(P.constrainState(6,4,-3),{n:6,l:4,m:-3});
    assert.deepEqual(P.constrainState(2,4,-3),{n:2,l:1,m:-1});
    assert.deepEqual(P.constrainState(1,5,5),{n:1,l:0,m:0});
    assert.deepEqual(P.constrainState(4,0,-3),{n:4,l:0,m:0});
});

test('known 1s, 2s, 2p and 3d radial functions and nodes',()=>{
    for(const r of [0,.5,1,2,6,12]) {
        near(P.radial(1,0,r),2*Math.exp(-r));
        near(P.radial(2,0,r),(2-r)*Math.exp(-r/2)/(2*Math.sqrt(2)));
        near(P.radial(2,1,r),r*Math.exp(-r/2)/(2*Math.sqrt(6)));
        near(P.radial(3,2,r),4*r*r*Math.exp(-r/3)/(81*Math.sqrt(30)));
    }
    near(P.radial(2,0,2),0);
    near(P.radial(3,0,(9-Math.sqrt(27))/2),0);
    near(P.radial(3,0,(9+Math.sqrt(27))/2),0);
    near(P.angularDensity(1,0,0),0);
    near(P.angularDensity(1,1,1),0);
    near(P.angularDensity(2,0,1/Math.sqrt(3)),0);
});

for(let n=1;n<=P.MAX_N;n++) for(let l=0;l<n;l++) for(let m=-l;m<=l;m++) {
    test(`normalized radial and angular density for (${n},${l},${m})`,()=>{
        const d=P.distributions(n,l,m);
        near(d.radial.mass,1,2e-6); near(d.angular.mass,1,1e-5);
        for(const t of [d.radial,d.angular]) {
            near(t.cdf[t.cdf.length-1],1);
            for(let i=1;i<t.cdf.length;i++) assert.ok(t.cdf[i]>=t.cdf[i-1]);
        }
        // Integral <r> = [3n² - l(l+1)] a0 / 2, independently of m.
        let mean=0;
        for(let i=1;i<d.radial.cdf.length;i++) mean+=(d.radial.cdf[i]-d.radial.cdf[i-1])*(i-.5)*d.radial.step;
        near(mean,(3*n*n-l*(l+1))/2,0.001);
    });
}

test('samples have correct spherical and p-state moments, with no padded origin points',()=>{
    for(const [n,l,m,mu2] of [[1,0,0,1/3],[2,0,0,1/3],[2,1,0,3/5],[2,1,1,1/5],[6,5,-5,1/13]]) {
        const {positions}=P.sample(n,l,m,40000,9876);
        let mean=0, angular=0,xMean=0;
        for(let i=0;i<positions.length;i+=3) {
            const [x,y,z]=positions.subarray(i,i+3),r=Math.hypot(x,y,z);
            assert.ok(Number.isFinite(r)&&r>0);mean+=r;angular+=z*z/(r*r);xMean+=x/r;
        }
        near(mean/40000/((3*n*n-l*(l+1))/2),1,0.02);
        near(angular/40000,mu2,0.008);near(xMean/40000,0,0.012);
    }
});

test('changing sample count preserves the existing cloud; +/-m give identical densities',()=>{
    const small=P.sample(4,2,-1,500,42).positions;
    const large=P.sample(4,2,1,2000,42).positions;
    assert.deepEqual(small,large.slice(0,small.length));
    assert.throws(()=>P.sample(1,0,0,0),RangeError);
});
