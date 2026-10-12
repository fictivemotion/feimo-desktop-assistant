'use strict';
function sectionFor(notes,version){const escaped=version.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),header=new RegExp('^'+escaped+'(?:\\s|$)');return notes.split(/^##\s+/m).find(s=>header.test(s));}
module.exports={sectionFor};
