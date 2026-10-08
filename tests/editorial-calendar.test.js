import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCalendar, applyReleaseCadence, dateInDublin, transition, reviseItem, deadlines } from '../src/lib/editorial-calendar.js';

function ready() { const item=seedCalendar().items[0]; return {...item,time:'16:00',finalLink:'https://example.com/final',checks:{ideas:true,brief:true,draft:true,review:true,sponsor:false}}; }
test('PSA launch date and Ireland date boundary',()=>{
  assert.equal(seedCalendar().items[0].date,'2026-10-09');
  assert.equal(dateInDublin(new Date('2026-10-01T23:30:00Z')),'2026-10-02');
  assert.equal(dateInDublin(new Date('2026-10-26T23:30:00Z')),'2026-10-26');
});
test('weekly cadence and Sunday time; migration preserves authored records and is idempotent',()=>{
  const seed=seedCalendar();
  assert.equal(seed.items.length,40);
  for(const i of seed.items){const day=new Date(i.date+'T12:00Z').getUTCDay();assert.equal(day,{'V Spot PSAs':5,'The V Spot':0,'The Struggle Bus':3,'The Ostrich Report':4}[i.show]);if(i.show==='The V Spot')assert.equal(i.time,'18:00');}
  const old={...seed.items[0],id:'vspot-return-2026-10-09',show:'The V Spot News'};
  const authored={...old,id:'vspot-return-2026-10-16',history:[{action:'Edited'}]};
  const migrated=applyReleaseCadence({revision:5,items:[old,authored]});
  assert.equal(migrated.revision,5);
  assert(!migrated.items.some(i=>i.id===old.id));
  assert.deepEqual(migrated.items.find(i=>i.id===authored.id),authored);
  assert.deepEqual(applyReleaseCadence(migrated),migrated);
});
test('incomplete planning and unapproved publication are blocked',()=>{
  assert.throws(()=>transition(seedCalendar().items[0],'approve'));
  assert.throws(()=>transition(ready(),'published'));
  assert.throws(()=>transition(ready(),'approve'));
});
test('sponsor evidence is required; edits clear approval',()=>{
  const review=transition({...ready(),sponsor:'Partner'},'review');
  assert.throws(()=>transition(review,'approve'));
  const complete={...review,sponsorDate:'2026-10-07',sponsorNeeds:'Intro and outro',sponsorEvidence:'Sponsor email approval',checks:{...review.checks,sponsor:true}};
  const approved=transition(complete,'approve');
  assert.equal(approved.approval.by,'Vinny');
  const revised=reviseItem(approved,{...approved,title:'Changed sponsor copy'});
  assert.equal(revised.approval,null);
  assert.throws(()=>transition(revised,'published'));
});
test('publication is an explicit confirmation and removes future deadlines',()=>{
  const approved=transition(transition(ready(),'review'),'approve');
  const published=transition(approved,'published');
  assert.equal(published.status,'published');
  assert.equal(deadlines(published).length,0);
  assert.equal(published.history.length,3);
});
