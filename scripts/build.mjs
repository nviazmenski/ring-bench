import fs from "node:fs";import path from "node:path";import {fileURLToPath} from "node:url";
const [edition,target,...flags]=process.argv.slice(2),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const out=path.resolve(target||"dist-"+edition);
if(!["lite","pro"].includes(edition))throw Error("Use lite or pro");
// The output is cleared before staging, so only accept dist or dist-<name>.
if(out===root||!/^dist(-[a-z]+)?$/.test(path.basename(out)))throw Error("Output must be a dist or dist-<name> directory");
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(path.join(out,"shared"),{recursive:true});
for(const f of fs.readdirSync(path.join(root,"shared")))fs.copyFileSync(path.join(root,"shared",f),path.join(out,"shared",f));
for(const f of fs.readdirSync(path.join(root,edition))){
 let data=fs.readFileSync(path.join(root,edition,f));
 if(f.endsWith(".html")||f==="sw.js")data=Buffer.from(data.toString().replaceAll("../shared/","./shared/"));
 fs.writeFileSync(path.join(out,f),data);
}
console.log(edition+" staged at "+out);
// --hosting points .openai/hosting.json (untracked) at this edition's hosting project.
if(flags.includes("--hosting")){
 const config=JSON.parse(fs.readFileSync(path.join(root,"hosting",edition+".json"),"utf8"));
 if(path.resolve(root,config.static.directory)!==out)throw Error("hosting/"+edition+".json publishes "+config.static.directory+"; build into that directory");
 fs.mkdirSync(path.join(root,".openai"),{recursive:true});
 fs.writeFileSync(path.join(root,".openai","hosting.json"),JSON.stringify(config));
 console.log(".openai/hosting.json now publishes "+edition+" ("+config.project_id+")");
}
