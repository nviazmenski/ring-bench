"""Axisymmetric 3D elasticity FE with circumferential harmonic n, flexural (antisymmetric) family.
Units: radius a=1, E=1, rho=1. Domain 0<=r<=1, 0<=z<=t(r) (half thickness; z=0 is the mid-plane).
u_r=U cos n th, u_th=V sin n th, u_z=W cos n th. Mid-plane antisymmetry: U=V=0 at z=0.
"""
import numpy as np, scipy.sparse as sp, scipy.sparse.linalg as sla, scipy.linalg as la

def lagrange1d(x):
    # quadratic Lagrange on [-1,1], nodes -1,0,1
    N=np.array([x*(x-1)/2,1-x*x,x*(x+1)/2]); d=np.array([x-.5,-2*x,x+.5]); return N,d

def D_matrix(nu,E=1.0):
    lam=E*nu/((1+nu)*(1-2*nu)); mu=E/(2*(1+nu))
    D=np.zeros((6,6)); D[:3,:3]=lam; D[0,0]=D[1,1]=D[2,2]=lam+2*mu; D[3,3]=D[4,4]=D[5,5]=mu
    return D

def build_mesh(rb,tb,ne,nz):
    """rb, tb: profile breakpoints (r from 0 to 1) and half-thickness at them (piecewise linear).
    ne: list of element counts per segment. nz: elements through half thickness."""
    rn=[0.0]
    for k in range(len(rb)-1):
        for e in range(ne[k]):
            a=rb[k]+(rb[k+1]-rb[k])*e/ne[k]; b=rb[k]+(rb[k+1]-rb[k])*(e+1)/ne[k]
            rn+= [ (a+b)/2, b ]
    rn=np.array(rn); tn=np.interp(rn,rb,tb)
    NR=len(rn); NZ=2*nz+1
    R=np.repeat(rn[:,None],NZ,1); Z=tn[:,None]*np.linspace(0,1,NZ)[None,:]
    elems=[]
    for i in range((NR-1)//2):
        for j in range(nz):
            elems.append([(2*i+a)*NZ+(2*j+b) for a in range(3) for b in range(3)])  # node index = ir*NZ+iz
    return R.ravel(),Z.ravel(),np.array(elems),NR,NZ

GP,GW=np.polynomial.legendre.leggauss(4)

def assemble(R,Z,elems,n,nu):
    D=D_matrix(nu); nn=len(R); ndof=3*nn
    rows=[];cols=[];kv=[];mv=[]
    for el in elems:
        xr=R[el]; xz=Z[el]; Ke=np.zeros((27,27)); Me=np.zeros((27,27))
        for gi,xi in enumerate(GP):
            Nx,dx=lagrange1d(xi)
            for gj,et in enumerate(GP):
                Ny,dy=lagrange1d(et)
                N=np.outer(Nx,Ny).ravel(); dNxi=np.outer(dx,Ny).ravel(); dNet=np.outer(Nx,dy).ravel()
                J=np.array([[dNxi@xr,dNxi@xz],[dNet@xr,dNet@xz]]); detJ=la.det(J); Ji=la.inv(J)
                dNr=Ji[0,0]*dNxi+Ji[0,1]*dNet; dNz=Ji[1,0]*dNxi+Ji[1,1]*dNet
                r=N@xr; w=GW[gi]*GW[gj]*detJ*r
                B=np.zeros((6,27)); Nr=N/r
                B[0,0::3]=dNr
                B[1,0::3]=Nr; B[1,1::3]=n*Nr
                B[2,2::3]=dNz
                B[3,0::3]=-n*Nr; B[3,1::3]=dNr-Nr
                B[4,0::3]=dNz; B[4,2::3]=dNr
                B[5,1::3]=dNz; B[5,2::3]=-n*Nr
                Ke+=w*B.T@D@B
                Nm=np.zeros((3,27)); Nm[0,0::3]=N; Nm[1,1::3]=N; Nm[2,2::3]=N
                Me+=w*Nm.T@Nm
        dofs=np.array([[3*k,3*k+1,3*k+2] for k in el]).ravel()
        rows.append(np.repeat(dofs,27)); cols.append(np.tile(dofs,27)); kv.append(Ke.ravel()); mv.append(Me.ravel())
    rows=np.concatenate(rows); cols=np.concatenate(cols)
    K=sp.csr_matrix((np.concatenate(kv),(rows,cols)),shape=(ndof,ndof)); M=sp.csr_matrix((np.concatenate(mv),(rows,cols)),shape=(ndof,ndof))
    return K,M

def constraints(R,Z,n):
    """Return transformation T (ndof x nfree) implementing BCs."""
    nn=len(R); ndof=3*nn; tol=1e-12
    fixed=set(); ties=[]  # ties: (dof_dependent, dof_master, factor)
    for k in range(nn):
        if Z[k]<tol: fixed.update([3*k,3*k+1])          # antisymmetry: U=V=0 on mid-plane
        if R[k]<tol:
            if n==0: fixed.add(3*k)                      # U=0 on axis
            elif n==1: fixed.add(3*k+2); ties.append((3*k+1,3*k,-1.0))  # W=0, V=-U
            else: fixed.update([3*k,3*k+1,3*k+2])
        if n==0: fixed.add(3*k+1)                        # no torsion DOF for n=0
    dep={d:(m,f) for d,m,f in ties if d not in fixed and m not in fixed}
    free=[d for d in range(ndof) if d not in fixed and d not in dep]
    idx={d:i for i,d in enumerate(free)}
    rows=[];cols=[];vals=[]
    for d in free: rows.append(d);cols.append(idx[d]);vals.append(1.0)
    for d,(m,f) in dep.items(): rows.append(d);cols.append(idx[m]);vals.append(f)
    return sp.csr_matrix((vals,(rows,cols)),shape=(ndof,len(free)))

def solve(rb,tb,n,nu,ne,nz,k=4):
    R,Z,elems,NR,NZ=build_mesh(rb,tb,ne,nz)
    K,M=assemble(R,Z,elems,n,nu); T=constraints(R,Z,n)
    Kr=(T.T@K@T).tocsc(); Mr=(T.T@M@T).tocsc()
    nrig={0:1,1:1}.get(n,0)
    vals,vecs=sla.eigsh(Kr,k=k+nrig,M=Mr,sigma=-1e-6,which='LM')
    vals=np.sort(vals)[nrig:]
    return vals, Kr.shape[0]

def hbar(rb,tb):
    # volume-equivalent full thickness for radius 1: hbar = 2*int h r dr = 4*int t r dr
    r=np.linspace(0,1,20001); t=np.interp(r,rb,tb); return 4*np.trapezoid(t*r,r)

def lam2(vals,hb,nu):
    return np.sqrt(np.maximum(vals,0))*np.sqrt(12*(1-nu*nu))/hb
