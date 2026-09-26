/* ───────── free circular plate, Leissa ─────────
   f = (λ² h)/(2π a²) · √( E / (12(1−ν²)ρ) )

   λ² is NOT material-free. Every mode with a nodal diameter has a λ² that
   depends on ν, and Leissa only published the table at one ν (1/3). For
   months this app used that one-ν table for every alloy — over-predicting
   gold (ν=.42) by about 5.8% on the fundamental and mis-stating the mode
   ratios for gold by 6-8%, which is where the "reads flat" and "none found"
   problems came from.

   Fixed by solving the free-edge problem directly. Mode shape
   W=[C·Jₙ(λρ)+D·Iₙ(λρ)]cos(nθ); free edge means zero radial moment and zero
   Kirchhoff shear at ρ=1. Using the Helmholtz identities (∇²J = −λ²J,
   ∇²I = +λ²I) the 2×2 determinant is
     moment  row:  λ²Jₙ'' + νλJₙ' − νn²Jₙ    |  λ²Iₙ'' + νλIₙ' − νn²Iₙ
     shear   row:  −λ³Jₙ' − (1−ν)n²(λJₙ'−Jₙ)  |  +λ³Iₙ' − (1−ν)n²(λIₙ'−Iₙ)
   Coefficients below are retained from the preceding build. A 13-point check
   over nu=0.20..0.50 against the separately supplied eig.py solver found a
   maximum relative discrepancy of about 0.0033%. This is agreement with that
   solver, not independent validation of real coins or Leissa's source table.
   The supplied table comparison mixes nu=.33 and 1/3 in its documentation;
   the (4,0) reference discrepancy remains unresolved.

   The browser evaluates the cubic only; no Python or Bessel runtime is loaded.
   centreNode: a nodal line passes through the centre — true for every mode
   with at least one nodal diameter, false for the axisymmetric ones.      */
const MODES=[
 {id:"(2,0)", c:[-1.343071,-0.723659,-2.352084, 6.165347], centreNode:true },
 {id:"(0,1)", c:[ 0.359723,-1.227142, 2.858181, 8.246414], centreNode:false},
 {id:"(3,0)", c:[-3.558018,-1.813648,-4.296389,13.987200], centreNode:true },
 {id:"(1,1)", c:[ 0.057930,-0.332170, 1.476584,20.059906], centreNode:true },
 {id:"(4,0)", c:[-6.925460,-3.001457,-6.302912,24.183156], centreNode:true },
 {id:"(2,1)", c:[ 0.000184, 0.058097,-0.622912,35.441748], centreNode:true },
];
const lam2=(i,nu)=>{const c=MODES[i].c;return ((c[0]*nu+c[1])*nu+c[2])*nu+c[3];};
const SUPPORTS={
 "tongs-rubber":{n:"Rubber-tipped tongs, centre", node:9000, anti:500},
 "tongs-hard"  :{n:"Hard tongs, centre",          node:5000, anti:280},
 "finger"      :{n:"Fingertip, centre",           node:4000, anti:200},
 "rim"         :{n:"Rim pinch",                   node:900,  anti:900},
 "table"       :{n:"Flat on a hard surface",      node:130,  anti:130},
};

function predict(mass,dia,rho,E,nu,qmat,sup,hmm){
  const a=dia/2000, rhoSI=rho*1000;
  /* thickness is what the model actually needs. Mass is only one way to get it;
     a caliper reading times a rim factor is the other, and it needs no scale. */
  const h = (hmm>0) ? hmm/1000 : (mass/1000)/rhoSI/(Math.PI*a*a);
  const k=Math.sqrt(E*1e9/(12*(1-nu*nu)*rhoSI));
  const S=SUPPORTS[sup]||SUPPORTS["tongs-rubber"];
  const f=[],Q=[],tau=[],amp=[];
  MODES.forEach((m,i)=>{
    const fi=lam2(i,nu)*h/(2*Math.PI*a*a)*k;
    const qi=1/(1/qmat+1/(m.centreNode?S.node:S.anti));
    f.push(fi);Q.push(qi);tau.push(qi/(Math.PI*fi));
    amp.push(Math.pow(f[0]/fi,0.8));
  });
  return {h:h*1000,f,Q,tau,amp};
}

const NN=["C","C♯","D","E♭","E","F","F♯","G","A♭","A","B♭","B"];
function noteOf(f){
  const midi=69+12*Math.log2(f/440);
  const r=Math.round(midi), cents=Math.round((midi-r)*100);
  return NN[((r%12)+12)%12]+(Math.floor(r/12)-1)+(cents>=0?" +":" −")+Math.abs(cents)+"¢";
}
const sp=n=>String(n);


