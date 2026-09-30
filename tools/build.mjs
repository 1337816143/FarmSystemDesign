import fs from 'node:fs';
const target='_site';fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target);
for(const p of ['index.html','styles.css','studio.css','research.css','vendor','version.json','CHANGELOG.md','icon.svg','manifest.webmanifest','sw.js','src','data','docs'])fs.cpSync(p,`${target}/${p}`,{recursive:true});
fs.writeFileSync(`${target}/.nojekyll`,'');
// Old failed browse acquisition is a QC record, not an image offered as valid data.
fs.rmSync(`${target}/data/public/modis-2025-01-15.jpg`,{force:true});
console.log('Static research application prepared in _site/');
