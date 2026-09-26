// Release hygiene: each edition's entrypoint, offline worker and page must describe the same build.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
for(const edition of ['lite','pro']){
  const html=read(edition+'/index.html'),entry=read(edition+'/'+edition+'.js'),worker=read(edition+'/sw.js');
  test(edition+' entrypoint and service worker carry the same build identifier',()=>{
    const build=entry.match(/build:"([^"]+)"/)?.[1],version=worker.match(/const VERSION="([^"]+)"/)?.[1];
    assert.ok(build&&build.includes('.'+edition+'-'),'entrypoint build id');
    assert.equal(version,build);
  });
  test(edition+' offline cache covers every script and stylesheet the page loads',()=>{
    const files=vm.runInNewContext(worker.match(/const FILES=(.*);$/m)[1]);
    const loaded=[...html.matchAll(/<(?:script src|link rel="stylesheet" href)="([^"]+)"/g)].map(m=>m[1]);
    assert.ok(loaded.length>3);
    for(const f of loaded)assert.ok(files.includes(f),f+' is loaded by '+edition+'/index.html but not precached');
    for(const f of files.filter(f=>f.startsWith('../shared/')))assert.ok(fs.existsSync(path.join(__dirname,'..',edition,f)),f+' is precached but missing');
  });
}
test('every shared module is loaded by both editions',()=>{
  for(const f of fs.readdirSync(path.join(__dirname,'../shared')))for(const edition of ['lite','pro'])assert.ok(read(edition+'/index.html').includes('../shared/'+f),f+' missing from '+edition);
});
