const EL={Au:19.30,Ag:10.49,Cu:8.96,Pt:21.45,Pd:12.02,Zn:7.14,Ni:8.90,Fe:7.87,Cr:7.19};
const ALLOYS={
  au900cu:{n:".900 Au / .100 Cu — LMU, Imperial Russia",f:{Au:.900,Cu:.100},E:85,nu:.42,mt:"gold"},
  au986cu:{n:".986 Au / .014 Cu — ducat standard",      f:{Au:.986,Cu:.014},E:80,nu:.42,mt:"gold"},
  au9167 :{n:".9167 Au / .03 Ag / .0533 Cu — American Gold Eagle",f:{Au:.9167,Ag:.03,Cu:.0533},E:82,nu:.42,mt:"gold"},
  au917cu:{n:".917 Au / .083 Cu — 22k gold-copper: Krugerrand, Sovereign, Ottoman lira",f:{Au:.917,Cu:.083},E:80,nu:.42,mt:"gold"},
  au900ag:{n:".900 Au / .100 Ag",                       f:{Au:.900,Ag:.100},E:80,nu:.42,mt:"gold"},
  au750  :{n:".750 Au / Ag / Cu — 18k, underfine",      f:{Au:.750,Ag:.10,Cu:.150},E:88,nu:.41,mt:"gold"},
  au999  :{n:".9999 Au — fine",                         f:{Au:1.0},E:79,nu:.42,mt:"gold"},
  ag999  :{n:".999 Ag — fine",                          f:{Ag:1.0},E:79,nu:.37,mt:"silver"},
  ag925  :{n:".925 Ag / .075 Cu — sterling",            f:{Ag:.925,Cu:.075},E:80,nu:.37,mt:"silver"},
  ag900  :{n:".900 Ag / .100 Cu — US & Russian coin",   f:{Ag:.900,Cu:.100},E:82,nu:.37,mt:"silver"},
  ag835  :{n:".835 Ag / .165 Cu — LMU silver standard", f:{Ag:.835,Cu:.165},E:85,nu:.37,mt:"silver"},
  ag833  :{n:".833 Ag / .167 Cu — thaler standard",     f:{Ag:.833,Cu:.167},E:85,nu:.37,mt:"silver"},
  ag800  :{n:".800 Ag / .200 Cu",                       f:{Ag:.800,Cu:.200},E:87,nu:.37,mt:"silver"},
  ag830  :{n:".830 Ag / .170 Cu — Ottoman kuruş standard",f:{Ag:.830,Cu:.170},E:85,nu:.37,mt:"silver"},
  ag750  :{n:".750 Ag / .250 Cu — Yugoslav 1932–38",    f:{Ag:.750,Cu:.250},E:88,nu:.37,mt:"silver"},
  ag500  :{n:".500 Ag / .500 Cu — RU billon, GB 1920–46",f:{Ag:.500,Cu:.500},E:96,nu:.36,mt:"silver"},
  ag500yu:{n:".500 Ag / Cu / Ni / Zn — Yugoslav 1931",  f:{Ag:.50,Cu:.40,Ni:.05,Zn:.05},E:100,nu:.36,mt:"silver"},
  ag400  :{n:".400 Ag nominal — US 40% clad (laminate)",f:{Ag:.400,Cu:.600},E:98,nu:.36,mt:"silver"},
  cuni75 :{n:"cupronickel — 75 Cu / 25 Ni (UK 1947+)",  f:{Cu:.75,Ni:.25},E:145,nu:.33,mt:"base"},
  cuni70 :{n:"cupronickel — 70 Cu / 30 Ni",             f:{Cu:.70,Ni:.30},E:152,nu:.33,mt:"base"},
  usclad :{n:"US clad — 91.67 Cu / 8.33 Ni (laminate)", f:{Cu:.9167,Ni:.0833},E:125,nu:.34,mt:"base"},
  nickel :{n:"nickel — pure",                           f:{Ni:1.0},E:200,nu:.31,mt:"base",mag:2},
  steel  :{n:"steel — mild / low carbon",               f:{Fe:1.0},rho:7.85,E:200,nu:.29,mt:"base",mag:2},
  ss430  :{n:"stainless 430 — ferritic",                f:{Fe:.83,Cr:.17},rho:7.70,E:200,nu:.29,mt:"base",mag:2},
  ss304  :{n:"stainless 304 — austenitic",              f:{Fe:.74,Cr:.18,Ni:.08},rho:8.00,E:193,nu:.29,mt:"base",mag:1},
  brass  :{n:"brass — 65 Cu / 35 Zn",                   f:{Cu:.65,Zn:.35},E:100,nu:.35,mt:"base"},
};
const dens=f=>1/Object.keys(f).reduce((s,k)=>s+f[k]/EL[k],0);
/* mixture rule unless the alloy carries a measured density */
const rhoOf=k=>ALLOYS[k].rho||dens(ALLOYS[k].f);

