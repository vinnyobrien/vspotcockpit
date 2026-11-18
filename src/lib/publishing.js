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
  item.show='The Ostrich Report'; item.time='11:00'; item.videoLink='https://drive.google.com/file/d/1yKZvMNeuMTRHz6JWyHxXTN0h4Qwn21Dy/view';
  item.notes='Rithum-sponsored episode. Planned release 22 Oct 2026, 11:00 Ireland. Publishing master reported as 36:45, 720p, -16 LUFS with corrected Ostrich intro/outro, Gregor card, Rithum branding and false start tightened. DO NOT top-and-tail again unless the actual export fails review. Branded 360p review cut linked in Final video link; 720p publishing master not verified. Keep checks pending. Season/episode number unconfirmed: omit public numbering. Topics: marginal gains from AI; returns intelligence; familiar enterprise workflows; product data readiness; engineering and marketing convergence. Do not publish until actual video/audio and transcript are linked and reviewed.';
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


export function paulStaffordRelease() {
  const item = newRelease('struggle-paul-stafford-2026-11-11','Paul Stafford — EPAM | Retail Media, Career and Human Judgement','2026-11-11');
  item.show='The Struggle Bus';
  item.notes='SEASON 4 · Sponsor: VirtualStock. STATUS: corrected review v4 stored in ChatGPT Library at /VSpot Media/Struggle Bus/PaulStafford_S4_CORRECTED_REVIEW_v4.mp4 (library file id libfile_17b83ac11f608191837f0be8ae1a6732). This is a durable Library asset, NOT a public video URL. Review v4 reuses actual Season 4 animated bus arrival, VirtualStock logo, driver-door opening and branded outro from Shaje Ganny reference; initial tapping and dead air trimmed. Duration approximately 24:56. Not yet fully checked for audio transitions and captions; do not mark as approved MASTER. NOT PUBLISHED to YouTube or Spotify. Platform uploads and links outstanding. Funny and Sunny music supplied; do not ask for it again. Preserve source and approved season wrappers; no typing animation. Verify full master audio and caption sync before release.';
  item.copy.spotifyTitle='The Human Side of Retail Media | Paul Stafford, EPAM — The Struggle Bus';
  item.copy.youtubeTitle='Retail Media, Career Detours & the Human Side of Tech | Paul Stafford — The Struggle Bus';
  item.copy.spotifyDescription='Vinny O’Brien welcomes Paul Stafford of EPAM for a candid conversation about retail media, the changing tools of commerce, professional experience and the human judgement behind the technology. There is room for the personal side too: life in the UK, family and the paths that bring us to our work. The Struggle Bus Season 4 is sponsored by VirtualStock. [Add verified episode link and sponsor URL before publishing.]';
  item.copy.youtubeDescription=item.copy.spotifyDescription+'\\n\\nTopics include career experience, retail media measurement, data and tools, and separating signal from noise.\\n\\nSubscribe, share and join us for more conversations from The Struggle Bus. [Final chapters and sponsor links pending.]';
  item.copy.spotifyChapters='PENDING: regenerate and verify from the final VirtualStock-branded audio master; do not use RAW timecodes.';
  item.copy.youtubeChapters='PENDING: regenerate and verify from the final VirtualStock-branded video master; do not use RAW timecodes.';
  item.copy.linkedinPost="Retail media has no shortage of dashboards, acronyms and people explaining how everything is about to change forever.\n\nBut somewhere underneath all that technology, there are still human beings trying to make sensible decisions.\n\nThis week on The Struggle Bus, I’m joined by Paul Stafford from EPAM.\n\nWe get into retail media, the changing world of commerce, the value of experience and why human judgement still matters when the tools keep getting smarter.\n\nBut, as ever, the conversation wanders beyond the job description.\n\nWe talk about careers, the paths we take, life outside work and the rather wonderful business of trying to balance professional ambition with being an actual person.\n\nThat’s what I enjoy most about this show. The technology might get us into the conversation, but the people are why I stay.\n\nA big thank you to Paul for coming aboard.\n\nThe Struggle Bus Season 4 is proudly supported by VirtualStock.\n\nWatch or listen here: [Episode link]\n\n#TheStruggleBus #RetailMedia #Ecommerce #Careers #VirtualStock";
  item.copy.substackTitle="The Human Behind the Retail Media Dashboard — Paul Stafford";
  item.copy.substackBody="There is an extraordinary amount of noise in the world of commerce at the moment.\n\nArtificial intelligence. Retail media. Attribution. Automation. New platforms. New acronyms. New ways of explaining things that, occasionally, were perfectly understandable before somebody gave them a three-letter abbreviation.\n\nAnd somewhere in the middle of all this sits a person trying to figure out what actually matters.\n\nThat’s the part that interests me.\n\nFor this episode of The Struggle Bus, I was joined by Paul Stafford from EPAM, someone who spends a good deal of his professional life thinking about retail media and the changing relationship between technology, retailers and brands.\n\nWe talked about the tools, naturally. We talked about the growing complexity of the industry, the importance of knowing which signals deserve attention, and the experience required to separate useful information from an impressive-looking collection of numbers.\n\nBut I don’t really invite people onto The Struggle Bus to recite their LinkedIn profiles. I can read those myself. I’ve even been known to understand one occasionally.\n\n## The person behind the profession\n\nWhat I find far more interesting is how people arrive where they are. The experiences that shape their judgement. The unexpected turns. The things they’ve learned through doing the work rather than talking about doing the work.\n\nPaul’s career and perspective gave us plenty to explore, but so did the conversation beyond retail media. Life in the UK. Family. Parenthood. The competing demands of work and the things that matter when the laptop is closed.\n\nThese aren’t distractions from a professional conversation. They’re part of it.\n\nWe spend so much time discussing how technology can make businesses more efficient that we sometimes forget the people operating those businesses are living entire lives outside them. And those lives shape the decisions they make.\n\n## Experience still counts\n\nOne of the interesting tensions in commerce is that our tools are becoming more sophisticated while the fundamental questions remain remarkably familiar.\n\nWho is the customer? What do they actually want? What is working? What is merely making a lot of noise?\n\nTechnology can help answer those questions, but judgement still determines what we do with the answers.\n\nThat’s why I enjoy speaking with people who’ve spent time working through the messy reality of the industry.\n\nNot everything fits neatly into a dashboard. Not every career follows a straight line. And not every worthwhile conversation needs to end with five actionable takeaways and a downloadable white paper.\n\nSometimes it’s enough to understand another person’s journey a little better.\n\n## Come aboard\n\nMy thanks to Paul for being generous with his time and conversation.\n\nIf you’re interested in retail media, commerce, careers, or simply how people navigate the increasingly strange world of work, I hope you’ll enjoy this one.\n\nWatch or listen to the episode: [Episode link]\n\nThe Struggle Bus Season 4 is proudly sponsored by VirtualStock.\n\nIf you enjoy these conversations, please subscribe, share the episode and tell me who you’d like to see climb aboard next.";
  return item;
}

