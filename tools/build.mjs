import fs from 'node:fs';
import {makeOfflineManifest} from './offline-manifest.mjs';
const target='_site';fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target);
for(const p of ['index.html','offline.html','discussion','styles.css','studio.css','research.css','language.css','vendor','version.json','CHANGELOG.md','GLOSSARY.md','icon.svg','manifest.webmanifest','sw.js','src','data','docs'])fs.cpSync(p,`${target}/${p}`,{recursive:true});
fs.rmSync(`${target}/data/hainan/source`,{recursive:true,force:true});
fs.writeFileSync(`${target}/.nojekyll`,'');
// Old failed browse acquisition is a QC record, not an image offered as valid data.
fs.rmSync(`${target}/data/public/modis-2025-01-15.jpg`,{force:true});
const version=JSON.parse(fs.readFileSync(`${target}/version.json`)).version;
const manifest=makeOfflineManifest(target,version);
fs.writeFileSync(`${target}/offline-manifest.json`,JSON.stringify(manifest)+'\n');
console.log(`Static research application prepared in _site/: ${manifest.totalFiles} verified offline files, ${manifest.totalBytes} bytes.`);
