'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dest=path.join(root,'assets/vendor/rive');fs.mkdirSync(dest,{recursive:true});
for(const file of ['rive.js','rive.wasm'])fs.copyFileSync(path.join(root,'node_modules/@rive-app/canvas',file),path.join(dest,file));
require('esbuild').buildSync({entryPoints:[path.join(root,'renderer/soundscape/feedback.js')],outfile:path.join(root,'renderer/soundscape/feedback.bundle.js'),bundle:true,minify:true,platform:'browser',target:'chrome144'});