export function seedPublishing() {
  return [gregorRelease(),newRelease('struggle-bus-2026-10-14','','2026-10-14'),paulStaffordRelease()];
}
export function releaseBlockers(item) {
  const missing=[];
  if (item.show === 'V Spot PSAs') {
    if (!item.videoLink?.trim()) missing.push('video');
    for (const [key,label] of [['edit','video and sponsor finishing reviewed'],['transcript','captions verified'],['copy','release copy reviewed'],['sponsor','Shopware approval verified']]) if (!item.checks?.[key]) missing.push(label);
    for (const [key,label] of [['linkedinPost','LinkedIn post'],['substackTitle','Substack title'],['substackBody','Substack post']]) if (!item.copy?.[key]?.trim()) missing.push(label);
    if (!item.date) missing.push('release date');
    if (!item.time) missing.push('release time');
    return missing;
  }

  if(!item.videoLink?.trim()) missing.push('final video');
  if(!item.audioLink?.trim()) missing.push('Spotify audio');
  if(!item.transcriptLink?.trim()) missing.push('complete transcript');
  for(const [key,label] of [['edit','edit reviewed'],['transcript','transcript verified'],['chapters','chapters checked against final exports'],['copy','release copy reviewed']]) if(!item.checks?.[key]) missing.push(label);
  for(const [key,label] of COPY_FIELDS) if(!item.copy?.[key]?.trim()) missing.push(label);
  if(!item.date) missing.push('release date');
  if(!item.time) missing.push('release time');
  return missing;
}

export function parseReleaseImport(text) {
  const item=JSON.parse(text);
  if (!item || Array.isArray(item) || typeof item!=='object' || typeof item.id!=='string' || !item.id.trim() || !RELEASE_SCHEDULE.some(row=>row.show===item.show)) throw new Error('Choose a valid Cockpit release pack JSON file.');
  if (typeof item.copy!=='object' || !item.copy || Array.isArray(item.copy)) throw new Error('The release pack needs channel copy.');
  const plain=key=>typeof item[key]==='string'?item[key]:'';
  const safeUrl=value=>{if(!value)return '';try{const url=new URL(value);if(url.protocol==='https:')return url.href;}catch{}throw new Error('Asset links must use HTTPS.');};
  return {...newRelease(item.id),guest:plain('guest'),show:item.show,date:plain('date'),time:plain('time'),notes:plain('notes'),
    videoLink:safeUrl(item.videoLink),audioLink:safeUrl(item.audioLink),transcriptLink:safeUrl(item.transcriptLink),
    copy:Object.fromEntries(COPY_FIELDS.map(([key])=>[key,typeof item.copy[key]==='string'?item.copy[key]:''])),
    checks:Object.fromEntries(['edit','transcript','chapters','copy','sponsor'].map(key=>[key,item.checks?.[key]===true])),
    links:Object.fromEntries(['spotify','youtube','substack','linkedin'].map(key=>[key,safeUrl(item.links?.[key])])),
    outputs:Array.isArray(item.outputs)?item.outputs.map(asset=>({label:String(asset.label||'Asset'),url:safeUrl(asset.url)})):[]};
}