/* ───────── coin library, by issuer ───────── */
const COINS=[
 {region:"Imperial Russia",g:"Imperial Russia — gold",items:[
  {n:"5 Roubles 1897–1911 · Y#62",   m:4.3013,  d:18.55, a:"au900cu"},
  {n:"7½ Roubles 1897 · Y#63",       m:6.4516,  d:21.30, a:"au900cu"},
  {n:"10 Roubles 1898–1911 · Y#64",  m:8.6026,  d:22.50, a:"au900cu"},
  {n:"15 Roubles 1897 · Y#65",       m:12.9039, d:24.60, a:"au900cu"},
 ]},
 {region:"Imperial Russia",g:"Imperial Russia — silver",items:[
  {n:"1 Rouble 1886–1915 · Y#59/71", m:19.9960, d:33.65, a:"ag900"},
  {n:"1 Rouble 1913 Romanov · Y#70", m:19.9960, d:33.65, a:"ag900"},
  {n:"50 Kopeks 1896–1914 · Y#58",   m:9.9980,  d:26.75, a:"ag900"},
  {n:"25 Kopeks 1896–1901 · Y#57",   m:4.9990,  d:23.00, a:"ag900"},
  {n:"20 Kopeks · Y#22a",            m:3.6000,  d:22.00, a:"ag500"},
  {n:"15 Kopeks · Y#21a",            m:2.7000,  d:19.70, a:"ag500"},
  {n:"10 Kopeks · Y#20a",            m:1.8000,  d:17.50, a:"ag500"},
  {n:"5 Kopeks · Y#19a",             m:0.9000,  d:15.10, a:"ag500"},
 ]},
 {region:"Serbia",g:"Serbia — gold",items:[
  {n:"10 Dinara 1882 · KM#16",       m:3.2258,  d:19.00, a:"au900cu"},
  {n:"20 Dinara 1879 · KM#14",       m:6.4516,  d:21.00, a:"au900cu"},
  {n:"20 Dinara 1882 · KM#17",       m:6.4516,  d:21.00, a:"au900cu"},
 ]},
 {region:"Serbia",g:"Serbia — silver",items:[
  {n:"50 Para 1875–1915 · KM#24",    m:2.5000,  d:18.00, a:"ag835"},
  {n:"1 Dinar 1875–1915 · KM#25",    m:5.0000,  d:22.50, a:"ag835"},
  {n:"2 Dinara 1879, 1897 · Milan, Aleksandar I", m:10.0000, d:27.00, a:"ag835"},
  {n:"2 Dinara 1904–1915 · Petar I · KM#26", m:10.0000, d:28.00, a:"ag835"},
  {n:"5 Dinara 1879 · KM#12",        m:25.0000, d:37.00, a:"ag900"},
  {n:"5 Dinara 1904 · KM#27",        m:25.0000, d:37.00, a:"ag900"},
 ]},
 {region:"Yugoslavia",g:"Kingdom of Yugoslavia — gold",items:[
  {n:"20 Dinara 1925 · KM#7",        m:6.4516,  d:21.00, a:"au900cu"},
  {n:"1 Dukat 1931–34 · KM#12",      m:3.4909,  d:19.75, a:"au986cu"},
  {n:"4 Dukata 1931–33 · KM#14",     m:13.9636, d:40.00, a:"au986cu"},
 ]},
 {region:"Yugoslavia",g:"Kingdom of Yugoslavia — silver",items:[
  {n:"10 Dinara 1931 · KM#10",       m:7.0000,  d:24.00, a:"ag500yu"},
  {n:"20 Dinara 1931 · KM#11",       m:14.0000, d:31.00, a:"ag500yu"},
  {n:"50 Dinara 1932 · KM#16",       m:23.3000, d:36.00, a:"ag750"},
  {n:"20 Dinara 1938 · KM#23",       m:9.0000,  d:27.00, a:"ag750"},
  {n:"50 Dinara 1938 · KM#24",       m:15.0000, d:31.00, a:"ag750"},
 ]},
 {region:"German Empire",g:"German Empire — gold",items:[
  {n:"10 Mark 1872–1915 · KM#various", m:3.9800,  d:19.50, a:"au900cu"},
  {n:"20 Mark 1871–1915 · KM#various", m:7.9650,  d:22.50, a:"au900cu"},
 ]},
 {region:"German Empire",g:"German Empire — silver",items:[
  {n:"50 Pfennig / ½ Mark 1875–1919 · KM#6, KM#17", m:2.7700,  d:20.00, a:"ag900"},
  {n:"1 Mark 1873–1916 · KM#7",        m:5.5500,  d:24.00, a:"ag900"},
  {n:"2 Mark 1876–1915 · KM#various",  m:11.1100, d:28.00, a:"ag900"},
  {n:"5 Mark 1874–1914 · KM#various",  m:27.7700, d:38.00, a:"ag900"},
 ]},
 {region:"Austria",g:"Austria — ducats and Thaler",items:[
  {n:"1 Ducat",                      m:3.4909,  d:20.00, a:"au986cu"},
  {n:"4 Ducat",                      m:13.9636, d:39.50, a:"au986cu"},
  {n:"Maria Theresa Thaler 1780",    m:28.0668, d:39.50, a:"ag833"},
 ]},
 {region:"Austria",g:"Austria-Hungary — Corona gold",items:[
  {n:"10 Corona 1892–1915 · KM#various", m:3.3875, d:19.00, a:"au900cu"},
  {n:"20 Corona 1892–1916 · KM#various", m:6.7751, d:21.00, a:"au900cu"},
 ]},
 {region:"Austria",g:"Austria-Hungary — Corona silver",items:[
  {n:"1 Corona 1893–1916 · KM#various",  m:5.0000,  d:23.00, a:"ag835"},
  {n:"2 Corona 1912–13 · KM#various",    m:10.0000, d:27.00, a:"ag835"},
 ]},
 {region:"Ottoman Empire",g:"Ottoman Empire — gold",items:[
  {n:"100 Kuruş (1 Lira) 1844–1918 · KM#various", m:7.2160, d:22.00, a:"au917cu"},
 ]},
 {region:"Ottoman Empire",g:"Ottoman Empire — silver",items:[
  {n:"1 Kuruş 1844–1918 · KM#various",  m:1.2027,  d:14.60, a:"ag830"},
  {n:"5 Kuruş 1844–1861 · KM#673",      m:6.0130,  d:23.50, a:"ag830"},
  {n:"20 Kuruş 1844–1876 · KM#various", m:24.0000, d:37.00, a:"ag830"},
 ]},
 {region:"Romania",g:"Romania — gold",items:[
  {n:"20 Lei 1868–1906 · KM#various",   m:6.4516,  d:21.00, a:"au900cu"},
 ]},
 {region:"Romania",g:"Romania — silver",items:[
  {n:"5 Lei 1880–1901 · KM#17",         m:25.0000, d:37.00, a:"ag900"},
 ]},
 {region:"Bulgaria",g:"Bulgaria — gold",items:[
  {n:"10 Leva 1894 · KM#19",            m:3.2300,  d:19.00, a:"au900cu"},
  {n:"20 Leva 1894 · KM#20",            m:6.4516,  d:21.50, a:"au900cu"},
 ]},
 {region:"Bulgaria",g:"Bulgaria — silver",items:[
  {n:"5 Leva 1884–94 · KM#7/15/18",     m:25.0000, d:37.00, a:"ag900"},
 ]},
 {region:"Britain",g:"Britain — gold",items:[
  {n:"Sovereign",                    m:7.9881,  d:22.05, a:"au917cu"},
  {n:"Half Sovereign",               m:3.9941,  d:19.30, a:"au917cu"},
 ]},
 /* One planchet, three metals: weight and diameter stayed the same, the alloy did not. */
 {region:"Britain",g:"Britain — sterling silver, to 1919",items:[
  {n:"Crown · sterling · 1816–1919",       m:28.2759, d:38.61, a:"ag925"},
  {n:"Halfcrown · sterling · 1816–1919",   m:14.1380, d:32.31, a:"ag925"},
  {n:"Florin · sterling · 1849–1919",      m:11.3104, d:28.50, a:"ag925"},
  {n:"Shilling · sterling · 1816–1919",    m:5.6552,  d:23.50, a:"ag925"},
  {n:"Sixpence · sterling · 1816–1919",    m:2.8276,  d:19.50, a:"ag925"},
 ]},
 {region:"Britain",g:"Britain — .500 silver, 1920–1946",items:[
  {n:"Crown · .500 silver · 1920–1946",    m:28.2759, d:38.61, a:"ag500"},
  {n:"Halfcrown · .500 silver · 1920–1946",m:14.1380, d:32.31, a:"ag500"},
  {n:"Florin · .500 silver · 1920–1946",   m:11.3104, d:28.50, a:"ag500"},
  {n:"Shilling · .500 silver · 1920–1946", m:5.6552,  d:23.50, a:"ag500"},
  {n:"Sixpence · .500 silver · 1920–1946", m:2.8276,  d:19.50, a:"ag500"},
 ]},
 {region:"Britain",g:"Britain — cupronickel, 1947 onward",items:[
  {n:"Crown · cupronickel · 1947–1965",    m:28.2759, d:38.61, a:"cuni75"},
  {n:"Halfcrown · cupronickel · 1947–1967",m:14.1380, d:32.31, a:"cuni75"},
  {n:"Florin · cupronickel · 1947–1970",   m:11.3104, d:28.50, a:"cuni75"},
  {n:"Shilling · cupronickel · 1947–1970", m:5.6552,  d:23.50, a:"cuni75"},
  {n:"Sixpence · cupronickel · 1947–1970", m:2.8276,  d:19.50, a:"cuni75"},
 ]},
 {region:"Switzerland",g:"Switzerland — gold",items:[
  {n:"10 Francs Vreneli 1911–22 · KM#36",  m:3.2258,  d:19.00, a:"au900cu"},
  {n:"20 Francs Vreneli 1897–1949 · KM#35",m:6.4516,  d:21.00, a:"au900cu"},
 ]},
 {region:"Switzerland",g:"Switzerland — silver",items:[
  {n:"5 Francs 1931–67 · KM#40",           m:15.0000, d:31.45, a:"ag835"},
 ]},
 {region:"France",g:"France — gold",items:[
  {n:"10 Francs 1899–1914 · KM#846",       m:3.2258,  d:19.00, a:"au900cu"},
  {n:"20 Francs Rooster/Marianne 1899–1914 · KM#847", m:6.4516, d:21.00, a:"au900cu"},
 ]},
 {region:"France",g:"France — silver",items:[
  {n:"5 Francs Hercule 1870–89 · KM#820.1",m:25.0000, d:37.00, a:"ag900"},
 ]},
 {region:"Belgium",g:"Belgium — gold",items:[
  {n:"20 Francs Leopold II 1867–1914 · KM#37",m:6.4516, d:21.00, a:"au900cu"},
 ]},
 {region:"Belgium",g:"Belgium — silver",items:[
  {n:"5 Francs Leopold II 1865–76 · KM#24",m:25.0000, d:37.00, a:"ag900"},
 ]},
 {region:"Italy",g:"Italy — gold",items:[
  {n:"20 Lire 1861–1923 · KM#various",     m:6.4516,  d:21.00, a:"au900cu"},
 ]},
 {region:"Italy",g:"Italy — silver",items:[
  {n:"5 Lire 1861–1914 · KM#various",      m:25.0000, d:37.00, a:"ag900"},
 ]},
 {region:"Greece",g:"Greece — gold",items:[
  {n:"20 Drachmai George I 1876–84 · KM#various", m:6.4516, d:21.00, a:"au900cu"},
 ]},
 {region:"Greece",g:"Greece — silver",items:[
  {n:"5 Drachmai George I 1875–76 · KM#46",m:25.0000, d:37.00, a:"ag900"},
 ]},
 {region:"United States",g:"United States — gold, pre-1933",items:[
  {n:"$1 Gold Type 1 · 1849–54",       m:1.6718,  d:13.00, a:"au900cu"},
  {n:"$1 Gold Type 2/3 · 1854–89",     m:1.6718,  d:14.86, a:"au900cu"},
  {n:"$2½ Quarter Eagle · 1840–1929",  m:4.1795,  d:18.00, a:"au900cu"},
  {n:"$3 Gold · 1854–89",              m:5.0154,  d:20.50, a:"au900cu"},
  {n:"$5 Half Eagle · 1839–1929",      m:8.3591,  d:21.60, a:"au900cu"},
  {n:"$10 Eagle · 1838–1933",          m:16.7181, d:27.00, a:"au900cu"},
  {n:"$20 Double Eagle · 1850–1933",   m:33.4362, d:34.00, a:"au900cu"},
 ]},
 {region:"United States",g:"United States — silver and clad",items:[
  {n:"Trade Dollar · 1873–85",         m:27.2155, d:38.10, a:"ag900"},
  {n:"Seated Liberty Dollar · 1840–73",m:26.7296, d:38.10, a:"ag900"},
  {n:"Morgan Dollar · 1878–1921",      m:26.7296, d:38.10, a:"ag900"},
  {n:"Peace Dollar · 1921–35",         m:26.7296, d:38.10, a:"ag900"},
  {n:"Half Dollar 90% · 1873–1964",    m:12.5000, d:30.60, a:"ag900"},
  {n:"Half Dollar 40% clad · 1965–70", m:11.5000, d:30.60, a:"ag400"},
  {n:"Quarter 90% · 1873–1964",        m:6.2500,  d:24.30, a:"ag900"},
  {n:"Twenty Cents · 1875–78",         m:5.0000,  d:22.00, a:"ag900"},
  {n:"Dime 90% · 1873–1964",           m:2.5000,  d:17.90, a:"ag900"},
  {n:"Half Dollar clad · 1971–",       m:11.3400, d:30.61, a:"usclad"},
  {n:"Quarter clad · 1965–",           m:5.6700,  d:24.26, a:"usclad"},
  {n:"Dime clad · 1965–",              m:2.2680,  d:17.91, a:"usclad"},
 ]},
 {region:"Mexico",g:"Mexico",items:[
  {n:"8 Reales, cap and rays · 1824–97", m:27.0700, d:39.00, a:"ag900"},
 ]},
 {region:"Modern bullion",g:"Modern bullion",items:[
  {n:"Gold Eagle 1 oz",              m:33.931,  d:32.70, a:"au9167"},
  {n:"Krugerrand 1 oz",              m:33.930,  d:32.77, a:"au917cu"},
  {n:"Maple Leaf 1 oz",              m:31.103,  d:30.00, a:"au999"},
  {n:"Silver Eagle 1 oz",            m:31.103,  d:40.60, a:"ag999"},
  {n:"Silver Maple 1 oz",            m:31.103,  d:38.00, a:"ag999"},
 ]},
];
const flat=[];COINS.forEach(g=>g.items.forEach(c=>flat.push(c)));

