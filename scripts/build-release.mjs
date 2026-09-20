import {readdir,readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export async function build(root,output){
 root=path.resolve(root);output=path.resolve(output);
 if(root===output)throw Error('Use a separate output directory');
 const files=[];
 async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
   const full=path.join(dir,entry.name),rel=path.relative(root,full).split(path.sep).join('/');
   if(full===output||(entry.name.startsWith('.')&&entry.name!=='.well-known')||entry.name==='node_modules'||['scripts','_site'].includes(rel)||/\.zip$/i.test(entry.name)||/^LEIA-ME.*\.md$/i.test(entry.name)||rel==='relevant.txt'||rel==='version.json')continue;
   if(entry.isDirectory())await walk(full);else if(entry.isFile())files.push(rel);
  }
 }
 await walk(root);files.sort();
 const hash=createHash('sha256');
 for(const file of files){
  // The scheduled war snapshot is live data, not a new app release.
  if(file==='dados/major-order.json')continue;
  hash.update(file+'\0');hash.update(createHash('sha256').update(await readFile(path.join(root,file))).digest());
 }
 const version=hash.digest('hex');
 for(const file of files){
  const target=path.join(output,file);await mkdir(path.dirname(target),{recursive:true});
  if(file==='deploy-check.js'||file==='sw.js'){
   let text=await readFile(path.join(root,file),'utf8');
   if(file==='deploy-check.js')text=text.replaceAll('__HDBR_RELEASE__',version);
   else text=text.replace(/const VERSION\s*=\s*['"][^'"]+['"];/,`const VERSION='${version}';`);
   await writeFile(target,text);
  }else await copyFile(path.join(root,file),target);
 }
 await writeFile(path.join(output,'version.json'),JSON.stringify({schema:1,version}));
 await writeFile(path.join(output,'.nojekyll'),'');
 return {version,files:files.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log(await build(process.cwd(),process.argv[2]||'_site'));
}
