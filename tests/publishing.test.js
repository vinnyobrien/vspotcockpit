import test from 'node:test';
import assert from 'node:assert/strict';
import {seedPublishing,releaseBlockers,COPY_FIELDS} from '../src/lib/publishing.js';
test('release remains pending until assets and verified copy are supplied',()=>{
  const item=seedPublishing()[0];
  assert.equal(item.date,'2026-10-14');
  assert(releaseBlockers(item).includes('complete transcript'));
  assert.equal(item.copy.spotifyChapters,'');
  const complete={...item,time:'12:00',videoLink:'https://example.com/video',audioLink:'https://example.com/audio',transcriptLink:'https://example.com/vtt',checks:{edit:true,transcript:true,chapters:true,copy:true},copy:Object.fromEntries(COPY_FIELDS.map(([key])=>[key,'Verified content']))};
  assert.deepEqual(releaseBlockers(complete),[]);
  assert(releaseBlockers({...complete,checks:{...complete.checks,chapters:false}}).length);
});
