import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {build} from './build-release.mjs';
test('release generates consistent version, excludes tooling and live snapshot changes, removes obsolete output',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'hdbr-release-')),out=path.join(root,'_site');
 try{
  for(const dir of ['dados','central-api/node_modules','verificacao','auditoria-telemetria','scripts','imagens'])await mkdir(path.join(root,dir),{recursive:true});
  for(const [file,text] of Object.entries({'index.html':'<main>site</main>','deploy-check.js':"const installed='__HDBR_RELEASE__';",'sw.js':"const VERSION='old';",'dados/major-order.json':'{"state":"active"}','imagens/planet.png':'picture','central-api/core.mjs':'backend','verificacao/testar.cjs':'test','test-map.cjs':'test'}))await writeFile(path.join(root,file),text);
  const a=await build(root,out),v=JSON.parse(await readFile(path.join(out,'version.json'),'utf8'));assert.match(v.version,/^[a-f0-9]{64}$/);assert.equal(v.version,a.version);
  assert.ok((await readFile(path.join(out,'deploy-check.js'),'utf8')).includes(a.version));assert.ok((await readFile(path.join(out,'sw.js'),'utf8')).includes(a.version));await access(path.join(out,'imagens/planet.png'));
  for(const file of ['central-api/core.mjs','verificacao/testar.cjs','test-map.cjs'])await assert.rejects(access(path.join(out,file)));
  await writeFile(path.join(out,'obsolete.html'),'old');await writeFile(path.join(root,'dados/major-order.json'),'{"state":"completed"}');await writeFile(path.join(root,'central-api/core.mjs'),'new backend');
  const b=await build(root,out);assert.equal(a.version,b.version);await assert.rejects(access(path.join(out,'obsolete.html')));
  await writeFile(path.join(root,'index.html'),'<main>new site</main>');const c=await build(root,out);assert.notEqual(c.version,a.version);
  await assert.rejects(build(root,root));await assert.rejects(build(root,path.dirname(root)));
 }finally{await rm(root,{recursive:true,force:true});}
});
