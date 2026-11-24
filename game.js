const el=id=>document.getElementById(id);
const clonePos=obj=>Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,[...v]]));
let positions=clonePos(basePositions),selected='',speed=1,acc=0,scene,run=null,mode='trial',current=newTrial(positions,false,'iron-ram'),logLines=[],ready=false;
let imageObjects={},barLayer,tiles=[],fxLayer;
const labelTime=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');
const coords=u=>({x:900*(.03+.94*(u.x+.5)/5),y:510*(.08+.87*(u.y+1)/3)-8});
const lookup=id=>ROSTER.find(u=>u.id===id);
const characters=Object.fromEntries(ROSTER.map(u=>[u.id,u]));
const spritePath=id=>'assets/'+(bossBook[id]?'bosses':id==='wicker-hatchling'?'summons':'characters')+'/'+id+'.png';
function curUnits(){return [...current.units,current.boss]}
function createScene(){
 scene=this;this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
 const ids=[...new Set([...trialCrew,'wisp','pip','wick',...Object.keys(bossBook),'wicker-hatchling'])];
 Promise.all(ids.map(id=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{scene.textures.addImage(id,img);resolve()};img.onerror=()=>reject(Error('Missing '+id));img.src=spritePath(id)}))).then(()=>{
  barLayer=scene.add.graphics().setDepth(20);fxLayer=scene.add.layer().setDepth(35);ready=true;renderStage();el('fight').disabled=false;
 }).catch(e=>{el('result').textContent=e.message;});
}
function updateScene(_,ms){
 if(!ready||!current.on||current.done||el('trial').hidden)return;
 acc+=Math.min(ms,150)*speed;
 while(acc>=100&&!current.done){acc-=100;advanceTrial(current);showEvents(current.events);if(current.done){current.on=false;el('phase').textContent=current.done;el('result').textContent=current.done;finishBattle();}}
 renderStage();el('time').textContent=labelTime(current.t);el('brood').textContent=current.hatch;el('cover').textContent=current.shots;
}
function renderStage(){
 if(!ready)return;barLayer.clear();const active=new Set();
 curUnits().forEach((u,i)=>{
  let key=u===current.boss?'enemy':u.id;active.add(key);
  let pic=imageObjects[key];if(!pic){pic=scene.add.image(0,0,u.id);imageObjects[key]=pic}
  if(pic.texture.key!==u.id)pic.setTexture(u.id);
  const p=coords(u),foe=u===current.boss,sc=foe?173:148;
  pic.setOrigin(.5,.94).setDisplaySize(sc,sc).setPosition(p.x,p.y).setFlipX(foe).setDepth(2+u.y).setAlpha(u.hp>0?1:.25);
  if(u.hp<=0)return;
  const x=p.x-34,y=p.y+2,pct=Math.min(1,Math.max(0,u.hp/u.maxHP));
  barLayer.fillStyle(0x102830,.92).fillRect(x-1,y-1,70,foe?7:10);
  barLayer.fillStyle(foe?0xef9775:0x85d7ac,1).fillRect(x,y,68*pct,4);
  if(!foe)barLayer.fillStyle(0x83bffa,1).fillRect(x,y+5,68*Math.min(1,u.mana/u.cap),2);
 });
 for(const [key,value] of Object.entries(imageObjects))if(!active.has(key)){value.destroy();delete imageObjects[key]}
}
function appendLog(message,t){
 logLines.unshift({message,t});logLines=logLines.slice(0,55);
 const li=document.createElement('li'),time=document.createElement('time');time.textContent=labelTime(t);li.append(time,document.createTextNode(message));el('feed').prepend(li);while(el('feed').children.length>55)el('feed').lastChild.remove();
}
function showEvents(events){
 let n=0;for(const ev of events){
  if(ev.text)appendLog(ev.text,ev.t);
  const s=ev.actor==='@enemy'?current.boss:current.units.find(u=>u.id===ev.actor),d=ev.target==='@enemy'?current.boss:current.units.find(u=>u.id===ev.target);
  if(!s||!d||!fxLayer)continue;
  const a=coords(s),b=coords(d);a.y-=52;b.y-=52;
  const dur=290/speed,delay=(ev.kind==='cover'||ev.kind==='hatch')?n++*60/speed:0;
  if(ev.kind==='ring'||ev.kind==='echo'||ev.kind==='shield'||ev.kind==='hive'){
   let ring=scene.add.circle(a.x,a.y,13,0xffffff,0).setStrokeStyle(4,ev.kind==='echo'?0xf7d37e:0x9cd7cd);fxLayer.add(ring);scene.tweens.add({targets:ring,scale:3,alpha:0,duration:dur*2,onComplete:()=>ring.destroy()});
  }else if(ev.kind==='hatch'){
   let bug=scene.add.image(a.x,a.y,'wicker-hatchling').setDisplaySize(45,45);fxLayer.add(bug);bug.setVisible(false);
   scene.tweens.add({targets:bug,x:b.x,y:b.y,alpha:.3,delay,duration:dur*1.5,onStart:()=>bug.setVisible(true),onComplete:()=>bug.destroy()});
  }else if(['basic','cover','shot','enemy'].includes(ev.kind)){
   const dot=scene.add.circle(a.x,a.y,ev.kind==='cover'?5:3,ev.kind==='enemy'?0xde8066:ev.kind==='cover'?0xffce70:0xdcd6b3);fxLayer.add(dot);dot.setVisible(false);
   scene.tweens.add({targets:dot,x:b.x,y:b.y,delay,duration:dur,onStart:()=>dot.setVisible(true),onComplete:()=>dot.destroy()});
  }
 }
}
function cleanFx(){if(ready){scene.tweens.killAll();fxLayer.removeAll(true)}}
function refillUI(){
 selected='';acc=0;cleanFx();el('time').textContent='00:00';el('phase').textContent='Formation';el('result').textContent='';el('brood').textContent='0';el('cover').textContent='0';el('feed').innerHTML='<li>Position your crew and start the fight.</li>';logLines=[];
 el('fight').disabled=!ready;el('boss').disabled=mode==='run';el('star').disabled=mode==='run';
 drawControls();renderStage();
}
function resetTrial(){current=newTrial(positions,el('star').checked,el('boss').value);refillUI()}
function choose(x,y){
 if(current.on||current.done||x>=3)return;
 let u=current.units.find(v=>v.x===x&&v.y===y),s=current.units.find(v=>v.id===selected);
 if(!s||s===u){selected=s===u?'':u?.id||''}else{
  if(u){u.x=s.x;u.y=s.y;positions[u.id]=[u.x,u.y]}
  s.x=x;s.y=y;positions[s.id]=[x,y];selected='';
 }
 drawControls();renderStage();
}
function drawControls(){
 const locked=current.on||Boolean(current.done);
 el('party').replaceChildren();for(const u of current.units){
  const spec=lookup(u.id),btn=document.createElement('button');btn.className='member'+(selected===u.id?' chosen':'');
  btn.innerHTML='<img alt="" src="'+spritePath(u.id)+'"><strong>'+u.name+(u.rank?' ★★':'')+'</strong><small>'+spec.role+'</small>';btn.disabled=locked;btn.onclick=()=>choose(u.x,u.y);el('party').append(btn);
 }
 const roleCounts={};for(const u of current.units){let role=characters[u.id].role;roleCounts[role]=(roleCounts[role]||0)+1}
 el('bonuses').replaceChildren();for(const [r,n] of Object.entries(roleCounts)){if(n<2)continue;let tag=document.createElement('span');tag.textContent=r+' ×'+n;tag.title=r==='Marksman'?'Attack speed +10% for allies, +40% for Marksmen':r==='Bastion'?'HP, armor and resistance +5% for allies, +15% for Bastions. Grants an opening shield.':'A shared role bonus is active.';el('bonuses').append(tag)}
 for(let i=0;i<tiles.length;i++){
  const x=i%5,y=Math.floor(i/5),u=current.units.find(v=>v.x===x&&v.y===y);
  let tile=tiles[i];tile.className='tile'+(u&&u.id===selected?' selected':selected&&x<3?' available':'');
  tile.setAttribute('aria-label','Column '+(x+1)+', row '+(y+1)+(u?', '+u.name:''));tile.disabled=locked||x>=3;
 }
}
for(let i=0;i<15;i++){let b=document.createElement('button');b.className='tile';b.onclick=()=>choose(i%5,Math.floor(i/5));el('grid').append(b);tiles.push(b)}
function fight(){if(!ready||current.on||current.done)return;current.on=true;el('phase').textContent='Battle';el('fight').disabled=true;el('star').disabled=true;el('boss').disabled=true;el('feed').replaceChildren();appendLog(current.boss.name+' approaches.',0);drawControls()}
el('fight').onclick=fight;el('speed').onclick=()=>{speed=speed===1?2:1;el('speed').textContent='Speed ×'+speed};
el('reset').onclick=()=>mode==='run'?beginRunBattle(run.phase==='boss'?run.boss:run.enemy):resetTrial();el('boss').onchange=resetTrial;el('star').onchange=resetTrial;
function showView(name){
 el('trial').hidden=name!=='trial';el('guide').hidden=name!=='guide';if(el('expedition'))el('expedition').hidden=name!=='expedition';
 for(const id of ['trial','codex','map']){let b=el(id+'tab');if(b)b.setAttribute('aria-selected',String((name==='trial'&&id==='trial')||(name==='guide'&&id==='codex')||(name==='expedition'&&id==='map')))}
}
el('trialtab').onclick=()=>{if(mode==='run'&&(!current.on||current.done)){mode='trial';positions=clonePos(basePositions);el('boss').value='iron-ram';resetTrial()}showView('trial')};
el('codextab').onclick=()=>showView('guide');
const catalog=el('catalog'),filter=el('filter');
for(const f of new Set(ROSTER.map(x=>x.faction)))filter.add(new Option(f,f));
function reveal(u){
 const s=u.stats;el('detail').innerHTML='<img alt="" src="'+spritePath(u.id)+'"><p class="kicker">'+u.faction+' · '+u.role+'</p><h2>'+u.name+'</h2><p>'+u.cost+' gold · '+s[0]+' HP · '+s[2]+' ATK · '+s[4]+' MAG</p><p>'+u.concept+'</p><h3>'+u.active+'</h3><p>'+u.skill+'</p><h3>'+u.passive+'</h3><p>'+u.effect+'</p>';el('info').showModal();
}
function guide(){catalog.replaceChildren();for(const u of ROSTER.filter(u=>filter.selectedIndex===0||u.faction===filter.value).sort((a,b)=>a.faction.localeCompare(b.faction)||a.cost-b.cost)){let card=document.createElement('button');card.className='card';card.innerHTML='<img alt="" src="'+spritePath(u.id)+'"><strong>'+u.name+'</strong><small>'+u.role+' · '+u.cost+' gold</small>';card.onclick=()=>reveal(u);catalog.append(card)}}
filter.onchange=guide;guide();resetTrial();
const engine=new Phaser.Game({type:Phaser.CANVAS,width:900,height:510,parent:'vfx',transparent:true,banner:false,audio:{noAudio:true},scene:{create:createScene,update:updateScene}});
