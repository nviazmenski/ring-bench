"use strict";
// Experimental 3D elastic solid model for axisymmetric coin cross-sections; derivation and validation in MODEL.md.
// Displacements u_r=U cos nθ, u_θ=V sin nθ, u_z=W cos nθ over the half cross-section 0≤r≤1, 0≤z≤t(r)
// (radius a=1, E=1, ρ=1). Mid-plane antisymmetry keeps only the flexural family. Biquadratic 9-node
// elements, 4×4 Gauss points, banded Cholesky and subspace iteration. No plate assumptions: transverse
// shear, rotary inertia and thickness change are all included, so upper modes are not overpredicted.
const SOLID_MODEL="axisym-solid-fe-v1";
const SOLID_GAUSS=(()=>{const a=Math.sqrt(3/7-2/7*Math.sqrt(6/5)),b=Math.sqrt(3/7+2/7*Math.sqrt(6/5)),wa=(18+Math.sqrt(30))/36,wb=(18-Math.sqrt(30))/36;return {x:[-b,-a,a,b],w:[wb,wa,wa,wb]};})();
const solidShape=x=>[[x*(x-1)/2,1-x*x,x*(x+1)/2],[x-.5,-2*x,x+.5]];
// profile: {rb:[breakpoints 0..1], tc:[core half-thickness], tt:[top half-thickness], mats:[[ef,rhoFactor,inPlane] per segment]}.
// The core zone is solid; the upper zone takes the segment's material. Lengths are in units of the radius.
function solidMesh(profile,{perRadius=30,coreLayers=2,topLayers=1}={}){
  const {rb,tc,tt,mats}=profile,rn=[0],seg=[];
  for(let k=0;k<rb.length-1;k++){
    const ne=Math.max(1,Math.ceil((rb[k+1]-rb[k])*perRadius-1e-9));
    for(let e=0;e<ne;e++){const a=rb[k]+(rb[k+1]-rb[k])*e/ne,b=rb[k]+(rb[k+1]-rb[k])*(e+1)/ne;rn.push((a+b)/2,b);seg.push(k);}
  }
  const interp=(xs,ys,x)=>{let k=0;while(k<xs.length-2&&x>xs[k+1])k++;const t=(x-xs[k])/(xs[k+1]-xs[k]||1);return ys[k]+(ys[k+1]-ys[k])*t;};
  const NR=rn.length,NZ=2*(coreLayers+topLayers)+1,r=new Float64Array(NR*NZ),z=new Float64Array(NR*NZ);
  for(let i=0;i<NR;i++){
    const c=interp(rb,tc,rn[i]),t=interp(rb,tt,rn[i]);
    if(!(t>c&&c>0))throw Error("Cross-section has a non-positive layer.");
    for(let j=0;j<NZ;j++){r[i*NZ+j]=rn[i];z[i*NZ+j]=j<=2*coreLayers?c*j/(2*coreLayers):c+(t-c)*(j-2*coreLayers)/(2*topLayers);}
  }
  const elems=[],emat=[];
  for(let i=0;i<seg.length;i++)for(let j=0;j<coreLayers+topLayers;j++){
    const el=[];for(let a=0;a<3;a++)for(let b=0;b<3;b++)el.push((2*i+a)*NZ+2*j+b);
    elems.push(el);emat.push(j<coreLayers?[1,1,1]:mats[seg[i]]);
  }
  return {r,z,elems,emat,NR,NZ};
}
// Isotropic stiffness with the out-of-plane shear moduli scaled by g, and the in-plane rows scaled by congruence
// (inPlane≤1), which keeps smeared relief attached to the field while it adds little bending stiffness.
function solidD(nu,ef,g,inPlane){
  const lam=nu/((1+nu)*(1-2*nu)),mu=1/(2*(1+nu)),D=Array.from({length:6},()=>new Float64Array(6));
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)D[i][j]=lam+(i===j?2*mu:0);
  D[3][3]=mu;D[4][4]=D[5][5]=mu*g;
  const s=[Math.sqrt(inPlane),Math.sqrt(inPlane),1,Math.sqrt(inPlane),1,1];
  for(let i=0;i<6;i++)for(let j=0;j<6;j++)D[i][j]*=ef*s[i]*s[j];
  return D;
}
// Banded symmetric storage: row i holds columns i-bw..i.
function solidAssemble(mesh,n,nu,g){
  const {r,z,elems,emat,NZ}=mesh,nodes=r.length,N=3*nodes,bw=6*NZ+8,W=bw+1,K=new Float64Array(N*W),M=new Float64Array(N*W);
  const onAxis=k=>r[k]<1e-12,onMid=k=>z[k]<1e-12;
  const fixed=new Uint8Array(N);
  for(let k=0;k<nodes;k++){
    if(onMid(k)){fixed[3*k]=1;fixed[3*k+1]=1;}
    if(n===0)fixed[3*k+1]=1;
    if(onAxis(k)){if(n===0)fixed[3*k]=1;else if(n===1){fixed[3*k+2]=1;fixed[3*k+1]=1;}else{fixed[3*k]=fixed[3*k+1]=fixed[3*k+2]=1;}}
  }
  // n=1 on the axis: V=-U, applied by mapping the V degree of freedom onto U.
  const map=(k,c)=>n===1&&onAxis(k)&&c===1?[3*k,-1]:[3*k+c,1];
  const G=SOLID_GAUSS,sh=G.x.map(solidShape),B=Array.from({length:6},()=>new Float64Array(27)),Ke=new Float64Array(729),Me=new Float64Array(729);
  for(let e=0;e<elems.length;e++){
    const el=elems[e],[ef,rf,ip]=emat[e],D=solidD(nu,ef,g,ip);Ke.fill(0);Me.fill(0);
    for(let gi=0;gi<4;gi++)for(let gj=0;gj<4;gj++){
      const [Nx,dx]=sh[gi],[Ny,dy]=sh[gj],Nv=new Float64Array(9),Dxi=new Float64Array(9),Det=new Float64Array(9);
      let j11=0,j12=0,j21=0,j22=0,rr=0;
      for(let a=0;a<3;a++)for(let b=0;b<3;b++){const q=3*a+b,k=el[q];Nv[q]=Nx[a]*Ny[b];Dxi[q]=dx[a]*Ny[b];Det[q]=Nx[a]*dy[b];j11+=Dxi[q]*r[k];j12+=Dxi[q]*z[k];j21+=Det[q]*r[k];j22+=Det[q]*z[k];rr+=Nv[q]*r[k];}
      const det=j11*j22-j12*j21,w=G.w[gi]*G.w[gj]*det*rr;
      for(const row of B)row.fill(0);
      for(let q=0;q<9;q++){
        const dr=(j22*Dxi[q]-j12*Det[q])/det,dz=(-j21*Dxi[q]+j11*Det[q])/det,nr=Nv[q]/rr,u=3*q,v=u+1,x=u+2;
        B[0][u]=dr;B[1][u]=nr;B[1][v]=n*nr;B[2][x]=dz;B[3][u]=-n*nr;B[3][v]=dr-nr;B[4][u]=dz;B[4][x]=dr;B[5][v]=dz;B[5][x]=-n*nr;
      }
      const DB=Array.from({length:6},(_,i)=>{const o=new Float64Array(27);for(let j=0;j<6;j++){const d=D[i][j];if(d)for(let c=0;c<27;c++)o[c]+=d*B[j][c];}return o;});
      for(let a=0;a<27;a++)for(let b=a;b<27;b++){let s=0;for(let i=0;i<6;i++)s+=B[i][a]*DB[i][b];Ke[a*27+b]+=w*s;}
      for(let a=0;a<9;a++)for(let b=a;b<9;b++){const m=w*rf*Nv[a]*Nv[b];for(let c=0;c<3;c++)Me[(3*a+c)*27+3*b+c]+=m;}
    }
    for(let a=0;a<27;a++)for(let b=a;b<27;b++){
      const [ia,sa]=map(el[a/3|0],a%3),[ib,sb]=map(el[b/3|0],b%3),kv=Ke[a*27+b]*sa*sb,mv=Me[a*27+b]*sa*sb;
      if(!kv&&!mv)continue;
      const add=(i,j,f)=>{if(i<j){const t=i;i=j;j=t;}const p=i*W+j-i+bw;K[p]+=kv*f;M[p]+=mv*f;};
      add(ia,ib,ia===ib&&a!==b?2:1);
    }
  }
  for(let i=0;i<N;i++)if(fixed[i]){for(let j=Math.max(0,i-bw);j<=i;j++){K[i*W+j-i+bw]=0;M[i*W+j-i+bw]=0;}for(let j=i+1;j<=Math.min(N-1,i+bw);j++){K[j*W+i-j+bw]=0;M[j*W+i-j+bw]=0;}K[i*W+bw]=1;}
  return {K,M,N,bw,fixed};
}
function bandMul(A,N,bw,x,y){
  const W=bw+1;y.fill(0);
  for(let i=0;i<N;i++){const lo=Math.max(0,i-bw);let s=A[i*W+bw]*x[i];for(let j=lo;j<i;j++){const a=A[i*W+j-i+bw];s+=a*x[j];y[j]+=a*x[i];}y[i]+=s;}
  return y;
}
function bandCholesky(A,N,bw){
  const W=bw+1,L=Float64Array.from(A);
  for(let i=0;i<N;i++){
    const lo=Math.max(0,i-bw);
    for(let j=lo;j<=i;j++){
      let s=L[i*W+j-i+bw];const lo2=Math.max(lo,j-bw);
      for(let k=lo2;k<j;k++)s-=L[i*W+k-i+bw]*L[j*W+k-j+bw];
      if(i===j){if(!(s>0))throw Error("Solid model matrix is not positive definite.");L[i*W+bw]=Math.sqrt(s);}else L[i*W+j-i+bw]=s/L[j*W+bw];
    }
  }
  return L;
}
function bandSolve(L,N,bw,b){
  const W=bw+1,x=Float64Array.from(b);
  for(let i=0;i<N;i++){let s=x[i];for(let k=Math.max(0,i-bw);k<i;k++)s-=L[i*W+k-i+bw]*x[k];x[i]=s/L[i*W+bw];}
  for(let i=N-1;i>=0;i--){x[i]/=L[i*W+bw];const v=x[i];for(let k=Math.max(0,i-bw);k<i;k++)x[k]-=L[i*W+k-i+bw]*v;}
  return x;
}
// Small dense generalized symmetric problem A q = λ B q, returning sorted values and B-orthonormal vectors.
function smallEigen(A,B){
  const p=A.length,L=Array.from({length:p},()=>new Float64Array(p));
  for(let i=0;i<p;i++)for(let j=0;j<=i;j++){let s=B[i][j];for(let k=0;k<j;k++)s-=L[i][k]*L[j][k];if(i===j){if(!(s>0))throw Error("Subspace lost rank.");L[i][i]=Math.sqrt(s);}else L[i][j]=s/L[j][j];}
  const Li=Array.from({length:p},()=>new Float64Array(p));
  for(let j=0;j<p;j++)for(let i=0;i<p;i++){let s=i===j?1:0;for(let k=0;k<i;k++)s-=L[i][k]*Li[k][j];Li[i][j]=s/L[i][i];}
  const C=Array.from({length:p},(_,i)=>Array.from({length:p},(_,j)=>{let s=0;for(let k=0;k<=i;k++)for(let l=0;l<=j;l++)s+=Li[i][k]*A[k][l]*Li[j][l];return s;}));
  const V=Array.from({length:p},(_,i)=>Array.from({length:p},(_,j)=>i===j?1:0));
  for(let sweep=0;sweep<60;sweep++){
    let off=0,diag=0;for(let i=0;i<p;i++){diag=Math.max(diag,Math.abs(C[i][i]));for(let j=i+1;j<p;j++)off=Math.max(off,Math.abs(C[i][j]));}
    if(off<=1e-15*Math.max(diag,1e-300))break;
    for(let a=0;a<p-1;a++)for(let b=a+1;b<p;b++){
      if(C[a][b]===0)continue;
      const th=.5*Math.atan2(2*C[a][b],C[b][b]-C[a][a]),c=Math.cos(th),s=Math.sin(th);
      for(let k=0;k<p;k++){const x=C[k][a],y=C[k][b];C[k][a]=c*x-s*y;C[k][b]=s*x+c*y;}
      for(let k=0;k<p;k++){const x=C[a][k],y=C[b][k];C[a][k]=c*x-s*y;C[b][k]=s*x+c*y;}
      for(let k=0;k<p;k++){const x=V[k][a],y=V[k][b];V[k][a]=c*x-s*y;V[k][b]=s*x+c*y;}
    }
  }
  const order=C.map((row,i)=>[row[i],i]).sort((x,y)=>x[0]-y[0]);
  // q = L^-T v
  const Q=order.map(([,i])=>{const v=V.map(row=>row[i]),q=new Float64Array(p);for(let k=p-1;k>=0;k--){let s=v[k];for(let l=k+1;l<p;l++)s-=L[l][k]*q[l];q[k]=s/L[k][k];}return q;});
  return {values:order.map(x=>x[0]),vectors:Q};
}
// Lowest `count` eigenvalues (ω² in units E/(ρa²)) of one harmonic, above its rigid-body modes.
function solidHarmonic(mesh,n,nu,g,count){
  const {K,M,N,bw}=solidAssemble(mesh,n,nu,g),rigid=n<2?1:0,m=count+rigid,p=Math.min(N,m+6),shift=1e-4;
  const A=Float64Array.from(K);for(let i=0;i<A.length;i++)A[i]+=shift*M[i];
  const L=bandCholesky(A,N,bw);
  let X=Array.from({length:p},(_,j)=>{const x=new Float64Array(N);let s=12345+977*j;for(let i=0;i<N;i++){s=(s*1103515245+12345)%2147483648;x[i]=s/2147483648-.5;}return x;});
  let prev=null,values=null;const y=new Float64Array(N);
  for(let it=0;it<200;it++){
    X=X.map(x=>bandSolve(L,N,bw,bandMul(M,N,bw,x,y)));
    const KX=X.map(x=>Float64Array.from(bandMul(K,N,bw,x,y))),MX=X.map(x=>Float64Array.from(bandMul(M,N,bw,x,y)));
    const dot=(a,b)=>{let s=0;for(let i=0;i<N;i++)s+=a[i]*b[i];return s;};
    const Ak=X.map((xi,i)=>X.map((xj,j)=>dot(xi,KX[j]))),Bk=X.map((xi,i)=>X.map((xj,j)=>dot(xi,MX[j])));
    for(let i=0;i<p;i++)for(let j=0;j<i;j++){Ak[i][j]=Ak[j][i]=(Ak[i][j]+Ak[j][i])/2;Bk[i][j]=Bk[j][i]=(Bk[i][j]+Bk[j][i])/2;}
    const e=smallEigen(Ak,Bk);values=e.values;
    X=e.vectors.map(q=>{const x=new Float64Array(N);for(let k=0;k<p;k++){const c=q[k];if(c)for(let i=0;i<N;i++)x[i]+=c*X[k][i];}return x;});
    if(prev&&values.slice(rigid,m).every((v,i)=>Math.abs(v-prev[rigid+i])<=1e-11*Math.abs(v)))break;
    prev=values;
  }
  return values.slice(rigid,m);
}
// Dimensionless flexural eigenvalues expressed as the plate-equivalent λ², so f = λ²·h̄/(2πa²)·√(E/(12(1−ν²)ρ))
// exactly as in the thin-plate model; hbar is the volume-equivalent thickness in units of the radius.
function solidLambda2(profile,nu,{g=1,modes=SOLID_MODES,mesh:meshOptions}={}){
  const mesh=solidMesh(profile,meshOptions),hbar=profileHbar(profile),scale=Math.sqrt(12*(1-nu*nu))/hbar,byN=new Map();
  for(const [n,s] of modes)byN.set(n,Math.max(byN.get(n)??-1,s));
  const out=new Map();for(const [n,s] of byN)out.set(n,solidHarmonic(mesh,n,nu,g,s+(n<2?0:1)));
  return modes.map(([n,s])=>Math.sqrt(Math.max(0,out.get(n)[n<2?s-1:s]))*scale);
}
// The six tracked plate modes, in the thin-plate model's order: (2,0) (0,1) (3,0) (1,1) (4,0) (2,1).
const SOLID_MODES=[[2,0],[0,1],[3,0],[1,1],[4,0],[2,1]];
function profileHbar(profile){
  const {rb,tc,tt,mats}=profile;let s=0;
  // piecewise-linear core and top: integrate (c + (t-c)·ρf)·r exactly on each segment
  for(let k=0;k<rb.length-1;k++){
    const r0=rb[k],r1=rb[k+1],f=mats[k][1],h0=tc[k]+(tt[k]-tc[k])*f,h1=tc[k+1]+(tt[k+1]-tc[k+1])*f,dr=r1-r0;
    s+=dr*(h0*(2*r0+r1)+h1*(r0+2*r1))/6;
  }
  return 4*s;
}

