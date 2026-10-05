'use strict';
const fs=require('node:fs'),path=require('node:path');
// PowerShell cannot execute a path inside app.asar. Copy our bundled scripts to userData.
function nativeScript(file,dir){fs.mkdirSync(dir,{recursive:true});const target=path.join(dir,path.basename(file));const data=fs.readFileSync(file);if(!fs.existsSync(target)||!fs.readFileSync(target).equals(data))fs.writeFileSync(target,data);return target;}
module.exports={nativeScript};
