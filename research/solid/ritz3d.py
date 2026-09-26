"""Independent check: spectral 3D Ritz for a uniform free disc (flexural family), Legendre-in-r^2 basis
with exact regularity at the axis, Gauss quadrature. Not shared code with axi.py."""
import numpy as np, scipy.linalg as la
from numpy.polynomial import legendre as L
def ritz(n,nu,t,K=14,J=5):
    lam=nu/((1+nu)*(1-2*nu)); mu=1/(2*(1+nu))
    xr,wr=L.leggauss(80); r=(xr+1)/2; wr=wr/2
    xz,wz=L.leggauss(30); z=(xz+1)/2*t; wz=wz/2*t
    Rg,Zg=np.meshgrid(r,z,indexing='ij'); W8=np.outer(wr*r,wz)
    # radial functions phi_k(r)=P_k(2r^2-1)
    ph=[];dph=[]
    for k in range(K):
        c=np.zeros(k+1);c[k]=1; s=2*r*r-1
        ph.append(L.legval(s,c)); dph.append(L.legval(s,L.legder(c))*4*r)
    ph=np.array(ph);dph=np.array(dph)
    pu=max(n-1,0) if n!=0 else 1; pw=n
    fields=[]  # list of (field index, radial power p, k, z power q)
    for k in range(K):
        for j in range(J):
            fields.append((0,pu,k,2*j+1))
            if n>0: fields.append((1,pu,k,2*j+1))
            fields.append((2,pw,k,2*j))
    m=len(fields); comps=np.zeros((m,9,len(r),len(z)))  # U,Ur,Uz,V,Vr,Vz,W,Wr,Wz
    for a,(f,p,k,q) in enumerate(fields):
        rp=r**p; drp=p*r**(p-1) if p>0 else 0*r
        g=ph[k]*rp; dg=dph[k]*rp+ph[k]*drp
        zq=(z/t)**q; dzq=q*(z/t)**(q-1)/t if q>0 else 0*z
        val=np.outer(g,zq); dr=np.outer(dg,zq); dz=np.outer(g,dzq)
        comps[a,3*f]=val;comps[a,3*f+1]=dr;comps[a,3*f+2]=dz
    U,Ur,Uz,V,Vr,Vz,W,Wr,Wz=[comps[:,i] for i in range(9)]
    Rr=Rg[None]
    e=[Ur,(U+n*V)/Rr,Wz,Vr-(V+n*U)/Rr,Uz+Wr,Vz-n*W/Rr]
    D=np.zeros((6,6));D[:3,:3]=lam;D[0,0]=D[1,1]=D[2,2]=lam+2*mu;D[3,3]=D[4,4]=D[5,5]=mu
    Kmat=np.zeros((m,m))
    for i in range(6):
        for j in range(6):
            if D[i,j]!=0: Kmat+=D[i,j]*np.einsum('arz,brz,rz->ab',e[i],e[j],W8)
    Mmat=np.einsum('arz,brz,rz->ab',U,U,W8)+np.einsum('arz,brz,rz->ab',V,V,W8)+np.einsum('arz,brz,rz->ab',W,W,W8)
    if n==1:
        # regularity: U(0,z)+V(0,z)=0 for each z power
        C=[]
        for j in range(J):
            row=np.zeros(m)
            for a,(f,p,k,q) in enumerate(fields):
                if f in (0,1) and q==2*j+1: row[a]=ph[k][0]*0+L.legval(-1,np.eye(K)[k])
            C.append(row)
        T=la.null_space(np.array(C))
        Kmat=T.T@Kmat@T; Mmat=T.T@Mmat@T
    ev=la.eigh(Kmat,Mmat,eigvals_only=True)
    return np.sort(ev)
