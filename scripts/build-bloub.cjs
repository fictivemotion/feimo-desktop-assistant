'use strict';
// Pinned upstream sources are vendored; builds never fetch unreviewed code.
const path=require('node:path');
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../assets/pets/bloub/engine-entry.ts')],outfile:path.join(__dirname,'../assets/pets/bloub/engine.js'),bundle:true,format:'iife',globalName:'Bloub',target:'chrome130',minify:true,legalComments:'none',banner:{js:'/* Bloub engine, MIT © 2026 Jérémy Perret. See LICENSE and SOURCE.md. */'}});