// ───────── Morgan dollar cross-section (experimental) ─────────
// Per side, mirror-symmetric, lengths in units of the radius. Spherical die basin of sagitta s at the centre;
// smeared relief (portrait and legends) and denticles on the local field; a solid outer rim to the measured
// rim thickness. Smeared layers: density φρ, out-of-plane stiffness φE (keeps them attached), in-plane
// stiffness βE with β≤φ (separate relief islands carry little in-plane stress).
const MORGAN_PROFILE_DEFAULTS=Object.freeze({s:.0058,wR:.04,wD:.05,fD:.7,phiD:.5,fc:.7,phic:.4,rc:.68,fL:.7,phiL:.3,rL0:.74,rL1:.89,beta:.15,taper:.02,wall:.006,nfield:8});
function morganBuild(TFe,TR,p){
  const rF=1-p.wR-p.wD,field=r=>TFe-p.s*Math.max(0,1-(r/rF)**2),EPS=.02;
  const smeared=phi=>[phi,phi,Math.max(.02,Math.min(p.beta,phi)/phi)],VOID=[1e-3,1e-3,1],SOLID=[1,1,1];
  const set=new Set([0,p.rc-p.taper,p.rc,p.rL0,p.rL0+p.taper,p.rL1-p.taper,p.rL1,rF,rF+p.taper,1-p.wR-p.wall,1-p.wR,1]);
  for(let i=1;i<p.nfield;i++)set.add((p.rc-p.taper)*i/p.nfield);
  const rb=[...set].filter(x=>x>=0&&x<=1).sort((a,b)=>a-b).filter((x,i,a)=>i===0||x-a[i-1]>1e-12);
  const band=r=>r<p.rc?[p.fc,smeared(p.phic)]:r<p.rL0?[0,VOID]:r<p.rL1?[p.fL,smeared(p.phiL)]:r<rF?[0,VOID]:r<1-p.wR?[p.fD,smeared(p.phiD)]:[1,SOLID];
  const top=(r,f)=>{const F=field(r);return F+Math.max(f*(TR-F),EPS*F);};
  const nseg=rb.length-1,lv=[],mats=[],ramp=[];
  for(let k=0;k<nseg;k++){const [f,m]=band((rb[k]+rb[k+1])/2);lv.push(f);mats.push(m);ramp.push(rb[k+1]-rb[k]<=Math.max(p.taper,p.wall)+1e-9);}
  const tt=rb.map((r,i)=>{const c=[];if(i>0&&!ramp[i-1])c.push(lv[i-1]);if(i<nseg&&!ramp[i])c.push(lv[i]);if(!c.length)c.push(lv[i-1]);return top(r,Math.min(...c));});
  for(let k=0;k<nseg;k++)if(ramp[k]){const nb=[k-1,k+1].filter(j=>j>=0&&j<nseg&&!ramp[j]),j=nb.length?nb.reduce((a,b)=>lv[b]>lv[a]?b:a):k;mats[k]=band((rb[j]+rb[j+1])/2)[1];}
  return {rb,tc:rb.map(field),tt,mats};
}
// Field edge thickness solved so the volume matches the mass; null when the rim is too thin for the mass.
function morganProfile(hbar,hR,params={}){
  const p={...MORGAN_PROFILE_DEFAULTS,...params},TR=hR/2;let lo=.4*TR,hi=TR;
  if(profileHbar(morganBuild(hi,TR,p))<hbar)return null;
  for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(profileHbar(morganBuild(mid,TR,p))>hbar)hi=mid;else lo=mid;}
  const pr=morganBuild((lo+hi)/2,TR,p);
  const valid=pr.tt.every((t,i)=>t>pr.tc[i])&&Math.min(...pr.tc)>.5*TR;
  return valid?{...pr,hbar:profileHbar(pr),fieldEdge:2*(lo+hi)/2,fieldCentre:2*((lo+hi)/2-p.s),params:p}:null;
}
