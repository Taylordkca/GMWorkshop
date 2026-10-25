'use strict';
const KEY='jackalforgeGMWorkshopV1';
const names=['STR','INT','CON','DEX','CHA'];
const DAMAGE_TYPES=['Acid','Bludgeoning','Electric','Fire','Force','Holy','Ice','Necrotic','Piercing','Poison','Psychic','Slashing','Sonic'];
const costs=[0,1,3,6,10,20,50,100,150,200,300];
const boss={neighborhood:[30,10],borough:[50,15],city:[100,20],province:[250,25],country:[750,30],floorboss:[1500,40]};
const $=id=>document.getElementById(id);
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(n))?Number(n):min));
const floorBudget=f=>f===1?15:30*(f-1);
const diceCount=f=>f<=1?1:f===2?2:f<=4?3:f<=7?5:f<=10?7:f<=13?9:f<=16?12:15;
const modOf=v=>v<1?-1: v<=2?1:v<=5?2:v<=9?3:v<=19?4:v<=49?5:v<=99?6:v<=149?7:v<=199?8:v<=299?9:10;
const tierBudget=(tier,f)=>boss[tier]?Math.max(floorBudget(f),boss[tier][0]):Math.floor(floorBudget(f)*({weak:.7,standard:.8,elite:1}[tier]||.8));
const defaultHB=(tier,f)=>tier==='weak'?4:tier==='standard'?6:tier==='elite'?10+f:boss[tier][1]+f;
const defaultDR=(tier,f)=>tier==='weak'?Math.max(0,f-2):f;
const defaultDie=tier=>tier==='weak'?'d4':tier==='standard'?'d6':'d8';
// GM Workshop level recommendations; Level remains freely editable.
const suggestedLevels={1:[2,3,4],2:[6,7,9],3:[12,15,18],4:[22,25,28],5:[32,35,38],6:[42,45,48],7:[52,55,58],8:[62,65,68],9:[72,75,78],10:[92,95,98],11:[112,115,118],12:[132,135,138],13:[152,155,158],14:[172,175,178],15:[192,195,198],16:[212,215,218],17:[250,260,270],18:[270,280,300]};
function recommendedLevel(tier,f){const row=suggestedLevels[f]||suggestedLevels[1];if(tier==='weak')return row[0];if(tier==='standard')return row[1];if(tier==='neighborhood')return Math.max(10,row[2]);if(tier==='borough')return Math.max(15,row[2]);const mins={city:30,province:80,country:250,floorboss:300};return Math.max(mins[tier]||0,row[2])}

