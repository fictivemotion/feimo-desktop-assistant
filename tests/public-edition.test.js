const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('public runtime excludes private learning integration and uses public sound sources',()=>{
 const root=path.join(__dirname,'..');
 for(const f of ['lib/study-bridge.js','renderer/workbar/tabs/study.js','renderer/shared/study-rich.js'])assert.equal(fs.existsSync(path.join(root,f)),false,f);
 for(const f of ['main.js','preload/workbar-preload.js','preload/quick-preload.js','renderer/workbar/workbar.html','renderer/workbar/workbar.js','renderer/quick/quick.js'])assert.doesNotMatch(fs.readFileSync(path.join(root,f),'utf8'),/StudyBridge|study:|studyLogin|view-study|闪念上岸|shangancard/i,f);
 const sounds=JSON.parse(fs.readFileSync(path.join(root,'assets/soundscape/catalog.json'),'utf8'));
 assert.doesNotMatch(JSON.stringify(sounds),/shangancard|companion\/|study:/i);
 assert.match(fs.readFileSync(path.join(root,'main.js'),'utf8'),/斐墨助手/);
});
