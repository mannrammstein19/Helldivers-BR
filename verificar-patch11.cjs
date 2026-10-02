const fs=require('fs'),crypto=require('crypto');
const checks={"mapa-classico.html": ["ec2bf66b7fbfa8acc124e15bbc8731d7efc2d8bb841ee62ceec8189e56cd9fc3", "fac9f9339ffff646d2d566263d17d70dc18568f7189af9a666a666e470381b67"], "mapa-classico.css": ["65c89cf7f66fbdb27697690b8f5a2c222b4a4018b1274c8fdb2a0b64b2c99f5b", "ca1e0ae0d4fc2e4a919df99ce47c1ff11e934b7725e44ea6db0c7b030018c9af"], "mapa-classico.js": ["2fcce25063c7a9bdeda331c60829b1636e9d892de7adb97ac1ee2560b21af1ea", "941fe6e60e636624bd5e808fa11afafdafef162ab2ad95fa85b53614644c87b3"]};let fail=false;
for(const [file,accepted] of Object.entries(checks)){
 if(!fs.existsSync(file)){console.error('Falta: '+file);fail=true;continue;}
 const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n').replace(/^\uFEFF/,'');
 if(!accepted.includes(crypto.createHash('sha256').update(text).digest('hex'))){console.error('Arquivo diferente da base: '+file);fail=true;}
}
if(fail){console.error('Envie os arquivos indicados antes de substituir.');process.exitCode=1;}
else console.log('Base compatível. Copie os três arquivos mapa-classico do Patch 11.');
