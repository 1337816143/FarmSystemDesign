import {search} from './model.js';
self.onmessage=({data})=>{try{const result=search(data.dataset,data.farmIds,data.config,data.climate,progress=>postMessage({type:'progress',progress}));postMessage({type:'result',result});}catch(error){postMessage({type:'error',error:error.message});}};
