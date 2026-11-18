import test from 'node:test';
import assert from 'node:assert/strict';
import {seedPublishing,releaseBlockers,COPY_FIELDS,parseReleaseImport} from '../src/lib/publishing.js';
test('release remains pending until assets and verified copy are supplied',()=>{
  const item=seedPublishing().find(row=>row.id==='struggle-bus-2026-10-14');
  assert.equal(item.date,'2026-10-14');
  assert(releaseBlockers(item).includes('complete transcript'));
  assert.equal(item.copy.spotifyChapters,'');
  const complete={...item,time:'12:00',videoLink:'https://example.com/video',audioLink:'https://example.com/audio',transcriptLink:'https://example.com/vtt',checks:{edit:true,transcript:true,chapters:true,copy:true},copy:Object.fromEntries(COPY_FIELDS.map(([key])=>[key,'Verified content']))};
  assert.deepEqual(releaseBlockers(complete),[]);
  assert(releaseBlockers({...complete,checks:{...complete.checks,chapters:false}}).length);
});

test('private release import validates links and leaves release approval pending',()=>{
  const item=parseReleaseImport(JSON.stringify({id:'test-psa',show:'V Spot PSAs',guest:'PSA',copy:{linkedinPost:'Copy',substackTitle:'Title',substackBody:'Body'},videoLink:'https://example.com/review.mp4'}));
  assert(item.copy.linkedinPost==='Copy');
  assert(releaseBlockers(item).includes('Shopware approval verified'));
  assert(!releaseBlockers(item).includes('Spotify audio'));
  assert.throws(()=>parseReleaseImport(JSON.stringify({...item,videoLink:'javascript:alert(1)'})));
  assert.throws(()=>parseReleaseImport('{}'));
  assert.deepEqual(releaseBlockers({...item,date:'2026-11-19',time:'12:00',checks:{edit:true,transcript:true,copy:true,sponsor:true}}),[]);
});
