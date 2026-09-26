import numpy as np, scipy.sparse as sp, scipy.sparse.linalg as sla
from coinfe import mesh2, assemble2
from axi import constraints
from morgan import profile
a=18.85; hb=2.2417/a; hR=2.40/a; nu=.37
p=profile(hb,hR)
ne=[max(1,int(np.ceil((p['rb'][k+1]-p['rb'][k])*40))) for k in range(len(p['rb'])-1)]
R,Z,el,em=mesh2(p['rb'],p['tc'],p['tt'],p['mats'],ne,2,1)
top=np.zeros(len(R),bool)
# top-surface nodes: max z at each r
for r in np.unique(R): idx=np.where(R==r)[0]; top[idx[np.argmax(Z[idx])]]=True
def solve(n,rp,k,clamp=False,nm=2):
    K,M=assemble2(R,Z,el,em,n,nu,1.0); K=K.tolil()
    # Winkler springs on the top face within r<rp: normal stiffness k per unit area (dimensionless k*a/E), tributary area r*dr
    idx=np.where(top&(R<=rp+1e-12))[0]; rs=np.sort(R[idx])
    if not clamp:
        for i in idx:
            r=R[i]; j=np.searchsorted(rs,r); lo=rs[max(j-1,0)]; hi=rs[min(j+1,len(rs)-1)]
            w=r*(hi-lo)/2 if r>0 else (hi**2)/8
            K[3*i+2,3*i+2]+=k*w
    K=K.tocsr(); T=constraints(R,Z,n)
    if clamp:
        keep=np.ones(T.shape[0],bool)
        for i in idx: keep[3*i]=keep[3*i+1]=keep[3*i+2]=False
        D=sp.diags(keep.astype(float)); T=(D@T); T=T[:,np.asarray(np.abs(T).sum(0)).ravel()>0]
    Kr=(T.T@K@T).tocsc(); Mr=(T.T@M@T).tocsc(); rig=1 if (n<2 and not clamp and k==0) else 0
    v=np.sort(sla.eigsh(Kr,k=nm+rig+1,M=Mr,sigma=-1e-6,which='LM')[0])
    v=v[v>1e-7] if (n<2 and not clamp) else v
    return np.sqrt(v[:nm])
free={n:solve(n,0,0) for n in [0,1,2,3,4]}
print('free f (arb):',{n:np.round(free[n],5) for n in free})
for rp in [.08,.13]:
    for k in [1e-4,1e-3,1e-2]:
        out=[]
        for n,label in [(0,'(0,1)'),(1,'(1,1)'),(2,'(2,0)'),(3,'(3,0)'),(4,'(4,0)')]:
            f=solve(n,rp,k); ref=free[n][0]
            # with springs the rigid mode becomes a low 'bounce' mode for n=0,1: report the elastic one closest to free
            j=np.argmin(np.abs(f-ref)); out.append(f'{label} {(f[j]/ref-1)*100:+.3f}%')
        print(f'pads r<{rp} k={k:g}: '+'  '.join(out))
    out=[]
    for n,label in [(0,'(0,1)'),(1,'(1,1)'),(2,'(2,0)'),(3,'(3,0)'),(4,'(4,0)')]:
        f=solve(n,rp,0,clamp=True); ref=free[n][0]; out.append(f'{label} {(f[0]/ref-1)*100:+.2f}%')
    print(f'rigid clamp r<{rp}: '+'  '.join(out))
