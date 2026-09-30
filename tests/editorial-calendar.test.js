import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCalendar, dateInDublin, transition, reviseItem, deadlines } from '../src/lib/editorial-calendar.js';

function ready() { const item=seedCalendar().items[0]; return {...item,time:'16:00',finalLink:'https://example.com/final',checks:{ideas:true,brief:true,draft:true,review:true,sponsor:false}}; }
test('confirmed return date and Ireland date boundary',()=>{
  assert.equal(seedCalendar().items[0].date,'2026-10-09');
  assert.equal(dateInDublin(new Date('2026-10-01T23:30:00Z')),'2026-10-02');
  assert.equal(dateInDublin(new Date('2026-10-26T23:30:00Z')),'2026-10-26');
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
