// Fixed 0.1-second steps keep the same formation reproducible at either playback speed.
const trialCrew=['brindle','mara','toll','rook'];
const basePositions={brindle:[2,1],mara:[1,0],toll:[0,0],rook:[0,2]};
const bossBook={'iron-ram':{name:'Iron Ram',hp:5150,atk:175,armor:30,mr:20,period:1.4,range:1},'glass-moth':{name:'Glass Moth',hp:4250,atk:160,armor:13,mr:32,period:1.35,range:2}};
const distance=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
function crewUnit(id,pos,star){
  const row=ROSTER.find(u=>u.id===id),s=row.stats,rank=star?1:0;
  const factor=1;
  const hp=Math.round(s[rank]*factor);
  return {id,name:row.name,x:pos[0],y:pos[1],hp,maxHP:hp,atk:s[2+rank],mag:s[4+rank],armor:s[6]*factor,mr:s[7]*factor,as:s[8],range:s[9],mana:s[10],cap:s[11],rank,shields:{},basics:0,mark:null,hopAt:-100,next:1/s[8],castAt:Infinity,echo:false,healAt:-Infinity};
}
function applyRoleStats(units){
 const count={};for(const u of units){const role=ROSTER.find(v=>v.id===u.id).role;count[role]=(count[role]||0)+1}
 for(const u of units){const role=ROSTER.find(v=>v.id===u.id).role;
  if(count.Bastion>=2){let factor=role==='Bastion'?1.15:1.05;u.maxHP=u.hp=Math.round(u.hp*factor);u.armor*=factor;u.mr*=factor;u.shields.opening={value:u.hp*(role==='Bastion'?.06:.02),until:Infinity}}
  if(count.Marksman>=2){u.as*=role==='Marksman'?1.4:1.1;u.next=1/u.as}
  if(count.Arcanist>=2)u.mag*=role==='Arcanist'?1.25:1.08;
 }
}
function newTrial(pos,star,bossID){
 const units=trialCrew.map(id=>crewUnit(id,pos[id],star&&id==='mara')),b=bossBook[bossID];applyRoleStats(units);
 return {units,boss:{...b,id:bossID,maxHP:b.hp,x:4,y:1,next:1.6,attacks:0},t:0,tick:0,roll:7133,hatch:0,shots:0,events:[],done:'',on:false};
}
function event(s,kind,actor,target,text=''){s.events.push({kind,actor,target,text,t:s.t})}
function addShield(s,u,key,value,until){u.shields[key]={value:Math.max(value,u.shields[key]?.value||0),until:s.t+until}}
function alliedHit(s,u,raw,magic=false){
 const b=s.boss;if(b.hp<=0)return;
 b.hp=Math.max(0,b.hp-raw*100/(100+(magic?b.mr:b.armor)));
}
function random(s){s.roll=(Math.imul(s.roll,1664525)+1013904223)>>>0;return s.roll/4294967296}
function validCast(u,b){return ['toll','brindle','mara','wisp','pip'].includes(u.id)||distance(u,b)<=u.range}
function dispatchCast(s,u,strength){
 const b=s.boss, crew=s.units,front=crew.find(v=>v.hp>0&&v.x===u.x+1&&v.y===u.y);
 switch(u.id){
  case 'brindle':addShield(s,u,'prop',(u.rank?2.05:1.4)*u.mag*strength,4*strength);event(s,'shield',u.id,u.id,'Brindle braces the prop wall.');break;
  case 'toll':for(const v of [u,front].filter(Boolean))addShield(s,v,'bell',(u.rank?1.50:1.05)*u.mag*strength,3*strength);event(s,'ring',u.id,front?.id||u.id,'Toll rings Bell Bronze.');break;
  case 'rook':alliedHit(s,u,(u.rank?1.95:1.45)*u.atk*strength);event(s,'shot',u.id,'@enemy','Rook fires Bank Shot.');break;
  case 'wisp':{let ally=crew.filter(v=>v.hp>0).sort((a,b)=>a.hp/a.maxHP-b.hp/b.maxHP)[0];ally.hp=Math.min(ally.maxHP,ally.hp+(u.rank?1.85:1.35)*u.mag*strength);event(s,'shield',u.id,ally.id,'Wicklight heals '+ally.name+'.');break}
  case 'wick':u.mark={end:s.t+2*strength,damage:0,power:strength};event(s,'shot',u.id,'@enemy','Wick marks the target.');break;
  case 'pip':{let spots=[];for(let x=0;x<5;x++)for(let y=0;y<3;y++){if(distance({x,y},b)===1&&!crew.some(v=>v.hp>0&&v.x===x&&v.y===y))spots.push({x,y})}spots.sort((a,d)=>distance(u,a)-distance(u,d));if(spots.length){Object.assign(u,spots[0]);u.hopAt=s.t}alliedHit(s,u,(u.rank?1.90:1.45)*u.atk*strength);event(s,'basic',u.id,'@enemy','Pip lands Hookstep.');break}
  case 'mara':{
   let count=u.rank?3:2;
   event(s,'hive',u.id,'@enemy','Mara opens the hive · '+count+' hatchlings.');
   for(let n=0;n<count;n++){
    if(b.hp<=0)break;
    s.hatch++;alliedHit(s,u,.9*u.mag*strength,true);event(s,'hatch',u.id,'@enemy');
    if(s.t-u.healAt>=1){let hurt=crew.filter(v=>v.hp>0).sort((a,b)=>a.hp/a.maxHP-b.hp/b.maxHP)[0];if(hurt){hurt.hp=Math.min(hurt.maxHP,hurt.hp+(u.rank?.55:.35)*u.mag);u.healAt=s.t}}
    let rook=crew.find(v=>v.id==='rook'&&v.hp>0);if(rook&&b.hp>0){s.shots++;alliedHit(s,rook,(rook.rank?.55:.35)*rook.atk);event(s,'cover',rook.id,'@enemy')}
   }
   break;
  }
 }
}
function receive(s,u,power,magic){
 let hasShield=Object.values(u.shields).some(v=>v.value>0);
 let def=magic?u.mr:u.armor+(u.id==='brindle'&&hasShield?(u.rank?20:12):0),dmg=power*100/(100+def);
 for(const shield of Object.values(u.shields)){let used=Math.min(dmg,shield.value);shield.value-=used;dmg-=used}
 u.hp=Math.max(0,u.hp-dmg);if(!u.hp)event(s,'out',u.id,u.id,u.name+' falls.');
}
function advanceTrial(s){
 if(s.done)return;
 s.events=[];s.t=++s.tick/10;let b=s.boss;
 for(const u of s.units.filter(u=>u.hp>0)){
  Object.keys(u.shields).forEach(k=>{if(u.shields[k].until<=s.t)delete u.shields[k]});
  if(u.mark&&u.mark.end<=s.t){alliedHit(s,u,(u.atk+(u.rank?.50:.30)*u.mark.damage)*u.mark.power);u.mark=null;}
  u.mana=Math.min(u.cap,u.mana+.4);
  if(u.castAt<=s.t){u.castAt=Infinity;dispatchCast(s,u,1);
    let toll=s.units.find(t=>t.id==='toll'&&t.hp>0&&!t.echo&&t.x+1===u.x&&t.y===u.y);
    if(toll&&b.hp>0){toll.echo=true;event(s,'echo',toll.id,u.id,'Second Ring repeats '+u.name+'’s cast.');dispatchCast(s,u,toll.rank?.50:.35)}
  }else if(u.castAt===Infinity&&u.mana>=u.cap&&validCast(u,b)){u.mana=0;u.castAt=s.t+.5;u.next=Math.max(u.next,u.castAt+.01)}
  else if(u.castAt===Infinity&&s.t>=u.next&&distance(u,b)<=u.range){u.next=s.t+1/u.as;u.mana=Math.min(u.cap,u.mana+8);const before=b.hp;alliedHit(s,u,u.atk*(random(s)<.1?1.5:1));if(u.mark)u.mark.damage+=before-b.hp;if(u.id==='wisp'&&!u.basics)alliedHit(s,u,(u.rank?.75:.45)*u.mag,true);if(u.id==='pip'&&s.t-u.hopAt<=3){alliedHit(s,u,(u.rank?.30:.18)*u.atk);u.hopAt=-100}u.basics++;event(s,'basic',u.id,'@enemy')}
  if(!b.hp)break;
 }
 if(b.hp<=0){s.done='Victory';event(s,'end','',b.id,b.name+' defeated.');return}
 if(s.t>=b.next){
  let alive=s.units.filter(u=>u.hp>0).sort((a,c)=>distance(a,b)-distance(c,b)||c.x-a.x||a.y-c.y),target=alive[0];
  if(target){
   if(distance(target,b)>b.range){let opts=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){let p={x:b.x+dx,y:b.y+dy};if(p.x>=0&&p.x<5&&p.y>=0&&p.y<3&&distance(p,target)<distance(b,target)&&!alive.some(v=>v.x===p.x&&v.y===p.y))opts.push(p)}
    opts.sort((a,c)=>Math.abs(a.y-target.y)-Math.abs(c.y-target.y));if(opts.length)Object.assign(b,opts[0]);b.next=s.t+.7;
   }else{b.next=s.t+b.period;b.attacks++;let heavy=b.attacks%4===0;receive(s,target,b.atk*(heavy?1.65:1),b.id==='glass-moth');event(s,'enemy','@enemy',target.id,heavy?b.name+' strikes '+target.name+' with a heavy hit.':'')}
  }
 }
 if(!s.units.some(u=>u.hp>0)||s.t>=90){s.done='Defeat';event(s,'end','','','The crew withdraws.')}
}
