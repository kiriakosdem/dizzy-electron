/* General real-orbital surfaces: signed-field marching tetrahedra preserves nodal gaps. */
(function(root,factory){
    if(typeof module==='object'&&module.exports) module.exports=factory(require('./physics.js'));
    else root.HydrogenRealSurface=factory(root.HydrogenPhysics);
}(typeof globalThis!=='undefined'?globalThis:this,function(P){
    'use strict';
    function prepare(n,l,m,basis,steps=144){
        const radius99=P.quantile(P.distributions(n,l,m).radial,.99);
        const bound=radius99*1.55, h=2*bound/steps, size=steps+1;
        const values=new Float32Array(size**3), densities=new Float32Array(size**3);
        const amplitude=(x,y,z)=>P.realAmplitude(n,l,m,x,y,z,basis);
        let mass=0;
        for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
            const i=x+size*(y+size*z), a=amplitude(x*h-bound,y*h-bound,z*h-bound);
            values[i]=a; densities[i]=a*a; mass+=a*a*h**3;
        }
        densities.sort();
        const cumulative=new Float64Array(densities.length);
        let sum=0;
        for(let i=densities.length-1;i>=0;i--){sum+=densities[i]*h**3;cumulative[i]=sum;}
        return {n,l,m,basis,radius99,bound,h,size,steps,values,densities,cumulative,mass,amplitude};
    }
    function build(model,probability){
        if(!(probability>=.5-Number.EPSILON&&probability<=.999+Number.EPSILON))throw new RangeError('Invalid probability');
        const {size,steps,h,bound,values,densities,cumulative,amplitude}=model;
        let lo=0,hi=densities.length-1;
        while(hi-lo>1){const mid=(lo+hi)>>>1;if(cumulative[mid]>probability*model.mass)lo=mid;else hi=mid;}
        const level=Math.sqrt((densities[lo]+densities[hi])/2);
        const positions=[],normals=[],indices=[],cache=new Map();let maxRadius=0;
        const offsets=[0,1,size,size+1,size*size,size*size+1,size*size+size,size*size+size+1];
        const tets=[[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]];
        function point(id){return [(id%size)*h-bound,(Math.floor(id/size)%size)*h-bound,Math.floor(id/(size*size))*h-bound];}
        function vertex(a,b,sign){
            const key=`${Math.min(a,b)}:${Math.max(a,b)}:${sign}`;
            if(cache.has(key))return cache.get(key);
            const t=(sign*level-values[a])/(values[b]-values[a]),pa=point(a),pb=point(b);
            const p=pa.map((v,k)=>v+t*(pb[k]-v)),eps=h*.01;
            const grad=[0,1,2].map(k=>{const u=p.slice(),v=p.slice();u[k]+=eps;v[k]-=eps;return -sign*(amplitude(...u)-amplitude(...v));});
            const length=Math.hypot(...grad)||1, id=positions.length/3;
            positions.push(...p);normals.push(...grad.map(v=>v/length));cache.set(key,id);
            maxRadius=Math.max(maxRadius,Math.hypot(...p));return id;
        }
        function triangle(a,b,c){
            const u=[0,1,2].map(k=>positions[3*b+k]-positions[3*a+k]);
            const v=[0,1,2].map(k=>positions[3*c+k]-positions[3*a+k]);
            const dot=(u[1]*v[2]-u[2]*v[1])*normals[3*a]+(u[2]*v[0]-u[0]*v[2])*normals[3*a+1]+(u[0]*v[1]-u[1]*v[0])*normals[3*a+2];
            if(dot>=0)indices.push(a,b,c);else indices.push(a,c,b);
        }
        for(let z=0;z<steps;z++)for(let y=0;y<steps;y++)for(let x=0;x<steps;x++){
            const base=x+size*(y+size*z),ids=offsets.map(v=>base+v);
            const min=Math.min(...ids.map(i=>values[i])),max=Math.max(...ids.map(i=>values[i]));
            for(const sign of [1,-1]){
                const iso=sign*level;if(min>iso||max<iso)continue;
                for(const tet of tets){
                    const inside=[],outside=[];
                    for(const k of tet)(values[ids[k]]>=iso?inside:outside).push(ids[k]);
                    if(!inside.length||!outside.length)continue;
                    if(inside.length===1||outside.length===1){
                        const single=inside.length===1?inside:outside,other=inside.length===1?outside:inside;
                        triangle(...other.map(b=>vertex(single[0],b,sign)));
                    }else{
                        const a=vertex(inside[0],outside[0],sign),b=vertex(inside[0],outside[1],sign),c=vertex(inside[1],outside[0],sign),d=vertex(inside[1],outside[1],sign);
                        triangle(a,b,c);triangle(b,d,c);
                    }
                }
            }
        }
        return {positions:new Float32Array(positions),normals:new Float32Array(normals),indices:new Uint32Array(indices),maxRadius,threshold:level*level};
    }
    return {prepare,build};
}));
