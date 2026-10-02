const fs=require('fs'),crypto=require('crypto'),path=require('path');
const checks={"mapa-classico.html": ["33e4de0dd40fa4e7669829f5961bbd9a801511182023bcf9352a2bee0c840394", "6bffca09a91855bb502adc39b44137326ec940cc03feb9e06d69f7bb7bd02cdb"], "mapa-classico.css": ["104660ff3e4057b9e5b0c243d77952dffa2076dccbc64dd21701297f8d7f8fbe", "7fe9089498f8536b91f052c44534d5527447f331c315838954efd8fd9e59c558"], "mapa-classico.js": ["239f92e34bb4ac0b51ced621b7477e695919efd43de8fdeec834dd0e55b86a1c", "0f916d227b5ccffb3a4c5b3f5936d8ffa7b2e1cdfa93af8fd800470ad5632d78"], "mapa-galatico.html": ["6461ae1d56ce35f07cce4c7e2ba75ff96098ec2d4a07eaf7527f3a571765c01d", "1ef8b4a53528362dd7622c564a97e4efea32da5f0e5693a3b9c67cfd293aa190"], "mobile-nav.js": ["4e795102e0942507363e8277e841ff5c3525e065f0c1d4330bd08c0ce5af1433", "aa631c1a079d73ecc5f7c517e91778714a14b4c259e455075ab1d6450d8b4977"], "busca.js": ["137128e23c60014625bd2809af932e1725dba0ba040daca5e74a23708cca8e81", "e3fb467b86844501d92ad8d4d65b7f8099bb76fba146dec3fc553252b52b2d27"], "theme.js": ["4ddd49bbbd80eb9bbd1d0d53771dc6730f746e12a65a9f74eb4180a8f086f4f1", "25b33d1ed87c3a4a1d3d5cce73bdd9b8a41a05dd18b0739fa43fbaebda0a522d"]};
let failed=false;
for(const [name,accepted] of Object.entries(checks)){
 const file=path.join(process.cwd(),name);
 if(!fs.existsSync(file)){console.error('Falta: '+name);failed=true;continue;}
 const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n').replace(/^\uFEFF/,'');
 const hash=crypto.createHash('sha256').update(text).digest('hex');
 if(!accepted.includes(hash)){console.error('Arquivo diferente da base revisada: '+name);failed=true;}
}
if(failed){console.error('Não substitua esses arquivos: precisamos comparar a sua versão atual.');process.exitCode=1;}
else console.log('Base compatível. Pode copiar os 7 arquivos do patch para a raiz do projeto.');
