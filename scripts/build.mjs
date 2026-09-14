import fs from "node:fs";import path from "node:path";import {fileURLToPath} from "node:url";
const edition=process.argv[2],out=path.resolve(process.argv[3]||"dist-"+edition),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
if(!["lite","pro"].includes(edition))throw Error("Use lite or pro");
if(out===root||!path.basename(out).startsWith("dist"))throw Error("Output must be a dist directory");
fs.mkdirSync(path.join(out,"shared"),{recursive:true});
for(const f of fs.readdirSync(path.join(root,"shared")))fs.copyFileSync(path.join(root,"shared",f),path.join(out,"shared",f));
for(const f of fs.readdirSync(path.join(root,edition))){
 let data=fs.readFileSync(path.join(root,edition,f));
 if(f.endsWith(".html")||f==="sw.js")data=Buffer.from(data.toString().replaceAll("../shared/","./shared/"));
 fs.writeFileSync(path.join(out,f),data);
}
console.log(edition+" staged at "+out);
