import test from 'node:test';
import assert from 'node:assert/strict';
import {usesStaticHosting,request,PORTABLE_DOWNLOAD} from '../src/farmdesign/api.js';
test('hosted FarmDESIGN advertises the portable engine without sending data to a static API',async()=>{
 assert.equal(usesStaticHosting('1337816143.github.io'),true);assert.equal(usesStaticHosting('127.0.0.1'),false);assert.equal(usesStaticHosting('localhost'),false);
 const previous=Object.getOwnPropertyDescriptor(globalThis,'location');const fetchBefore=globalThis.fetch;let calls=0;
 Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname:'1337816143.github.io'}});globalThis.fetch=()=>{calls++;throw Error('Static API must not receive a request');};
 try{assert.equal((await request('capabilities')).static,true);await assert.rejects(request('evaluate',{document:{private:'keep local'}}),/Windows portable app/);assert.equal(calls,0);assert.match(PORTABLE_DOWNLOAD,/releases\/download\/v0.3.26\/FarmSystemDesign-Windows-v0.3.26.zip$/);}finally{globalThis.fetch=fetchBefore;if(previous)Object.defineProperty(globalThis,'location',previous);else delete globalThis.location;}
});
