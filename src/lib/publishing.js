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
export function gregorRelease() {
  const item = newRelease('ostrich-gregor-kiddie-2026-10-22','Gregor Kiddie — The Small Gains of AI','2026-10-22');
  item.show='The Ostrich Report'; item.time='11:00';
  item.notes='Rithum-sponsored episode. Planned release 22 Oct 2026, 11:00 Ireland. Publishing master reported as 36:45, 720p, -16 LUFS with corrected Ostrich intro/outro, Gregor card, Rithum branding and false start tightened. DO NOT top-and-tail again unless the actual export fails review. Final master location and checks not independently verified. Season/episode number unconfirmed: omit public numbering. Topics: marginal gains from AI; returns intelligence; familiar enterprise workflows; product data readiness; engineering and marketing convergence. Do not publish until actual video/audio and transcript are linked and reviewed.';
  item.copy.spotifyTitle='The Small Gains of AI: How Commerce Actually Changes | Gregor Kiddie, Rithum';
  item.copy.youtubeTitle=item.copy.spotifyTitle;
  item.copy.spotifyDescription='What if the real impact of AI on commerce is not one enormous breakthrough, but 1% here and 2% there? Vinny O’Brien speaks with Gregor Kiddie, Senior Engineering Manager at Rithum, about marginal gains, returns intelligence, enterprise trust, familiar workflows and product data readiness for agentic commerce. The Ostrich Report is sponsored by Rithum.';
  item.copy.youtubeDescription=item.copy.spotifyDescription+'\\n\\nTopics: AI marginal gains; the British Cycling analogy; reducing returns; data readiness; why enterprises prefer familiar interfaces; engineering meets marketing. Hosted by Vinny O’Brien and Hendrik Laubscher.';
  item.copy.spotifyChapters='Chapter timings pending verification against final audio export.';
  item.copy.youtubeChapters='Chapter timings pending verification against final video export.';
  item.copy.linkedinPost='AI might transform commerce without looking particularly transformative. Gregor Kiddie of Rithum makes the case for marginal gains: 1% here, 2% there, better product data, fewer returns and smarter decisions inside familiar workflows. On The Ostrich Report we discuss what enterprise AI really needs to deliver, and why the interface matters as much as the intelligence. Sponsored by Rithum. [Add live episode link before posting]';
  item.copy.substackTitle='The Most Important AI Gains Might Be the Ones Nobody Notices';
  item.copy.substackBody='We keep waiting for the spectacular AI moment in commerce. Gregor Kiddie at Rithum offers a more useful picture: the accumulation of small improvements. A clearer product title. Better sizing information. Returns patterns that would otherwise be missed. One or two percent at a time, compounded across a business.\\n\\nGregor also explains why enterprise customers do not necessarily want another chatbot. They want better outcomes through tools and workflows they already trust. That puts data readiness, reliable product content and practical delivery mechanisms at the centre of the conversation.\\n\\nThere is a fascinating cultural collision here too: engineers increasingly need to explain the commercial story in data, while marketers need to understand the logic behind the systems.\\n\\nNot AI theatre. Useful intelligence, quietly compounded. The full conversation is on The Ostrich Report, sponsored by Rithum. [Add live link before publishing]';
  return item;
}

export function seedPublishing() {
  return [gregorRelease(),newRelease('struggle-bus-2026-10-14','','2026-10-14')];
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
