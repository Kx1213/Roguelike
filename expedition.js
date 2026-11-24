// The first expedition uses two branching patrols, one shop after each patrol, and a boss.
const runKey='second-move-quay-v1',pool=['rook','brindle','pip','wisp','toll','wick'];
const paths=[
 [{id:'pip',name:'Rigging Alley',blurb:'A stunt fencer waits above the quay.',danger:1},{id:'wisp',name:'Lantern Landing',blurb:'A blue flame drifts between the moorings.',danger:1}],
 [{id:'wick',name:'The Clock Bridge',blurb:'A rifleman guards the old clockwork bridge.',danger:2},{id:'toll',name:'Bell Crossing',blurb:'A bronze bell sounds down the slipway.',danger:2}]
];
function persist(){try{localStorage.setItem(runKey,JSON.stringify(run))}catch{}}
function validSave(r){return r&&r.version===1&&['route','battle','shop','boss','win','loss'].includes(r.phase)&&Array.isArray(r.owned)&&r.owned.every(id=>pool.includes(id))&&Number.isInteger(r.depth)&&r.depth>=0&&r.depth<=2&&r.ranks&&r.copies&&Array.isArray(r.offers)}
function blankRun(){return {version:1,phase:'route',depth:0,gold:3,owned:['brindle','rook'],copies:{brindle:1,rook:1},ranks:{brindle:1,rook:1},enemy:null,offers:[],routeNames:[],formation:{},boss:'iron-ram'};}
try{let r=JSON.parse(localStorage.getItem(runKey));if(validSave(r))run=r}catch{}
function startRun(){run=blankRun();persist();drawMap()}
function buyCopy(id){
 if(!run.owned.includes(id)){run.owned.push(id);run.copies[id]=0;run.ranks[id]=1}
 if(run.ranks[id]===2)return;
 run.copies[id]=(run.copies[id]||0)+1;if(run.copies[id]===3){run.ranks[id]=2;run.copies[id]=0}
}
function shopRoll(){return Array.from({length:4},()=>pool[Math.floor(Math.random()*pool.length)])}
function shopButtons(box){
 run.offers.forEach((id,i)=>{if(!id){const sold=document.createElement('div');sold.className='sold';sold.textContent='Recruited';box.append(sold);return}
 let u=characters[id],btn=document.createElement('button');btn.className='card';btn.disabled=u.cost>run.gold||run.ranks[id]===2;
 btn.innerHTML='<img src="'+spritePath(id)+'" alt=""><strong>'+u.name+'</strong><small>'+u.cost+' gold · '+u.role+'</small>';btn.onclick=()=>{if(!run.offers[i]||run.gold<u.cost)return;run.gold-=u.cost;buyCopy(id);run.offers[i]=null;persist();drawMap()};box.append(btn)});
}
function domButton(box,text,fn,kind=''){const b=document.createElement('button');b.textContent=text;b.className=kind;b.onclick=fn;box.append(b);return b}
function drawMap(){
 showView('expedition');el('expedition').classList.toggle('shopping',run?.phase==='shop');let box=el('run-content');box.replaceChildren();let r=run;
 el('run-status').textContent=r?'Act I · '+r.gold+' gold':'Act I · Greyharbor';
 if(!r){box.innerHTML='<h2>Cross the harbor</h2><p>Choose a patrol, win its featured recruit, and spend your gold before the boss. Three matching copies upgrade a crew member. Your run saves after each encounter and purchase.</p>';domButton(box,'Begin expedition',startRun,'primary');return}
 const roster=document.createElement('p');roster.className='inventory';roster.textContent=r.owned.map(id=>characters[id].name+' '+(r.ranks[id]===2?'★★':'★')+(r.copies[id]===2?' (2/3)':'')).join('  ·  ');
 if(r.phase==='route'){
  box.innerHTML='<h2>Choose your route</h2><p>Patrol '+(r.depth+1)+' of 2. Scout the recruit before you choose.</p>';box.append(roster);
  let row=document.createElement('div');row.className='routes';box.append(row);
  for(const path of paths[r.depth]){let b=document.createElement('button');b.className='route';b.innerHTML='<img src="'+spritePath(path.id)+'" alt=""><span><strong>'+path.name+'</strong><small>'+path.blurb+'</small><b>Recruit '+characters[path.id].name+'</b></span>';b.onclick=()=>{r.enemy=path.id;r.phase='battle';r.routeNames.push(path.name);if(r.depth===1)r.boss=path.id==='wick'?'glass-moth':'iron-ram';persist();beginRunBattle(r.enemy)};row.append(b)}
 }else if(r.phase==='shop'){
  box.innerHTML='<h2>Harbor exchange</h2><p>Choose recruits for the next encounter. Matching copies count toward a two-star upgrade.</p>';box.append(roster);
  let cards=document.createElement('div');cards.className='shopcards';shopButtons(cards);box.append(cards);
  let actions=document.createElement('div');actions.className='shopacts';box.append(actions);
  domButton(actions,'Reroll · 2 gold',()=>{if(r.gold<2)return;r.gold-=2;r.offers=shopRoll();persist();drawMap()}).disabled=r.gold<2;
  domButton(actions,r.depth===2?'Approach the boss':'Continue to the fork',()=>{r.phase=r.depth===2?'boss':'route';persist();drawMap()},'primary');
 }else if(r.phase==='boss'||r.phase==='battle'){
  box.innerHTML='<h2>'+(r.phase==='boss'?'The boss crossing':'Patrol ahead')+'</h2><p>'+r.routeNames.join(' → ')+'</p>';box.append(roster);
  const enemy=r.phase==='boss'?r.boss:r.enemy;domButton(box,'Enter battle · '+(bossBook[enemy]?.name||characters[enemy].name),()=>beginRunBattle(enemy),'primary');
 }else{
  box.innerHTML='<h2>'+(r.phase==='win'?'Greyharbor cleared':'Expedition ended')+'</h2><p>'+r.routeNames.join(' → ')+'</p>';box.append(roster);domButton(box,'Start a new expedition',startRun,'primary');
 }
}
function beginRunBattle(enemy){
 mode='run';el('reset').disabled=false;el('runback').textContent='Expedition map';showView('trial');selected='';positions={};let used=new Set(),available=[[2,1],[0,1],[1,0],[1,2],[0,0],[0,2]];
 for(let id of run.owned){let p=run.formation[id];if(!p||used.has(p.join(',')))p=available.find(a=>!used.has(a.join(',')));positions[id]=[...p];used.add(p.join(','))}
 let base=newTrial(basePositions,false,'iron-ram');base.units=run.owned.map(id=>crewUnit(id,positions[id],run.ranks[id]===2));applyRoleStats(base.units);
 if(bossBook[enemy]){base.boss={...bossBook[enemy],id:enemy,maxHP:bossBook[enemy].hp,x:4,y:1,next:1.4,attacks:0};base.boss.hp=base.boss.maxHP=Math.round(base.boss.maxHP*.68)}
 else {let u=characters[enemy],hp=Math.round((u.stats[0]+230)*(run.depth===0?1:1.35));base.boss={id:enemy,name:u.name,hp,maxHP:hp,atk:run.depth===0?55:90,armor:u.stats[6],mr:u.stats[7],period:1.5,range:Math.min(u.stats[9],2),x:4,y:1,next:1.5,attacks:0}}
 current=base;el('encounter-name').textContent=base.boss.name;el('runback').hidden=false;el('crew-title').textContent='Expedition crew';refillUI();el('boss').parentElement.hidden=true;el('star').parentElement.hidden=true;el('hint').textContent='Select an ally and then a tile to arrange your crew. Matching roles activate their two-member bonuses at battle start.';
}
function finishBattle(){
 if(mode!=='run')return;run.formation=Object.fromEntries(Object.keys(positions).map(id=>[id,[...positions[id]]]));
 if(current.done==='Victory'&&run.phase==='battle'){buyCopy(run.enemy);run.gold+=4;run.depth++;run.offers=shopRoll();run.phase='shop';el('result').textContent='Victory · recruited '+characters[run.enemy].name}
 else if(current.done==='Victory')run.phase='win';else run.phase='loss';
 persist();el('runback').hidden=false;el('runback').textContent=run.phase==='shop'?'Visit the shop':'View expedition';el('reset').disabled=true;
}
function restoreTrial(){mode='trial';el('boss').parentElement.hidden=false;el('star').parentElement.hidden=false;el('encounter-name').textContent='Greyharbor Quay';el('crew-title').textContent='The casting crew';el('runback').hidden=true;el('reset').disabled=false;el('hint').textContent='Select an ally, then a highlighted tile to move or swap. Toll echoes the first cast from the ally directly to his right.';el('boss').value='iron-ram';positions=clonePos(basePositions);resetTrial()}
el('trialtab').onclick=()=>{if(mode==='run')restoreTrial();showView('trial')};
el('maptab').onclick=drawMap;el('runback').onclick=drawMap;