/* ───────── superseded catalogue identities (Lite 3.5 / Pro 4.8) ─────────
   A split entry cannot be reassigned automatically, so saved data under an old
   name is kept unassigned, never deleted. A corrected preset migrates. */
const CATALOGUE_SUCCESSORS={
 "2 Dinara 1875–1915 · KM#26":["2 Dinara 1879, 1897 · Milan, Aleksandar I","2 Dinara 1904–1915 · Petar I · KM#26"],
 "Crown · 1816–1965":["Crown · sterling · 1816–1919","Crown · .500 silver · 1920–1946","Crown · cupronickel · 1947–1965"],
 "Halfcrown · 1816–1967":["Halfcrown · sterling · 1816–1919","Halfcrown · .500 silver · 1920–1946","Halfcrown · cupronickel · 1947–1967"],
 "Florin · 1849–1970":["Florin · sterling · 1849–1919","Florin · .500 silver · 1920–1946","Florin · cupronickel · 1947–1970"],
 "Shilling · 1816–1970":["Shilling · sterling · 1816–1919","Shilling · .500 silver · 1920–1946","Shilling · cupronickel · 1947–1970"],
 "Sixpence · 1816–1970":["Sixpence · sterling · 1816–1919","Sixpence · .500 silver · 1920–1946","Sixpence · cupronickel · 1947–1970"],
};
const ALLOY_SUCCESSORS={"Krugerrand 1 oz|au9167":"au917cu","Sovereign|au9167":"au917cu","Half Sovereign|au9167":"au917cu"};


