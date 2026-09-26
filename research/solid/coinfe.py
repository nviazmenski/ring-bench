"""Two-zone axisymmetric FE: a core zone 0..tc(r) (solid) and an upper zone tc(r)..tt(r) whose material
per radial segment is (stiffness factor, density factor). Shear factor g scales out-of-plane shear moduli."""
import numpy as np, scipy.sparse as sp, scipy.sparse.linalg as sla, scipy.linalg as la
from axi import lagrange1d, GP, GW, constraints

def Dmat(nu,ef=1.0,g=1.0,inplane=1.0):
    """ef scales the whole tensor; inplane (0..1] scales rr, thth, r-th rows/cols by congruence (stays PD)."""
    lam=nu/((1+nu)*(1-2*nu)); mu=1/(2*(1+nu))
    D=np.zeros((6,6)); D[:3,:3]=lam; D[0,0]=D[1,1]=D[2,2]=lam+2*mu; D[3,3]=mu; D[4,4]=D[5,5]=mu*g
    s=np.sqrt(inplane); S=np.diag([s,s,1,s,1,1])
    return ef*S@D@S

def mesh2(rb,tc,tt,mats,ne,nzc,nzt):
    rn=[0.0]; seg=[]
    for k in range(len(rb)-1):
        for e in range(ne[k]):
            a=rb[k]+(rb[k+1]-rb[k])*e/ne[k]; b=rb[k]+(rb[k+1]-rb[k])*(e+1)/ne[k]; rn+=[(a+b)/2,b]; seg.append(k)
    rn=np.array(rn); c=np.interp(rn,rb,tc); t=np.interp(rn,rb,tt)
    NZ=2*(nzc+nzt)+1
    zc=np.linspace(0,1,2*nzc+1); zt=np.linspace(0,1,2*nzt+1)[1:]
    Z=np.hstack([c[:,None]*zc[None,:], c[:,None]+(t-c)[:,None]*zt[None,:]])
    R=np.repeat(rn[:,None],NZ,1)
    elems=[];emat=[]
    for i in range(len(seg)):
        for j in range(nzc+nzt):
            elems.append([(2*i+a)*NZ+(2*j+b) for a in range(3) for b in range(3)])
            emat.append((1.0,1.0) if j<nzc else mats[seg[i]])
    return R.ravel(),Z.ravel(),np.array(elems),emat

def assemble2(R,Z,elems,emat,n,nu,g):
    nn=len(R); ndof=3*nn; rows=[];cols=[];kv=[];mv=[]
    for el,m in zip(elems,emat):
        ef,rf=m[0],m[1]; ip=m[2] if len(m)>2 else 1.0
        D=Dmat(nu,ef,g,ip); xr=R[el]; xz=Z[el]; Ke=np.zeros((27,27)); Me=np.zeros((27,27))
        for gi,xi in enumerate(GP):
            Nx,dx=lagrange1d(xi)
            for gj,et in enumerate(GP):
                Ny,dy=lagrange1d(et)
                N=np.outer(Nx,Ny).ravel(); dNxi=np.outer(dx,Ny).ravel(); dNet=np.outer(Nx,dy).ravel()
                J=np.array([[dNxi@xr,dNxi@xz],[dNet@xr,dNet@xz]]); detJ=J[0,0]*J[1,1]-J[0,1]*J[1,0]
                Ji=np.array([[J[1,1],-J[0,1]],[-J[1,0],J[0,0]]])/detJ
                dNr=Ji[0,0]*dNxi+Ji[0,1]*dNet; dNz=Ji[1,0]*dNxi+Ji[1,1]*dNet
                r=N@xr; w=GW[gi]*GW[gj]*detJ*r; Nr=N/r
                B=np.zeros((6,27))
                B[0,0::3]=dNr; B[1,0::3]=Nr; B[1,1::3]=n*Nr; B[2,2::3]=dNz
                B[3,0::3]=-n*Nr; B[3,1::3]=dNr-Nr; B[4,0::3]=dNz; B[4,2::3]=dNr; B[5,1::3]=dNz; B[5,2::3]=-n*Nr
                Ke+=w*B.T@D@B
                Me+=w*rf*np.kron(np.outer(N,N),np.eye(3))
        dofs=np.array([[3*k,3*k+1,3*k+2] for k in el]).ravel()
        rows.append(np.repeat(dofs,27)); cols.append(np.tile(dofs,27)); kv.append(Ke.ravel()); mv.append(Me.ravel())
    rows=np.concatenate(rows); cols=np.concatenate(cols)
    return sp.csr_matrix((np.concatenate(kv),(rows,cols)),shape=(ndof,ndof)),sp.csr_matrix((np.concatenate(mv),(rows,cols)),shape=(ndof,ndof))

def modes(prof,nu,g=1.0,harmonics=((2,0),(0,1),(3,0),(1,1),(4,0),(5,0),(2,1)),ne_scale=1,nzc=2,nzt=1):
    rb,tc,tt,mats=prof['rb'],prof['tc'],prof['tt'],prof['mats']
    ne=[max(1,int(np.ceil((rb[k+1]-rb[k])*40*ne_scale))) for k in range(len(rb)-1)]
    R,Z,el,em=mesh2(rb,tc,tt,mats,ne,nzc,nzt)
    out={}
    for n in sorted(set(h[0] for h in harmonics)):
        K,M=assemble2(R,Z,el,em,n,nu,g); T=constraints(R,Z,n)
        Kr=(T.T@K@T).tocsc(); Mr=(T.T@M@T).tocsc(); nrig=1 if n<2 else 0
        smax=max(s for (m,s) in harmonics if m==n)
        v=np.sort(sla.eigsh(Kr,k=smax+1+nrig,M=Mr,sigma=-1e-6,which='LM')[0])[nrig:]
        for (m,s) in harmonics:
            if m==n: out[(m,s)]=v[s-1 if n<2 else s]
    return out  # omega^2 in units E/(rho a^2)

def volume(prof):
    # volume-equivalent full thickness (relative to a): hbar = 4*int t_eff r dr
    rb,tc,tt,mats=prof['rb'],prof['tc'],prof['tt'],prof['mats']; s=0
    for k in range(len(rb)-1):
        r=np.linspace(rb[k],rb[k+1],401); c=np.interp(r,rb,tc); t=np.interp(r,rb,tt)
        s+=np.trapezoid((c+(t-c)*mats[k][1])*r,r)
    return 4*s
