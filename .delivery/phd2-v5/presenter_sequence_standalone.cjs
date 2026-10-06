/* Node VM ordering regression only. This does not establish browser compatibility. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path'),crypto=require('crypto');
const INPUT=path.resolve(process.argv[2]), OUTPUT=process.argv[3], checks=[];
const html=fs.readFileSync(INPUT,'utf8');
const start=html.indexOf('/* Own adapter around'),end=html.indexOf('window.phdDeck=',start);
assert(start>0&&end>start,'MIT bridge must be embedded in the supplied HTML');
function ck(test,label){assert(test,label);checks.push(label)}
function harness(source){
 const sent=[],element={setAttribute(){},getBoundingClientRect(){return {width:1200,height:700}}};
 const c={crypto:crypto.webcrypto,params:new URLSearchParams(),location:{protocol:'file:',origin:'null'},innerWidth:1440,innerHeight:900,URL,Date,setTimeout(){},clearTimeout(){},document:{documentElement:{dataset:{}},getElementById(){return element}},window:{addEventListener(){}},BroadcastChannel:class{postMessage(m){sent.push(m)}},slides:Array.from({length:18},()=>element),sent};
 vm.createContext(c);vm.runInContext("let current=0,lang='en',step=0;function go(i){current=i;sendSpeakerState()}function language(l){lang=l;sendSpeakerState()}",c);vm.runInContext(source,c);vm.runInContext("speakerPeer='peer'",c);
 return {c,sent,packet(data){return {bridge:'hainan-mit-presenter-v1',sessionId:vm.runInContext('sessionId',c),peerToken:'peer',from:'presenter',messageId:'id-'+Math.random(),...data}},send(m){c.receivePresenterPacket(m)},state(){return vm.runInContext('({current,lang,clock:{...speakerClock}})',c)}};
}
const bridge=html.slice(start,end);
const clock={running:false,elapsedMs:20,startedAt:null};
const control=(n,idx,language='en',extra={})=>({type:'go',sequence:n,controlSequence:n,messageSequence:n,idx,language,clock,...extra});
// Minimal negative fixture: the three legacy handlers applied older commands.
// Keep this small instead of uploading another 4 MB historical HTML.
const a=bridge.indexOf(" if(['go','language','clock'].includes(m.type)){");
const b=bridge.indexOf(" if(m.type==='closing')",a);
assert(a>=0&&b>a,'Expected monotonic receiver block');
const old=bridge.slice(0,a)+`
 if(Number.isInteger(m.sequence))speakerAcceptedControlSequence=Math.max(speakerAcceptedControlSequence,m.sequence);
 if(m.type==='go'&&Number.isInteger(m.idx)&&m.idx>=0&&m.idx<slides.length){go(m.idx);return;}
 if(m.type==='language'&&['en','zh'].includes(m.language)){language(m.language);return;}
 if(m.type==='clock'&&m.clock){Object.assign(speakerClock,m.clock);sendSpeakerState();return;}
`+bridge.slice(b);
let h=harness(old);h.send(h.packet(control(2,5)));h.send(h.packet(control(1,1)));ck(h.state().current===1,'Minimal legacy handler fixture reproduces seq2→seq1 rollback');
h=harness(bridge);h.send(h.packet(control(2,5)));h.send(h.packet(control(1,1)));ck(h.state().current===5,'New receiver rejects older control sequence');
ck(h.sent.every(m=>m.idx===5),'No transient rollback state is broadcast');
h=harness(bridge);h.send(h.packet(control(2,4,'zh',{type:'language'})));h.send(h.packet(control(1,4)));ck(h.state().current===4&&h.state().lang==='zh','Newer language snapshot also retains navigation when go arrives late');
h=harness(bridge);h.send(h.packet({type:'ready',messageSequence:99,sequence:99}));h.send(h.packet(control(1,6,'zh')));ck(h.state().current===6&&h.state().lang==='zh','Ready heartbeat cannot swallow a lower message-numbered control');
ck(h.sent.at(-1).acceptedControlSequence===1,'Acknowledgement reports control sequence only');
const before=h.sent.length;h.send(h.packet(control(2,7,'en',{clock:{running:true,elapsedMs:50,startedAt:123}})));ck(h.sent.length===before+1,'Full snapshot emits one atomic final state');
ck(h.state().current===7&&h.state().lang==='en'&&h.state().clock.elapsedMs===50,'Snapshot applies navigation, language and timer together');
h.send(h.packet(control(2,0,'zh')));ck(h.state().current===7,'Equal control sequence with different message ID cannot replay');
h.send(h.packet(control(3,8,'zh',{clock:{running:true,elapsedMs:-1,startedAt:123}})));ck(h.state().current===7,'Malformed control does not consume sequence');
h.send(h.packet(control(3,8,'zh')));ck(h.state().current===8,'Corrected valid control sequence is still accepted');
const m=h.packet(control(4,9));h.send({...m,peerToken:'wrong'});ck(h.state().current===8,'Other peer cannot change audience');h.send(m);h.send(m);ck(h.state().current===9,'Same message delivered on both transports applies once');
const builder=html.slice(html.indexOf('function buildPresenterHTML('),start);
const buildContext={location:{pathname:'/deck.html'}};vm.createContext(buildContext);vm.runInContext(builder,buildContext);
const popup=buildContext.buildPresenterHTML('file:///deck.html',[{title:'Example',notes_en:'Example script',notes_zh:'示例讲稿'}],1,0,'channel','',{sessionId:'s',peerToken:'p',language:'en',clock:{running:false,elapsedMs:0,startedAt:null},viewportWidth:1440,viewportHeight:900,slideWidth:1420,slideHeight:784,pageProtocol:'file:',origin:'null',targetOrigin:'*'});
const generated=[...popup.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];new vm.Script(generated);
const emit=generated.slice(generated.indexOf('  function emit(data){'),generated.indexOf('  function receive(m){'));
const c={bc:{postMessage(m){c.sent.push(m)}},sent:[],window:{opener:null},options:{},sessionId:'s',peerToken:'p',messageSequence:0,controlSequence:0,idx:4,language:'zh',clock:{running:false,elapsedMs:12,startedAt:null}};vm.createContext(c);vm.runInContext(emit,c);c.emit({type:'ready'});c.emit({type:'go'});c.emit({type:'ready'});c.emit({type:'language'});
ck(c.sent.map(x=>x.messageSequence).join(',')==='1,2,3,4','Child assigns every transport message its own ID/sequence');
ck(c.sent.map(x=>x.controlSequence||'-').join(',')==='-,1,-,2','Heartbeats do not advance child control sequence');
ck(c.sent[3].idx===4&&c.sent[3].language==='zh'&&c.sent[3].clock.elapsedMs===12,'Every child control includes a full state snapshot');
c.clock.elapsedMs=99;ck(c.sent[3].clock.elapsedMs===12,'Control clock snapshot cannot mutate after emission');
const receive=generated.slice(generated.indexOf('  function validPacket(m){'),generated.indexOf('  function emit(data){'))+generated.slice(generated.indexOf('  function receive(m){'),generated.indexOf('  if(bc)bc.onmessage='));
Object.assign(c,{receivedIds:new Set(),lastRevision:-1,syncSeen:false,document:{getElementById(){return {}}},update(n){c.idx=n},options:{}});vm.runInContext(receive,c);
function master(r,ack,idx){return {bridge:'hainan-mit-presenter-v1',sessionId:'s',peerToken:'p',from:'audience',messageId:'a'+r,type:'state',revision:r,acceptedControlSequence:ack,idx,language:'en',clock:{...clock}}}
c.receive(master(2,1,1));ck(c.idx===4,'Child cannot roll back while latest local control is unacknowledged');
c.receive(master(3,2,9));ck(c.idx===9,'Child accepts acknowledged authoritative state');
c.receive(master(1,2,0));ck(c.idx===9,'Child rejects older audience revision');
const report={html_sha256:crypto.createHash('sha256').update(fs.readFileSync(INPUT)).digest('hex'),scope:'Node VM/stub regression; not a real browser test',checks_passed:checks.length,checks};if(OUTPUT)fs.writeFileSync(OUTPUT,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
