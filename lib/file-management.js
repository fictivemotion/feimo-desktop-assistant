'use strict';
const fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{within}=require('./file-library-links');
const clean=value=>{const name=String(value||'').normalize('NFC').trim();if(!name||name.length>180||/[<>:"/\\|?*\x00-\x1f]/.test(name)||/[. ]$/.test(name)||/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name)||['.','..'].includes(name))throw Error('名称不能为空，且不能包含路径或特殊字符');return name;};
class FileManagement{
 constructor(library){this.lib=library;}
 local(target){const base=sync.realpathSync(this.lib.root),real=sync.realpathSync(target);if(!within(base,real)||sync.lstatSync(target).isSymbolicLink())throw Error('不操作文件库范围外的链接');return real;}
 entry({type,id}={}){
  const l=this.lib;if(typeof id!=='string'||!['file','folder','project','reference'].includes(type))throw Error('请选择文件或文件夹');
  if(id.startsWith('ref.')){const d=l.links.decode(id),r=l.links.resolve(d.linkId,d.relative);if(!d.relative)throw Error('不能修改引用根目录');return {...r,link:r.record,record:undefined,id,type:'reference',isDirectory:sync.statSync(r.target).isDirectory()};}
  if(type==='file'){const record=l.data.files.find(f=>f.id===id);if(!record)throw Error('文件已不存在');return {type,id,record,target:this.local(l.pathFor(id)),isDirectory:false};}
  const project=l.data.projects.find(p=>p.id===id||p.folders.some(f=>f.id===id)),record=type==='project'?project:project?.folders.find(f=>f.id===id);if(!project||!record||record.id!==id)throw Error('文件夹已不存在');
  return {type,id,project,record,alias:!!record.externalPath,target:record.externalPath||this.local(l.location(project.id,type==='folder'?id:null)),isDirectory:true};
 }
 destination({projectId,folderId,relative=''}={}){
  const l=this.lib,p=l.data.projects.find(p=>p.id===projectId);if(!p)throw Error('请选择目标文件夹');const f=folderId?p.folders.find(f=>f.id===folderId):null;if(folderId&&!f)throw Error('目标文件夹不存在');
  if(p.externalPath||f?.externalPath)return {...l.links.resolve((f||p).id,relative),projectId:p.id,folderId:f?.id||null,external:true};
  if(relative)throw Error('本地分类路径无效');return {target:this.local(l.location(p.id,f?.id)),projectId:p.id,folderId:f?.id||null,external:false};
 }
 async manifest(base){const rows=[];const visit=async dir=>{for(const d of await fs.readdir(dir,{withFileTypes:true})){if(rows.length>=20000)throw Error('文件夹项目过多，请通过外部引用管理');if(d.isSymbolicLink())throw Error('请先移除文件夹中的符号链接');const p=path.join(dir,d.name),s=await fs.stat(p);rows.push([path.relative(base,p),d.isDirectory()?'directory':s.size,s.mtimeMs]);if(d.isDirectory())await visit(p);}};await visit(base);return rows.sort((a,b)=>a[0].localeCompare(b[0]));}
 async moveFile(source,target){try{await fs.rename(source,target);}catch(error){if(error.code!=='EXDEV')throw error;const before=await fs.stat(source);if(before.isDirectory()){
   const initial=await this.manifest(source),temporary=path.join(path.dirname(target),'.feimo-move-'+crypto.randomUUID());
   try{await fs.cp(source,temporary,{recursive:true,errorOnExist:true,force:false,preserveTimestamps:true,filter:async file=>{if((await fs.lstat(file)).isSymbolicLink())throw Error('不移动符号链接');return true;}});if(JSON.stringify(initial)!==JSON.stringify(await this.manifest(source)))throw Error('文件夹正在被修改，请稍后移动');if(sync.existsSync(target))throw Error('目标位置已有同名文件夹');await fs.rename(temporary,target);try{await this.lib.trash(source);}catch(e){await fs.rm(target,{recursive:true,force:true});throw e;}}
   catch(e){await fs.rm(temporary,{recursive:true,force:true}).catch(()=>{});throw e;}return;
  }await fs.copyFile(source,target,sync.constants.COPYFILE_EXCL);try{const after=await fs.stat(source);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('文件正在被修改，请稍后移动');await fs.unlink(source);}catch(e){await fs.unlink(target).catch(()=>{});throw e;}}}
 paths(record,from,to){for(const f of this.lib.data.files){const actual=path.resolve(this.lib.root,f.path);if(within(from,actual))f.path=path.relative(this.lib.root,path.join(to,path.relative(from,actual)));}}
 descendants(project,id){const ids=new Set([id]);let changed=true;while(changed){changed=false;for(const f of project.folders)if(ids.has(f.parentId)&&!ids.has(f.id)){ids.add(f.id);changed=true;}}return project.folders.filter(f=>ids.has(f.id));}
 async indexTree(target,dest){const l=this.lib,p=l.data.projects.find(p=>p.id===dest.projectId),base=l.location(p.id),root={id:crypto.randomUUID(),name:path.basename(target),directory:path.relative(base,target),parentId:dest.folderId||null};p.folders.push(root);let count=0;const visit=async(dir,parent)=>{for(const d of await fs.readdir(dir,{withFileTypes:true})){if(++count>20000)throw Error('文件夹项目过多，请通过外部引用管理');if(d.isSymbolicLink())throw Error('请先移除文件夹中的符号链接');const file=path.join(dir,d.name);if(d.isDirectory()){const folder={id:crypto.randomUUID(),name:d.name,directory:path.relative(base,file),parentId:parent.id};p.folders.push(folder);await visit(file,folder);}else if(d.isFile()){const stat=await fs.stat(file);l.data.files.unshift({id:crypto.randomUUID(),name:d.name,path:path.relative(l.root,file),projectId:p.id,folderId:parent.id,size:stat.size,createdAt:stat.mtime.toISOString(),kind:'文件名与类型',excerpt:''});}}};await visit(target,root);}
 async manage(value){return this.lib.locked(async()=>{
  const l=this.lib,e=this.entry(value?.entry),before=structuredClone(l.data);let undo=null;
  try{
   if(value.op==='rename'){
    const name=clean(value.name);if(e.alias){e.record.name=name;}else{
     const target=path.join(path.dirname(e.target),e.isDirectory&&e.record?name+'-'+e.id.slice(0,8):name);
     if(path.resolve(target)!==path.resolve(e.target)&&sync.existsSync(target))throw Error('同名文件或文件夹已存在');
     if(target!==e.target){await fs.rename(e.target,target);undo=()=>fs.rename(target,e.target);}
     if(e.type==='file'){e.record.name=name;e.record.path=path.relative(l.root,target);}else if(e.record){const previousDirectory=e.record.directory;e.record.name=name;e.record.directory=e.type==='project'?path.basename(target):path.relative(l.location(e.project.id),target);if(e.type==='folder')for(const f of this.descendants(e.project,e.id))if(f.id!==e.id&&!f.externalPath)f.directory=path.join(e.record.directory,path.relative(previousDirectory,f.directory));this.paths(e.record,e.target,target);}
    }
   }else if(value.op==='delete'){
    if(e.alias){if(e.type==='project')l.data.projects=l.data.projects.filter(p=>p.id!==e.id);else e.project.folders=e.project.folders.filter(f=>f.id!==e.id);}
    else if(e.type==='file')l.data.files=l.data.files.filter(f=>f.id!==e.id);
    else if(e.type==='project'){l.data.projects=l.data.projects.filter(p=>p.id!==e.id);l.data.files=l.data.files.filter(f=>f.projectId!==e.id);}
    else if(e.type==='folder'){const ids=new Set(this.descendants(e.project,e.id).map(f=>f.id));e.project.folders=e.project.folders.filter(f=>!ids.has(f.id));l.data.files=l.data.files.filter(f=>!ids.has(f.folderId));}
    l.write();if(!e.alias)await l.trash(e.target);l.links.cache.clear();l.onChange();return true;
   }else if(value.op==='move'){
    if(e.alias){const p=value.target?.projectId?l.data.projects.find(p=>p.id===value.target.projectId):null;if(value.target?.projectId&&(!p||p.externalPath||p.id===e.id))throw Error('请选择其他本地项目');if(value.target?.folderId){const f=p?.folders.find(f=>f.id===value.target.folderId);if(!f||f.externalPath||f.id===e.id)throw Error('目标位置无效');}if(e.type==='project')l.data.projects=l.data.projects.filter(p=>p.id!==e.id);else e.project.folders=e.project.folders.filter(f=>f.id!==e.id);if(p)p.folders.push({...e.record,folders:undefined,parentId:value.target?.folderId||null});else l.data.projects.push({...e.record,folders:[]});}
    else{
     const dest=this.destination(value.target);if(e.isDirectory&&within(e.target,dest.target))throw Error('不能移到自身或子文件夹');
     if(e.isDirectory&&e.record&&dest.external)throw Error('分类文件夹请移到本地项目或项目内的文件夹');
     const target=path.join(dest.target,path.basename(e.target));if(target===e.target)return true;if(sync.existsSync(target))throw Error('目标位置已有同名文件或文件夹');
     await this.moveFile(e.target,target);undo=()=>this.moveFile(target,e.target);
     if(!e.isDirectory){if(e.type==='file'){if(dest.external)l.data.files=l.data.files.filter(f=>f.id!==e.id);else Object.assign(e.record,{projectId:dest.projectId,folderId:dest.folderId,path:path.relative(l.root,target)});}else if(!dest.external){const stat=await fs.stat(target);l.data.files.unshift({id:crypto.randomUUID(),name:path.basename(target),size:stat.size,projectId:dest.projectId,folderId:dest.folderId,path:path.relative(l.root,target),createdAt:new Date().toISOString(),kind:'文件名与类型',excerpt:''});}}
     else if(e.record){const destination=l.data.projects.find(p=>p.id===dest.projectId),children=e.type==='project'?[...e.record.folders]:this.descendants(e.project,e.id).filter(f=>f.id!==e.id),ids=new Set([e.id,...children.map(f=>f.id)]),oldDirectory=e.record.directory,newDirectory=path.relative(l.location(destination.id),target);if(e.type==='project')l.data.projects=l.data.projects.filter(p=>p.id!==e.id);else e.project.folders=e.project.folders.filter(f=>!ids.has(f.id));destination.folders.push({...e.record,folders:undefined,directory:newDirectory,parentId:dest.folderId||null});for(const f of children)destination.folders.push({...f,parentId:f.parentId||e.id,directory:f.externalPath?'':path.join(newDirectory,e.type==='project'?f.directory:path.relative(oldDirectory,f.directory))});this.paths(e.record,e.target,target);for(const f of l.data.files)if(e.type==='project'?f.projectId===e.id:ids.has(f.folderId))Object.assign(f,{projectId:destination.id,folderId:f.folderId||e.id});}
     else if(e.isDirectory&&!dest.external)await this.indexTree(target,dest);
    }
   }else throw Error('不支持的文件操作');
   l.write();l.links.cache.clear();return true;
  }catch(error){l.data=before;if(undo)await undo().catch(()=>{});if(value.op==='delete')try{l.write();}catch{}throw error;}
 });}
 async importInto({paths,projectId,folderId,relative=''}={}){return this.lib.locked(async()=>{
  if(!Array.isArray(paths)||!paths.length||paths.length>30||paths.some(p=>typeof p!=='string'))throw Error('一次最多拖入30个真实文件');const l=this.lib;
  if(!projectId)projectId=l.createNow(null,'收集箱').id;
  const dest=this.destination({projectId,folderId,relative}),before=structuredClone(l.data),created=[],result=[];
  try{for(const source of [...new Set(paths)]){const from=await fs.realpath(source),stat=await fs.stat(from);if(!stat.isFile()||stat.size>1024*1024*1024)throw Error('请拖入不超过1GB的文件，文件夹可使用“引入文件夹”');const name=clean(path.basename(from));let target=path.join(dest.target,name),index=1;if(target===from)continue;while(sync.existsSync(target)){const ext=path.extname(name);target=path.join(dest.target,path.basename(name,ext)+' ('+index+++')'+ext);}await fs.copyFile(from,target,sync.constants.COPYFILE_EXCL);created.push(target);const id=crypto.randomUUID();if(!dest.external)l.data.files.unshift({id,name:path.basename(target),size:stat.size,projectId,folderId:folderId||null,path:path.relative(l.root,target),createdAt:new Date().toISOString(),kind:'文件名与类型',excerpt:''});result.push({id,name:path.basename(target)});}
   l.write();l.links.cache.clear();return result;
  }catch(error){l.data=before;for(const target of created)if(within(dest.target,target))await fs.unlink(target).catch(()=>{});throw error;}
 });}
}
module.exports={FileManagement,clean};
