import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, authorisedPass, fileType, findRecording } from '../netlify/functions/_guest-pass.js';
const id='12345678-1234-1234-1234-123456789012',token='a'.repeat(64),password='guest-test';
const fixture={id,tokenHash:hash(token),passwordHash:hash(password),expiresAt:Date.now()+60000,email:'guest@example.com',show:'The Struggle Bus'};
const request=(p=password,t=token)=>new Request(`https://example.com/api?id=${id}`,{headers:{Authorization:`Bearer ${t}`,'X-Guest-Password':p}});
test('the personal link needs its separate password',async()=>{
 assert.equal(await authorisedPass(request(),async()=>fixture),fixture);
 assert.equal(await authorisedPass(request('wrong'),async()=>fixture),null);
 assert.equal(await authorisedPass(request('',token),async()=>fixture),null);
 assert.equal(await authorisedPass(request(password,'b'.repeat(64)),async()=>fixture),null);
});
test('expired and revoked invitations cannot unlock status or uploads',async()=>{
 assert.equal(await authorisedPass(request(),async()=>({...fixture,expiresAt:1})),null);
 assert.equal(await authorisedPass(request(),async()=>({...fixture,revoked:true})),null);
});
test('a headshot must contain supported image bytes, not an SVG or renamed HTML',()=>{
 assert.equal(fileType(Buffer.from('<svg onload="alert(1)">')),null);
 assert.equal(fileType(Buffer.from('<html>')),null);
 assert.equal(fileType(Buffer.from([0xff,0xd8,0xff,0xe0])), 'image/jpeg');
 assert.equal(fileType(Buffer.from([137,80,78,71,13,10,26,10])), 'image/png');
 assert.equal(fileType(Buffer.from('RIFF1234WEBP')), 'image/webp');
});
test('booking needs the invited attendee and the right recording, excluding cancelled events',()=>{
 const good={summary:'Struggle Bus recording',attendees:[{email:'GUEST@example.com'}],start:{dateTime:'2026-11-01T10:00:00Z'}};
 assert.equal(findRecording([good],fixture),good);
 assert.equal(findRecording([{...good,status:'cancelled'}],fixture),undefined);
 assert.equal(findRecording([{...good,attendees:[{email:'another@example.com'}]}],fixture),undefined);
 assert.equal(findRecording([{...good,summary:'Sunday Supplement recording'}],fixture),undefined);
});
