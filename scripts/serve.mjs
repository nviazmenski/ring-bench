// Serve the source tree on localhost so both editions get microphone access. No dependencies.
import http from "node:http";import fs from "node:fs";import path from "node:path";import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),port=Number(process.argv[2]||8080);
const TYPES={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".wav":"audio/wav"};
http.createServer((req,res)=>{
  let name;try{name=decodeURIComponent(new URL(req.url,"http://localhost").pathname);}catch{res.writeHead(400).end();return;}
  if(name.endsWith("/"))name+="index.html";
  const file=path.join(root,name);
  if(!file.startsWith(root+path.sep)||file.split(path.sep).includes(".git")){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404,{"content-type":"text/plain"}).end("Not found");return;}
    res.writeHead(200,{"content-type":TYPES[path.extname(file)]||"application/octet-stream","cache-control":"no-store"}).end(data);
  });
}).listen(port,"127.0.0.1",()=>console.log("RingBench source: http://localhost:"+port+"/  (Lite: /lite/  Pro: /pro/)"));
