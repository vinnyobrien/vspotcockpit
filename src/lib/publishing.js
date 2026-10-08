export const PUBLISHING_KEY = 'vault:publishing:v1';
export const RELEASE_SCHEDULE = [
  {show:'The Struggle Bus',day:'Wednesday',weekday:3,time:''},
  {show:'The Ostrich Report',day:'Thursday',weekday:4,time:''},
  {show:'V Spot PSAs',day:'Friday',weekday:5,time:''},
  {show:'The V Spot',day:'Sunday',weekday:0,time:'18:00'},
];
export const COPY_FIELDS = [
  ['spotifyTitle','Spotify title'], ['spotifyDescription','Spotify description'],
  ['spotifyChapters','Spotify chapters / breaks'], ['youtubeTitle','YouTube title'],
  ['youtubeDescription','YouTube description'], ['youtubeChapters','YouTube chapters'],
  ['linkedinPost','LinkedIn release post'], ['substackTitle','Substack title'],
  ['substackBody','Substack reflection'],
];
export function newRelease(id,guest='',date='') {
  return {id,guest,show:'The Struggle Bus',date,time:'',videoLink:'',audioLink:'',transcriptLink:'',
    notes:'',checks:{edit:false,transcript:false,chapters:false,copy:false},
    copy:Object.fromEntries(COPY_FIELDS.map(([key])=>[key,''])),links:{spotify:'',youtube:'',substack:'',linkedin:''}};
}
export function seedPublishing() {
  return [newRelease('struggle-bus-2026-10-14','','2026-10-14')];
}
export function releaseBlockers(item) {
  const missing=[];
  if(!item.videoLink?.trim()) missing.push('final video');
  if(!item.audioLink?.trim()) missing.push('Spotify audio');
  if(!item.transcriptLink?.trim()) missing.push('complete transcript');
  for(const [key,label] of [['edit','edit reviewed'],['transcript','transcript verified'],['chapters','chapters checked against final exports'],['copy','release copy reviewed']]) if(!item.checks?.[key]) missing.push(label);
  for(const [key,label] of COPY_FIELDS) if(!item.copy?.[key]?.trim()) missing.push(label);
  if(!item.date) missing.push('release date');
  if(!item.time) missing.push('release time');
  return missing;
}
