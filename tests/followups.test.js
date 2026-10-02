import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyFollowups,mergeBrief,updateFollowup,safeLink } from '../netlify/functions/_followup-data.js';
const action={sourceType:'fireflies',sourceId:'meeting-1',sourceUrl:'https://example.com/transcript',sourceDate:'2026-10-02T09:00:00Z',title:'Send the agenda',owner:'Vinny',dueDate:'2026-10-05',dueBasis:'proposed',evidence:'I will send you the agenda.'};
const payload={schema:'cockpit-actions-v1',generatedAt:'2026-10-02T20:30:00+01:00',actions:[action],reviews:[{sourceId:'meeting-1',sourceDate:'2026-10-02T09:00Z',sourceUrl:'https://example.com/transcript',title:'Planning call',summary:'Agenda promised',reviewedAt:'2026-10-02T20:30Z'}]};
test('repeated briefs do not duplicate actions or reopen completed work',()=>{
  const first=mergeBrief(emptyFollowups(),payload,'email-1');
  const done=updateFollowup(first,{id:first.actions[0].id,action:'done'});
  const again=mergeBrief(done,payload,'email-2');
  assert.equal(again.actions.length,1);assert.equal(again.actions[0].state,'done');assert.equal(again.reviews.length,1);
  assert.equal(mergeBrief(again,payload,'email-2'),again);
});
test('a confirmed due date survives a subsequent inferred date',()=>{
  const first=mergeBrief(emptyFollowups(),payload,'email-1');
  const rescheduled=updateFollowup(first,{id:first.actions[0].id,action:'due',date:'2026-10-08'});
  const again=mergeBrief(rescheduled,payload,'email-2');
  assert.equal(again.actions[0].dueDate,'2026-10-08');assert.equal(again.actions[0].dueBasis,'agreed');
});
test('zero-action transcripts are still recorded as reviewed',()=>{
  const data=mergeBrief(emptyFollowups(),{...payload,actions:[]},'email-1');assert.equal(data.reviews.length,1);assert.equal(data.actions.length,0);
});
test('actions require actual owners, evidence and labelled due dates',()=>{
  for(const invalid of [{...action,evidence:''},{...action,owner:''},{...action,dueDate:'tomorrow'},{...action,dueBasis:'guessed'}]) assert.throws(()=>mergeBrief(emptyFollowups(),{...payload,actions:[invalid]},'email-1'));
  assert.equal(safeLink('javascript:alert(1)'),'');assert.throws(()=>updateFollowup(emptyFollowups(),{id:'missing',action:'done'}));
});
