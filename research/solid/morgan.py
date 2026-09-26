"""Morgan dollar axisymmetric cross-section, revision 2 (lengths in units of the radius a; per side, mirror-symmetric).
Field: spherical basin (die radius) of sagitta s at the centre, measured from the field edge at rF=1-wR-wD.
Relief/denticles: smeared layers of fill phi on the local field, envelope height f*(rim top - local field).
 Smeared material: density phi*rho; out-of-plane stiffness phi*E (keeps the layer attached, no spurious modes);
 in-plane stiffness beta*E with beta in [~0, phi] (islands of relief carry little in-plane stress).
Rim: solid to the measured rim half-thickness TR."""
import numpy as np
from coinfe import volume
DEFAULT=dict(s=.0058,wR=.04,wD=.05,fD=.7,phiD=.5,fc=.7,phic=.4,rc=.68,fL=.7,phiL=.3,rL0=.74,rL1=.89,beta=.15,taper=.02,wall=.006,nfield=8)
EPS=.02
def smeared(phi,beta): return (phi, phi, max(.02, min(beta,phi)/phi))   # (ef, rho factor, in-plane factor)
VOID=(1e-3,1e-3,1.0); SOLID=(1.0,1.0,1.0)
def build(TFe,TR,p):
    rF=1-p['wR']-p['wD']
    field=lambda r: TFe-p['s']*max(0.0,1-(r/rF)**2)
    # radial breakpoints
    pts=sorted(set([0.0,p['rc']-p['taper'],p['rc'],p['rL0'],p['rL0']+p['taper'],p['rL1']-p['taper'],p['rL1'],rF,rF+p['taper'],1-p['wR']-p['wall'],1-p['wR'],1.0]
        +list(np.linspace(0,p['rc']-p['taper'],p['nfield']+1)[1:-1])))
    pts=[x for x in pts if 0<=x<=1]
    def band(r):  # material/height of the upper zone at radius r (segment midpoint)
        if r<p['rc']: return p['fc'],smeared(p['phic'],p['beta'])
        if r<p['rL0']: return 0,VOID
        if r<p['rL1']: return p['fL'],smeared(p['phiL'],p['beta'])
        if r<rF: return 0,VOID
        if r<1-p['wR']: return p['fD'],smeared(p['phiD'],p['beta'])
        return 1.0,SOLID
    def top(r,f): F=field(r); return F+f*(TR-F)+EPS*F*(1-f)   # additive layer, none on the rim: smooth, rim exact
    # evaluate top at breakpoints using the band on the relevant side; ramps: use band of taller neighbour
    rb=pts; tc=[field(r) for r in rb]; tt=[]; mats=[]
    for k in range(len(rb)-1):
        mid=(rb[k]+rb[k+1])/2; f,m=band(mid); mats.append(m)
    # top line: segments of width <= taper+1e-9 adjacent to a level change are ramps
    lv=[band((rb[k]+rb[k+1])/2)[0] for k in range(len(rb)-1)]
    width=[rb[k+1]-rb[k] for k in range(len(rb)-1)]
    ramp=[w<=max(p['taper'],p['wall'])+1e-9 for w in width]
    for i,r in enumerate(rb):
        cand=[]
        if i>0 and not ramp[i-1]: cand.append(lv[i-1])
        if i<len(rb)-1 and not ramp[i]: cand.append(lv[i])
        if not cand: cand=[lv[i-1]]
        # a ramp joins its neighbours; at a breakpoint between two plateaus of different level, keep the lower
        tt.append(top(r,min(cand)))
    # ramps take the material of the taller neighbour
    for k in range(len(rb)-1):
        if ramp[k]:
            nb=[j for j in (k-1,k+1) if 0<=j<len(lv) and not ramp[j]]
            j=max(nb,key=lambda j:lv[j]) if nb else k; mats[k]=band((rb[j]+rb[j+1])/2)[1]
    return {'rb':rb,'tc':tc,'tt':tt,'mats':mats}
def profile(hbar,hR,**kw):
    p={**DEFAULT,**kw}; TR=hR/2
    lo,hi=.4*TR,TR
    if volume(build(hi,TR,p))<hbar: return None     # rim too thin for this mass
    for _ in range(60):
        mid=(lo+hi)/2
        if volume(build(mid,TR,p))>hbar: hi=mid
        else: lo=mid
    TFe=(lo+hi)/2; pr=build(TFe,TR,p)
    ok=all(t>c for t,c in zip(pr['tt'],pr['tc'])) and min(pr['tc'])>.5*TR
    pr.update(TFe=TFe,TF0=TFe-p['s'],hbar=volume(pr),params=p,valid=ok); return pr
