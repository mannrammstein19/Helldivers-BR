const fs=require('fs'),crypto=require('crypto');
const checks={"index.html": ["b006debd331b5360f62c0f397cb7eebb97d7faf73fa18ed848312a9dcd622718", "2621981712f8120a3286195a9fc6249ff995605f2bd955467a14ef24c0e3829b"], "overview.js": ["2cc3ddd5465a57e6a6e46428a67deb11eee1960c4b5a598f57a13289ea66f792", "9a0e88152c0ea75e8c7627460dc5937dbe2de361802a9d02484aa8064053c100"], "home-finish.css": ["1718f6698b64b4dc75938a7ae110282309dc38f02c8368a92714d68d539831bc", "ca1202739d270a1895e1b525e2e34dd35d1f4f81b5797f795bfa9b7cf1d3ce15"], "mapa-classico.html": ["4388c3169e40d3a226cf81e3186758420f1b4485c108aa34fb799de88618bfc5", "ec2bf66b7fbfa8acc124e15bbc8731d7efc2d8bb841ee62ceec8189e56cd9fc3"], "mapa-classico.css": ["f9008247957a9af1531aef6b0a7c7e73a1d9fb39c44702f0c5e8bdf73305b540", "65c89cf7f66fbdb27697690b8f5a2c222b4a4018b1274c8fdb2a0b64b2c99f5b"], "mapa-classico.js": ["89f391aba7e54b32aaa3c172c9dece7578d132ca83fce3962c39bb285e337950", "2fcce25063c7a9bdeda331c60829b1636e9d892de7adb97ac1ee2560b21af1ea"]};let fail=false;
for(const [name,accepted] of Object.entries(checks)){
 if(!fs.existsSync(name)){console.error('Falta: '+name);fail=true;continue;}
 const value=fs.readFileSync(name,'utf8').replace(/\r\n/g,'\n').replace(/^\uFEFF/,'');
 if(!accepted.includes(crypto.createHash('sha256').update(value).digest('hex'))){console.error('Arquivo diferente da base: '+name);fail=true;}
}
if(!fs.existsSync('campaign-metrics.js')){console.error('Falta campaign-metrics.js do Patch 09');fail=true;}
if(fail){console.error('Envie os arquivos indicados antes de substituir.');process.exitCode=1;}
else console.log('Base compatível. Copie somente os seis arquivos indicados no LEIA-PRIMEIRO.');