const make=()=>({name:'',floor:1,level:3,tier:'standard',mode:'mods',preset:'balanced',mods:[1,1,1,1,1],points:[1,1,1,1,1],locks:[false,false,false,false,false],maxHB:6,currentHB:6,dr:0,die:'d6',conThreshold:null,resistances:[],vulnerabilities:[],attacks:[],abilities:[],sheetLayout:{order:[],collapsed:[]},notes:'',gmNotes:[]});
let mob=make(),undo=[];
let hitComponents=[{type:'',damage:'',modifier:'auto'}];
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved==='object')mob={...make(),...saved}}catch(e){console.warn('Save not loaded',e)}
function budget(){return mob.mode==='points'?mob.level*3:tierBudget(mob.tier,mob.floor)}
function spent(){return mob.mode==='points'?mob.points.reduce((s,p)=>s+p-1,0):mob.mods.reduce((s,m)=>s+costs[m],0)}
// Allocate ONLY the unlocked stats. Locked values are never reset or reduced.
// Archetype order follows STR, INT, CON, DEX, CHA. Priority and secondary are distinct.
const archetypes={
 berserker:[0,2],eldritch:[0,1],caster:[1,4],mastermind:[1,3],
 tank:[2,0],mutant:[2,1],stalker:[3,1],trickster:[3,4],
 commander:[4,0],enchanter:[4,1]
};
const isArchetype=p=>Object.hasOwn(archetypes,p);
function fillArray(preset=mob.preset){
 const cap=tierBudget(mob.tier,mob.floor), next=mob.mods.slice();
 const open=names.map((_,i)=>i).filter(i=>!mob.locks[i]);
 const lockedCost=names.reduce((sum,_,i)=>sum+(mob.locks[i]?costs[next[i]]:0),0);
 if(lockedCost+open.length>cap){alert('Locked stats leave too few points for the other stats. Unlock or lower a stat first.');return false}
 if(!open.length)return true;
 open.forEach(i=>next[i]=1);
 let available=cap-(lockedCost+open.length);
 const priority=archetypes[preset];
 // A locked +6 cannot coexist with an unlocked +1 in an archetype; honor locks, warn if impossible.
 const feasible=(i,newMod)=>{
   if(!priority)return true;
   const values=next.slice();values[i]=newMod;
   const highest=Math.max(...values),lowest=Math.min(...values);
   if(highest-lowest<=3)return true;
   // Allow a temporary gap only if it can be closed with remaining budget.
   const minimumAllowed=highest-3;
   const required=values.reduce((sum,v,j)=>sum+(v<minimumAllowed?costs[minimumAllowed]-costs[v]:0),0);
   return minimumAllowed<=10 && required<=available-(costs[newMod]-costs[next[i]]);
 };
 if(priority){
   const maxLocked=Math.max(1,...next.filter((_,i)=>mob.locks[i]));
   const minAllowed=Math.max(1,maxLocked-3);
   for(const i of open){
     const delta=costs[minAllowed]-costs[next[i]];
     if(delta>available){alert('Locked stats cannot fit this archetype’s 3-modifier spread within the budget.');return false}
     next[i]=minAllowed;available-=delta;
   }
   if(Math.max(...next)-Math.min(...next)>3){alert('Locked stats are more than 3 modifiers apart. Unlock a stat to use this profile.');return false}
 }
 let primary=-1;
 if(preset==='minmax'){
   primary=open[Math.floor(Math.random()*open.length)];
   while(next[primary]<10 && costs[next[primary]+1]-costs[next[primary]]<=available){
     const d=costs[next[primary]+1]-costs[next[primary]];next[primary]++;available-=d;
   }
 }
 let iterations=0;
 while(available>0 && iterations++<250){
   const options=open.filter(i=>next[i]<10 && costs[next[i]+1]-costs[next[i]]<=available && feasible(i,next[i]+1));
   if(!options.length)break;
   let selected;
   if(preset==='minmax'){
     const other=options.filter(i=>i!==primary);const pool=other.length?other:options;
     const low=Math.min(...pool.map(i=>next[i]));const finalists=pool.filter(i=>next[i]===low);
     selected=finalists[Math.floor(Math.random()*finalists.length)];
   }else if(priority){
     // Prefer first and second signature stats, without violating the 3-mod spread.
     const score=i=>(i===priority[0]?7:i===priority[1]?4:1)-next[i]*0.32+Math.random()*0.4;
     selected=options.map(i=>({i,score:score(i)})).sort((a,b)=>b.score-a.score)[0].i;
   }else{
     const low=Math.min(...options.map(i=>next[i]));const pool=options.filter(i=>next[i]===low);
     selected=pool[Math.floor(Math.random()*pool.length)];
   }
   const delta=costs[next[selected]+1]-costs[next[selected]];
   next[selected]++;available-=delta;
 }
 if(priority && Math.max(...next)-Math.min(...next)>3){alert('Cannot satisfy the archetype spread with the current locks and budget.');return false}
 mob.mods=next;return true;
}
function rebalance(){const cap=budget();let over=spent()-cap;while(over>0){const options=mob.mods.map((m,i)=>({m,i})).filter(x=>x.m>1&&!mob.locks[x.i]);if(!options.length)break;options.sort((a,b)=>b.m-a.m);mob.mods[options[0].i]--;over=spent()-cap}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(mob));$('saveStatus').textContent='Saved locally'}catch(e){$('saveStatus').textContent='Save unavailable'}}
function setTierDefaults(){mob.maxHB=defaultHB(mob.tier,mob.floor);mob.currentHB=mob.maxHB;mob.dr=defaultDR(mob.tier,mob.floor);mob.die=defaultDie(mob.tier);mob.conThreshold=null}
function renderStats(){const grid=$('statGrid');grid.replaceChildren();names.forEach((name,i)=>{const card=document.createElement('div');card.className='stat-card';const h=document.createElement('h3');h.textContent=mob.mode==='points'?({STR:'Strength',INT:'Intelligence',CON:'Constitution',DEX:'Dexterity',CHA:'Charisma'})[name]:name;card.append(h);const label=document.createElement('label');label.textContent=mob.mode==='points'?'Points':'Modifier';const inp=document.createElement('input');inp.type='number';inp.min=mob.mode==='points'?-1:1;inp.max=mob.mode==='points'?999:10;inp.value=mob.mode==='points'?mob.points[i]:mob.mods[i];inp.addEventListener('change',()=>{const old=mob.mode==='points'?mob.points[i]:mob.mods[i];const next=clamp(Math.trunc(Number(inp.value)),mob.mode==='points'?-1:1,mob.mode==='points'?999:10);if(mob.mode==='array'){// Array mode preserves the budget and allows redistribution using the same pool.
 mob.mods[i]=next;if(spent()>budget())mob.mods[i]=old;
}else if(mob.mode==='mods'){mob.mods[i]=next;if(spent()>budget())mob.mods[i]=old;
}else{mob.points[i]=next;if(spent()>budget())mob.points[i]=old}
 if(mob.mode!=='points')mob.preset='custom';render();});label.append(inp);card.append(label);const foot=document.createElement('div');foot.className='stat-foot';const mod=document.createElement('strong');const m=mob.mode==='points'?modOf(mob.points[i]):mob.mods[i];mod.textContent='MOD '+(m>=0?'+':'')+m;foot.append(mod);const pointCost=document.createElement('span');pointCost.className='point-cost';pointCost.textContent=mob.mode==='points'?`${mob.points[i]} raw pts`:`${costs[mob.mods[i]]} pts`;if(mob.mode!=='points')card.append(pointCost);else{pointCost.textContent='\u00a0';pointCost.setAttribute('aria-hidden','true');card.append(pointCost)}const lock=document.createElement('label');lock.textContent='Lock';const chk=document.createElement('input');chk.type='checkbox';chk.checked=mob.locks[i];chk.addEventListener('change',()=>{mob.locks[i]=chk.checked;save()});lock.append(chk);foot.append(lock);card.append(foot);grid.append(card)});
$('total').textContent=budget();$('spent').textContent=spent();$('remaining').textContent=budget()-spent();$('modeHelp').textContent=mob.mode==='points'?'Detailed points mode: starts at 1 in every stat, plus Level × 3 spendable points. A stat may drop to −1 and refund 2 points. Switching modes requires confirmation.':mob.mode==='mods'?'Edit modifiers directly; each costs its minimum RAW stat value. All stats must be at least +1.':'Allocate modifiers using RAW minimum point costs. Locked stats stay fixed during rerolls.'}
function getMods(){return mob.mode==='points'?mob.points.map(modOf):mob.mods}
function renderHealth(){
 mob.maxHB=Math.max(1,Math.trunc(mob.maxHB));
 mob.currentHB=clamp(Math.trunc(mob.currentHB),0,mob.maxHB);
 $('maxHB').value=mob.maxHB;$('conThreshold').value=effectiveThreshold();$('dr').value=mob.dr;
 const percent=mob.currentHB/mob.maxHB*100;
 $('healthLabel').textContent=`${mob.currentHB} / ${mob.maxHB} HIT BOXES · ${Math.round(percent)}%`;
 $('healthPercent').textContent='';
 $('hpEquivalent').textContent=`${mob.currentHB*effectiveThreshold()} / ${mob.maxHB*effectiveThreshold()} HP equivalent`;
 const bar=$('healthBlocks');bar.replaceChildren();
 const fill=document.createElement('div');fill.className='health-fill';
 fill.style.width=percent+'%';
 fill.style.background=percent<=0?'#ddd':percent<=20?'#d62828':percent<=50?'#e98a34':percent<80?'#f0d451':'#63a568';
 bar.append(fill);
 for(let mark=10;mark<mob.maxHB;mark+=10){
   const tick=document.createElement('span');tick.className='health-tick';tick.style.left=(mark/mob.maxHB*100)+'%';bar.append(tick);
 }
 bar.setAttribute('aria-valuemax',String(mob.maxHB));
 bar.setAttribute('aria-valuenow',String(mob.currentHB));
}
function effectiveThreshold(){return Math.max(1,mob.conThreshold===null||mob.conThreshold===undefined?getMods()[2]:mob.conThreshold)}
function renderDamageTypes(){
 for(const key of ['resistances','vulnerabilities']){
  const root=$(key);root.replaceChildren();
  const chosen=Array.isArray(mob[key])?mob[key]:[];
  const details=document.createElement('details');details.className='damage-multiselect';
  const summary=document.createElement('summary');
  summary.textContent=chosen.length?chosen.join(', '):'Choose damage types…';
  details.append(summary);
  const menu=document.createElement('div');menu.className='damage-menu';
  const options=[...new Set([...DAMAGE_TYPES,...chosen])];
  for(const type of options){
    const label=document.createElement('label');label.className='damage-option';
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=chosen.includes(type);
    cb.addEventListener('change',()=>{
      if(cb.checked){if(!mob[key].includes(type))mob[key].push(type)}
      else mob[key]=mob[key].filter(t=>t!==type);
      summary.textContent=mob[key].length?mob[key].join(', '):'Choose damage types…';calc();save();
    });
    label.append(cb,document.createTextNode(type));menu.append(label);
  }
  const customRow=document.createElement('div');customRow.className='custom-type-row';
  const custom=document.createElement('input');custom.placeholder='Custom damage type';custom.setAttribute('aria-label','Custom damage type');
  const add=document.createElement('button');add.type='button';add.textContent='ADD';
  const addCustom=()=>{
    const type=custom.value.trim().slice(0,60);
    if(!type)return;
    if(!mob[key].some(t=>t.toLowerCase()===type.toLowerCase()))mob[key].push(type);
    renderDamageTypes();calc();save();
    const reopened=$(key).querySelector('details');if(reopened)reopened.open=true;
  };
  add.addEventListener('click',addCustom);custom.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addCustom()}});
  customRow.append(custom,add);menu.append(customRow);
  const clear=document.createElement('button');clear.type='button';clear.className='clear-types';clear.textContent='CLEAR ALL';
  clear.addEventListener('click',()=>{mob[key]=[];renderDamageTypes();calc();save()});
  menu.append(clear);details.append(menu);root.append(details);
 }
}
document.addEventListener('pointerdown',e=>{
 for(const d of document.querySelectorAll('.damage-multiselect[open]'))if(!d.contains(e.target))d.open=false;
});
function typeReaction(type){
 const has=arr=>Array.isArray(arr)&&arr.some(x=>x.toLocaleLowerCase()===type.toLocaleLowerCase());
 return type&&has(mob.resistances)?'resistance':type&&has(mob.vulnerabilities)?'vulnerability':'normal';
}
function renderHitDamageType(){
 const root=$('hitDamageType');root.replaceChildren();
 const details=document.createElement('details');details.className='damage-multiselect';
 const summary=document.createElement('summary');
 const selected=hitComponents.map(x=>x.type).filter(Boolean);
 summary.textContent=selected.length?selected.join(', '):'Choose damage types…';details.append(summary);
 const menu=document.createElement('div');menu.className='damage-menu';
 const options=[...new Set([...DAMAGE_TYPES,...mob.resistances,...mob.vulnerabilities,...selected].filter(Boolean))];
 const makeOption=type=>{
  const label=document.createElement('label');label.className='damage-option';
  const cb=document.createElement('input');cb.type='checkbox';cb.checked=selected.includes(type);
  cb.addEventListener('change',()=>{
   if(cb.checked){
    const blank=hitComponents.length===1&&!hitComponents[0].type;
    if(blank)hitComponents[0].type=type;
    else if(!hitComponents.some(x=>x.type===type))hitComponents.push({type,damage:'',modifier:'auto'});
   }else{
    hitComponents=hitComponents.filter(x=>x.type!==type);
    if(!hitComponents.length)hitComponents=[{type:'',damage:'',modifier:'auto'}];
   }
   summary.textContent=hitComponents.map(x=>x.type).filter(Boolean).join(', ')||'Choose damage types…';
   renderDamageComponents();calc();
  });
  label.append(cb,document.createTextNode(type));menu.append(label);
 };
 options.forEach(makeOption);
 const row=document.createElement('div');row.className='custom-type-row';
 const input=document.createElement('input');input.placeholder='Custom damage type';input.setAttribute('aria-label','Custom damage type');
 const add=document.createElement('button');add.type='button';add.textContent='ADD';
 const submit=()=>{
  const type=input.value.trim().slice(0,60);if(!type)return;
  if(!hitComponents.some(x=>x.type.toLowerCase()===type.toLowerCase())){
   if(hitComponents.length===1&&!hitComponents[0].type)hitComponents[0].type=type;
   else hitComponents.push({type,damage:'',modifier:'auto'});
  }
  renderHitDamageType();renderDamageComponents();calc();
  const reopened=$('hitDamageType').querySelector('details');if(reopened)reopened.open=true;
 };
 add.addEventListener('click',submit);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit()}});
 row.append(input,add);menu.append(row);details.append(menu);root.append(details);
}
function renderDamageComponents(){
 const root=$('damageComponents');root.replaceChildren();
 for(const comp of hitComponents){
  const card=document.createElement('div');card.className='damage-component';
  const label=document.createElement('label');label.textContent=comp.type||'Untyped';
  const input=document.createElement('input');input.type='number';input.min='0';input.placeholder='0';input.value=comp.damage;
  input.setAttribute('aria-label',`${comp.type||'Untyped'} damage taken`);
  input.addEventListener('input',()=>{comp.damage=input.value;calc()});
  const select=document.createElement('select');select.setAttribute('aria-label',`${comp.type||'Untyped'} damage modifier`);
  for(const [value,title] of [['auto','Auto'],['normal','Normal'],['resistance','Resistance'],['vulnerability','Vulnerability']]){
   const opt=document.createElement('option');opt.value=value;opt.textContent=title;select.append(opt);
  }
  select.value=comp.modifier;
  select.addEventListener('change',()=>{comp.modifier=select.value;calc()});
  const badge=document.createElement('small');badge.className='component-result';
  card.append(label,input,select,badge);root.append(card);
 }
}
function calc(){
 let modified=0,hasDamage=false;
 const cards=[...document.querySelectorAll('.damage-component')];
 hitComponents.forEach((comp,i)=>{
  const raw=comp.damage.trim();
  if(raw==='')return;
  const dmg=Number(raw);if(!Number.isFinite(dmg)||dmg<0)return;
  hasDamage=true;
  const reaction=comp.modifier==='auto'?typeReaction(comp.type):comp.modifier;
  const value=reaction==='resistance'?Math.floor(dmg/2):reaction==='vulnerability'?dmg*2:dmg;
  modified+=value;
  if(cards[i])cards[i].querySelector('.component-result').textContent=`${reaction==='normal'?'Normal':reaction==='resistance'?'Resistant':'Vulnerable'}: ${value}`;
 });
 $('applyDamage').disabled=!hasDamage;
 if(!hasDamage){
  $('modified').textContent='—';$('effectiveDR').textContent='—';$('hbLost').textContent='—';$('remainder').textContent='';
  $('damageExplanation').textContent='Enter damage to preview Hit Boxes lost.';return null;
 }
 const bypass=clamp(Number($('bypass').value),0,999999);
 const dr=$('ignoreDR').checked?0:Math.max(0,mob.dr-bypass);
 const after=Math.max(0,modified-dr);
 const threshold=effectiveThreshold();const lost=Math.floor(after/threshold),rem=after%threshold;
 $('modified').textContent=modified;$('effectiveDR').textContent=dr;
 $('hbLost').textContent=lost;$('remainder').textContent=`${rem} damage discarded`;
 $('damageExplanation').textContent=`${modified} combined damage − ${dr} DR = ${after} ÷ ${threshold} CON = ${lost} HB lost · ${rem} discarded`;
 return lost;
}
function render(){mob.floor=clamp(Math.trunc(mob.floor),1,18);mob.level=Math.max(1,Math.trunc(mob.level));$('name').value=mob.name;$('floor').value=mob.floor;$('level').value=mob.level;$('tier').value=mob.tier;$('mode').value=mob.mode;$('preset').value=mob.preset||'balanced';$('preset').disabled=mob.mode==='points';$('randomize').disabled=mob.mode==='points'||!['balanced','minmax','custom'].includes(mob.preset);$('statReference').disabled=false;$('summaryHealth').textContent=`${mob.maxHB} HB × ${effectiveThreshold()} CON`; $('healthDetail').textContent=`${mob.maxHB} hit boxes · CON threshold ${effectiveThreshold()}`;$('defaultDamage').textContent=diceCount(mob.floor)+mob.die;const mods=getMods();$('evade').textContent=10+mods[3]+mob.floor;$('surprise').textContent=10+mods[1]+mob.floor;renderStats();renderAttacksAndAbilities();renderGMNotes();renderHealth();renderDamageTypes();renderHitDamageType();renderDamageComponents();$('bypass').disabled=$('ignoreDR').checked;calc();save()}
function changeFloorOrTier(){mob.level=recommendedLevel(mob.tier,mob.floor);setTierDefaults();if(mob.mode!=='points'){if(!fillArray(mob.preset==='custom'?'balanced':mob.preset))return}undo=[];render()}
$('name').addEventListener('input',e=>{mob.name=e.target.value;save()});$('floor').addEventListener('change',e=>{mob.floor=clamp(Math.trunc(+e.target.value),1,18);changeFloorOrTier()});$('level').addEventListener('change',e=>{mob.level=Math.max(1,Math.trunc(+e.target.value));if(mob.mode==='points'&&spent()>budget()){alert('Level budget is too low for current RAW stats. Please adjust the stats or increase the level.');mob.level=+$('level').defaultValue||1}render()});$('tier').addEventListener('change',e=>{mob.tier=e.target.value;changeFloorOrTier()});$('mode').addEventListener('change',e=>{
 const next=e.target.value,old=mob.mode;if(next===old)return;
 const prevMods=mob.mods.slice(),prevPoints=mob.points.slice(),prevPreset=mob.preset;
 if(next==='points'){
   const converted=mob.mods.map((m,i)=>mob.locks[i]?costs[m]:1);
   const used=converted.reduce((s,v)=>s+v-1,0);
   if(used>mob.level*3){alert(`Locked stats require ${used} spendable points, but Level ${mob.level} provides only ${mob.level*3}. Increase Level or unlock stats before switching.`);e.target.value=old;return}
   if(!confirm('Switch to Points? Locked modifiers will convert to their minimum RAW stat values; unlocked stats start at 1. Continue?')){e.target.value=old;return}
   mob.points=converted;
 }else{
   const converted=mob.points.map((v,i)=>mob.locks[i]?Math.max(1,modOf(v)):1);
   const used=converted.reduce((s,v)=>s+costs[v],0);
   const cap=tierBudget(mob.tier,mob.floor);
   if(used>cap){alert(`Locked stats require ${used} points, but this tier has only ${cap}. Unlock or lower stats before switching.`);e.target.value=old;return}
   if(!confirm('Switch to Mods? Locked stats retain their current modifiers; unlocked stats will be redistributed. Continue?')){e.target.value=old;return}
   mob.mods=converted;mob.preset='balanced';
   if(!fillArray()){mob.mods=prevMods;mob.points=prevPoints;mob.preset=prevPreset;e.target.value=old;return}
 }
 mob.mode=next;render();
});
$('preset').addEventListener('change',e=>{const prior=mob.preset;mob.preset=e.target.value;if(mob.preset!=='custom'&&!fillArray()){mob.preset=prior}render()});
$('randomize').addEventListener('click',()=>{if(mob.mode==='points'||!['balanced','minmax','custom'].includes(mob.preset))return;fillArray(mob.preset==='custom'?'balanced':mob.preset);render()});
$('statReference').addEventListener('click',()=>{$('referencePanel').hidden=false});
$('closeReference').addEventListener('click',()=>{$('referencePanel').hidden=true});
$('resetDefaults').addEventListener('click',()=>{setTierDefaults();undo=[];render()});for(const field of ['maxHB','dr'])$(field).addEventListener('change',e=>{mob[field]=Math.max(field==='maxHB'?1:0,Math.trunc(+e.target.value||0));render()});$('conThreshold').addEventListener('change',e=>{mob.conThreshold=Math.max(1,Math.trunc(+e.target.value||1));render()});$('damageOne').addEventListener('click',()=>{mob.currentHB=Math.max(0,mob.currentHB-1);render()});$('healOne').addEventListener('click',()=>{mob.currentHB=Math.min(mob.maxHB,mob.currentHB+1);render()});$('fullHeal').addEventListener('click',()=>{mob.currentHB=mob.maxHB;render()});for(const field of ['bypass','ignoreDR'])$(field).addEventListener('input',calc);$('ignoreDR').addEventListener('change',()=>{$('bypass').disabled=$('ignoreDR').checked;calc()});function resetHit(){hitComponents=[{type:'',damage:'',modifier:'auto'}];renderHitDamageType();renderDamageComponents();$('bypass').value=0;$('ignoreDR').checked=false;$('bypass').disabled=false;calc()}$('resetHit').addEventListener('click',resetHit);$('applyDamage').addEventListener('click',()=>{const lost=calc();if(lost===null)return;if(lost<=0){resetHit();return}undo.push(mob.currentHB);mob.currentHB=Math.max(0,mob.currentHB-lost);resetHit();render()});$('undoDamage').addEventListener('click',()=>{if(!undo.length)return;mob.currentHB=undo.pop();render()});$('newCreature').addEventListener('click',()=>{if(!confirm('Start a new creature? Export your current creature first if you want to keep it.'))return;mob=make();undo=[];resetHit();fillArray();render();restoreWorkshopLayout()});$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({app:'jackalforge-gm-workshop',version:1,creature:mob},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(mob.name.trim().replace(/[^a-z0-9-]/gi,'-')||'creature')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});$('import').addEventListener('click',()=>$('importFile').click());$('importFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.app!=='jackalforge-gm-workshop'||!data.creature)throw Error('Not a GM Workshop export');if(!confirm('Replace the current creature with this import?'))return;mob={...make(),...data.creature};if(!Array.isArray(mob.resistances))mob.resistances=[];if(!Array.isArray(mob.vulnerabilities))mob.vulnerabilities=[];if(!Array.isArray(mob.attacks))mob.attacks=[];if(!Array.isArray(mob.abilities))mob.abilities=[];undo=[];resetHit();render();restoreWorkshopLayout()}catch(err){alert('Import failed: '+err.message)}finally{e.target.value=''}});
if(!Array.isArray(mob.resistances))mob.resistances=[];if(!Array.isArray(mob.vulnerabilities))mob.vulnerabilities=[];if(!mob.preset)mob.preset='balanced';if(mob.mode==='array')mob.mode='mods';if(!localStorage.getItem(KEY))fillArray();render();

// v0.6 — attack and ability editors, adapted from Character Sheet.
// Monster To Hit is a FIXED DC: 10 + chosen stat modifier + floor + adjustment.
function statModFor(stat){return getMods()[names.indexOf(stat)] ?? 0}
function attackDC(a){return 10+statModFor(a.hitStat||'STR')+mob.floor+(Number(a.dcBonus)||0)}
function damageDisplay(a){const die=a.damageDice||`${diceCount(mob.floor)}${mob.die}`;const stat=a.damageStat==='none'?null:a.damageStat==='linked'||!a.damageStat?(a.hitStat||'STR'):a.damageStat;const bonus=(stat?statModFor(stat):0)+(Number(a.damageBonus)||0);return die+(bonus===0?'':bonus>0?' + '+bonus:' − '+Math.abs(bonus))}
function abilityDC(a){return a.stat?10+statModFor(a.stat)+mob.floor+(Number(a.dcBonus)||0):null}
function renderAttacksAndAbilities(){
 for(const [key,containerId] of [['attacks','attackList'],['abilities','abilityList']]){
  const box=$(containerId);if(!box)return;box.replaceChildren();
  for(const item of mob[key]||[]){const row=document.createElement('button');row.type='button';row.className='attack-row';
   const cols=key==='attacks'?[item.name||'Unnamed Attack','DC '+attackDC(item),damageDisplay(item),item.effects||'']:[item.name||'Unnamed Ability',item.type||'Active',abilityDC(item)===null?'—':'DC '+abilityDC(item),item.effects||''];
   cols.forEach(v=>{const el=document.createElement('span');el.textContent=v;row.append(el)});row.addEventListener('click',()=>openWorkshopEditor(key,item.id));box.append(row);
  }

 }
}
let editorKind='attacks',editorId=null;
const attackMap={name:'attackName',hitStat:'attackHitStat',dcBonus:'attackDCBonus',damageDice:'attackDice',damageStat:'attackDamageStat',damageBonus:'attackBonus',damageTypes:'attackTypes',manaCost:'attackMana',effects:'attackEffects'};
const abilityMap={name:'abilityName',type:'abilityType',stat:'abilityStat',dcBonus:'abilityDCBonus',cost:'abilityCost',range:'abilityRange',effects:'abilityEffects'};
function editorValues(kind){const map=kind==='attacks'?attackMap:abilityMap;return Object.fromEntries(Object.entries(map).map(([key,id])=>[key,$(id).value]))}
function updateEditorPreview(){if(editorKind==='attacks'){const a=editorValues('attacks');$('attackPreview').textContent=`To Hit: DC ${attackDC(a)} (10 + ${a.hitStat} Mod + Floor${Number(a.dcBonus)?' + adjustment':''}) · Damage: ${damageDisplay(a)}`;}else{const a=editorValues('abilities');$('abilityPreview').textContent=a.stat?`Save DC: ${abilityDC(a)} (10 + ${a.stat} Mod + Floor${Number(a.dcBonus)?' + adjustment':''})`:'No stat-based DC selected.'}}
function openWorkshopEditor(kind,id=null){editorKind=kind;editorId=id;const entry=(mob[kind]||[]).find(a=>a.id===id);const map=kind==='attacks'?attackMap:abilityMap;const defaults=kind==='attacks'?{hitStat:'STR',damageStat:'linked',damageDice:`${diceCount(mob.floor)}${mob.die}`,dcBonus:0,damageBonus:0}:{type:'Active',dcBonus:0};
 for(const [key,field] of Object.entries(map))$(field).value=entry?.[key]??defaults[key]??'';
 $('attackEditor').hidden=kind!=='attacks';$('abilityEditor').hidden=kind!=='abilities';$('editorTitle').textContent=(entry?'EDIT ':'NEW ')+(kind==='attacks'?'ATTACK':'ABILITY');
 $(kind==='attacks'?'duplicateAttack':'duplicateAbility').hidden=!entry;$(kind==='attacks'?'deleteAttack':'deleteAbility').hidden=!entry;
 $('workshopOverlay').hidden=false;$('workshopSidebar').hidden=false;updateEditorPreview();}
function closeWorkshopEditor(){$('workshopOverlay').hidden=true;$('workshopSidebar').hidden=true;editorId=null}
$('addAttackButton').addEventListener('click',()=>openWorkshopEditor('attacks'));
$('addAbilityButton').addEventListener('click',()=>openWorkshopEditor('abilities'));
$('closeWorkshopSidebar').addEventListener('click',closeWorkshopEditor);$('workshopOverlay').addEventListener('click',closeWorkshopEditor);
for(const kind of ['attacks','abilities']){
 const form=$(kind==='attacks'?'attackEditor':'abilityEditor');form.addEventListener('input',updateEditorPreview);form.addEventListener('change',updateEditorPreview);
 form.addEventListener('submit',e=>{e.preventDefault();const values=editorValues(kind);if(!values.name.trim())return;const existing=(mob[kind]||[]).find(a=>a.id===editorId);if(existing)Object.assign(existing,values);else mob[kind].push({id:crypto.randomUUID(),...values});save();renderAttacksAndAbilities();closeWorkshopEditor()});
 $(kind==='attacks'?'duplicateAttack':'duplicateAbility').addEventListener('click',()=>{const original=mob[kind].find(a=>a.id===editorId);if(!original)return;const copy={...original,id:crypto.randomUUID(),name:original.name+' (Copy)'};mob[kind].push(copy);save();renderAttacksAndAbilities();openWorkshopEditor(kind,copy.id)});
 $(kind==='attacks'?'deleteAttack':'deleteAbility').addEventListener('click',()=>{if(!editorId||!confirm('Delete this '+(kind==='attacks'?'attack':'ability')+'?'))return;mob[kind]=mob[kind].filter(a=>a.id!==editorId);save();renderAttacksAndAbilities();closeWorkshopEditor()});
}
// Searchable GM Notes — stored per creature; legacy free-text notes migrate once.
function ensureGMNotes(){
 if(!Array.isArray(mob.gmNotes))mob.gmNotes=[];
 if(typeof mob.notes==='string'&&mob.notes.trim()&&!mob.gmNotes.some(n=>n.legacy)){
  mob.gmNotes.push({id:crypto.randomUUID(),title:'Previous GM Notes',body:mob.notes,pinned:false,hidden:false,legacy:true});
  mob.notes='';save();
 }
}
let editingNoteId=null;
function renderGMNotes(){
 ensureGMNotes();const root=$('gmNoteList');root.replaceChildren();
 const query=$('noteSearch').value.trim().toLocaleLowerCase();const showHidden=$('showHiddenNotes').checked;
 const notes=[...mob.gmNotes].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned));
 for(const note of notes){
  if(note.hidden&&!showHidden)continue;
  if(query&&!((note.title||'')+' '+(note.body||'')).toLocaleLowerCase().includes(query))continue;
  const row=document.createElement('article');row.className='gm-note'+(note.hidden?' note-is-hidden':'');
  const head=document.createElement('div');head.className='gm-note-head';
  const title=document.createElement('button');title.type='button';title.className='gm-note-title';title.textContent=(note.pinned?'📌 ':'')+(note.title||'Untitled');title.addEventListener('click',()=>openNoteEditor(note.id));head.append(title);
  const actions=document.createElement('div');actions.className='gm-note-actions';
  const pin=document.createElement('button');pin.type='button';pin.textContent=note.pinned?'UNPIN':'PIN';pin.setAttribute('aria-label',note.pinned?'Unpin note':'Pin note');pin.addEventListener('click',()=>{note.pinned=!note.pinned;save();renderGMNotes()});actions.append(pin);
  const hide=document.createElement('button');hide.type='button';hide.textContent=note.hidden?'SHOW':'HIDE';hide.addEventListener('click',()=>{note.hidden=!note.hidden;save();renderGMNotes()});actions.append(hide);
  const edit=document.createElement('button');edit.type='button';edit.textContent='EDIT';edit.addEventListener('click',()=>openNoteEditor(note.id));actions.append(edit);
  head.append(actions);row.append(head);
  if(note.body){const body=document.createElement('p');body.className='gm-note-body';body.textContent=note.body;row.append(body)}
  root.append(row);
 }
}
function openNoteEditor(id=null){
 editingNoteId=id;const note=mob.gmNotes.find(n=>n.id===id);
 $('noteEditorTitle').textContent=note?'EDIT GM NOTE':'NEW GM NOTE';
 $('noteTitle').value=note?.title||'';$('noteBody').value=note?.body||'';
 $('notePinned').checked=!!note?.pinned;$('noteHidden').checked=!!note?.hidden;
 $('deleteNote').hidden=!note;$('noteOverlay').hidden=false;$('noteSidebar').hidden=false;
 $('noteTitle').focus();
}
function closeNoteEditor(){$('noteOverlay').hidden=true;$('noteSidebar').hidden=true;editingNoteId=null}
$('addNoteButton').addEventListener('click',()=>openNoteEditor());
$('closeNoteSidebar').addEventListener('click',closeNoteEditor);
$('noteOverlay').addEventListener('click',closeNoteEditor);
$('noteSearch').addEventListener('input',renderGMNotes);
$('showHiddenNotes').addEventListener('change',renderGMNotes);
$('clearNoteSearch').addEventListener('click',()=>{$('noteSearch').value='';$('showHiddenNotes').checked=false;renderGMNotes()});
$('noteEditor').addEventListener('submit',e=>{
 e.preventDefault();const title=$('noteTitle').value.trim();if(!title)return;
 const values={title,body:$('noteBody').value,pinned:$('notePinned').checked,hidden:$('noteHidden').checked};
 const note=mob.gmNotes.find(n=>n.id===editingNoteId);
 if(note)Object.assign(note,values);else mob.gmNotes.push({id:crypto.randomUUID(),...values});
 save();renderGMNotes();closeNoteEditor();
});
$('deleteNote').addEventListener('click',()=>{
 if(!editingNoteId||!confirm('Delete this GM note?'))return;
 mob.gmNotes=mob.gmNotes.filter(n=>n.id!==editingNoteId);save();renderGMNotes();closeNoteEditor();
});
// Section controls: permanent header, arrows and collapse state saved per creature.
function initializeWorkshopSections(){
 const panels=[...document.querySelectorAll('main.wrap > section.panel')];
 panels.forEach((panel,i)=>{const title=panel.querySelector(':scope > .section-title');if(!title)return;const key=panel.dataset.workshopSection||['creature','stats','defenses','notes'][i]||'section'+i;panel.dataset.workshopSection=key;
 const body=document.createElement('div');body.className='workshop-section-body';while(title.nextSibling)body.append(title.nextSibling);panel.append(body);
 const controls=document.createElement('div');controls.className='section-move-buttons';
 for(const [text,action] of [['↑',-1],['↓',1],['− Collapse',0]]){const btn=document.createElement('button');btn.type='button';btn.textContent=text;btn.title=action===0?'Collapse / expand section':action<0?'Move section up':'Move section down';btn.addEventListener('click',()=>{
  if(action===0){body.hidden=!body.hidden;panel.classList.toggle('is-collapsed',body.hidden);btn.textContent=body.hidden?'+ Expand':'− Collapse';storeWorkshopLayout()}
  else{const siblings=[...document.querySelectorAll('main.wrap > section.panel')];const index=siblings.indexOf(panel);const target=siblings[index+action];if(!target)return;if(action<0)target.before(panel);else target.after(panel);updateSectionArrows();storeWorkshopLayout()}
 });controls.append(btn)}title.append(controls);
 });
 const layout=mob.sheetLayout||{};const order=Array.isArray(layout.order)?layout.order:[];const all=[...document.querySelectorAll('main.wrap > section.panel')];order.forEach(key=>{const panel=all.find(p=>p.dataset.workshopSection===key);if(panel)document.querySelector('main.wrap').append(panel)});
 for(const panel of all){const collapsed=Array.isArray(layout.collapsed)&&layout.collapsed.includes(panel.dataset.workshopSection);const body=panel.querySelector('.workshop-section-body');body.hidden=collapsed;panel.classList.toggle('is-collapsed',collapsed);panel.querySelector('.section-move-buttons button:last-child').textContent=collapsed?'+ Expand':'− Collapse'}updateSectionArrows();
}
function updateSectionArrows(){const panels=[...document.querySelectorAll('main.wrap > section.panel')];panels.forEach((p,i)=>{const buttons=p.querySelectorAll('.section-move-buttons button');buttons[0].disabled=i===0;buttons[1].disabled=i===panels.length-1})}
function storeWorkshopLayout(){mob.sheetLayout={order:[...document.querySelectorAll('main.wrap > section.panel')].map(p=>p.dataset.workshopSection),collapsed:[...document.querySelectorAll('main.wrap > section.panel')].filter(p=>p.querySelector('.workshop-section-body')?.hidden).map(p=>p.dataset.workshopSection)};save()}
function restoreWorkshopLayout(){const panels=[...document.querySelectorAll('main.wrap > section.panel')];const layout=mob.sheetLayout||{};const host=document.querySelector('main.wrap');(layout.order||[]).forEach(key=>{const panel=panels.find(p=>p.dataset.workshopSection===key);if(panel)host.append(panel)});panels.forEach(p=>{const hidden=(layout.collapsed||[]).includes(p.dataset.workshopSection);p.querySelector('.workshop-section-body').hidden=hidden;p.classList.toggle('is-collapsed',hidden);p.querySelector('.section-move-buttons button:last-child').textContent=hidden?'+ Expand':'− Collapse'});updateSectionArrows()}
if(!Array.isArray(mob.attacks))mob.attacks=[];if(!Array.isArray(mob.abilities))mob.abilities=[];
initializeWorkshopSections();renderAttacksAndAbilities();renderGMNotes();
