import React, { useEffect, useState } from 'react';
import { Card, Big, Mono, Pill, Note, Problem, C } from '../lib/ui.jsx';
import { yearStats } from '../../netlify/functions/_substack.js';

const number = n => typeof n === 'number' ? n.toLocaleString() : 'Unavailable';
async function api(path, method='GET', body) {
  const res = await fetch(path,{method,credentials:'same-origin',headers:body?{'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
  if (res.status === 401) throw new Error('Sign out and sign back into the Cockpit to access private analytics.');
  const data = res.status===202 ? {} : await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load audience stats.');
  return data;
}
export default function AudienceStats() {
  const [state,setState]=useState(null), [error,setError]=useState(''), [busy,setBusy]=useState(false), [token,setToken]=useState(''), [connect,setConnect]=useState(false);
  const [year,setYear]=useState(new Date().getFullYear());
  const load=async()=>{try{setState(await api('/api/substack-stats'));}catch(e){setError(e.message);}};
  useEffect(()=>{load();},[]);
  useEffect(()=>{if(!busy && state?.sync?.state!=='running')return; const id=setInterval(load,3000);return()=>clearInterval(id);},[busy,state?.sync?.state]);
  useEffect(()=>{if(['done','error'].includes(state?.sync?.state))setBusy(false);},[state?.sync?.at,state?.sync?.state]);
  const refresh=async()=>{setError('');setBusy(true);try{await api('/api/substack-sync-background','POST');await load();setTimeout(()=>setBusy(false),15000);}catch(e){setError(e.message);setBusy(false);}};
  const save=async()=>{setError('');try{await api('/api/substack-stats','PUT',{token});setToken('');setConnect(false);await load();await refresh();}catch(e){setError(e.message);}};
  const data=state?.data, summary=data?.summary, selected=yearStats(data?.posts||[],year);
  const download=()=>{
    const columns=['post_id','title','post_date','delivered','opens','open_rate','downloads','signups'];
    const cell=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+@-]/,"'$&")+'"';
    const csv=[columns.join(','),...selected.posts.map(p=>columns.map(k=>cell(p[k])).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download=`substack-posts-${year}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <div>
    <Note>Audience and post performance for sponsor conversations. Figures stay private.</Note>
    <Card style={{margin:'16px 0'}}><label>Import TikTok / YouTube Metricool snapshot <input type="file" accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>20000)throw new Error('Snapshot is too large.');await api('/api/substack-stats','PUT',{social:JSON.parse(await file.text())});setError('');await load();}catch(err){setError(err.message);}e.target.value='';}} /></label></Card>
    {state?.social && <Card style={{margin:'16px 0'}}>
      <Mono>Metricool snapshot · {state.social.asOf} · TikTok and YouTube</Mono>
      <h3>TikTok</h3>
      <p>{number(state.social.tiktok.followers)} followers · {number(state.social.tiktok.videos)} returned videos · {number(state.social.tiktok.videoViewsToDate)} video views to date.</p>
      <p>Median video: {number(state.social.tiktok.medianVideoViews)} views. Largest video: {number(state.social.tiktok.topVideoViews)} views. TikTok country data is unavailable.</p>
      <h3>YouTube</h3>
      <p>{number(state.social.youtube.subscribers)} subscribers · {number(state.social.youtube.reportedViews)} reported views across {state.social.youtube.daysWithViewData} days with data, {state.social.youtube.firstViewDate} to {state.social.youtube.lastViewDate}.</p>
      <p>Reported country shares: {Object.entries(state.social.youtube.reportedCountryShares || {}).map(([country,share])=>`${country} ${(Number(share)*100).toFixed(2)}%`).join(', ')}. These use Metricool’s country follower metric; verify them in YouTube Studio before quoting viewing geography.</p>
      <p>{state.social.caveat}</p>
      <p>This is a dated snapshot. The Substack refresh button below only refreshes Substack.</p>
    </Card>}
    <Card style={{margin:'16px 0'}}>
      <Mono>vinnyobrien.substack.com</Mono><Big s={28}>SUBSTACK STATS</Big>
      <p>{state?.connected?'Connected. Refresh to pull the latest figures.':'Connect your Substack account to retrieve private analytics.'}</p>
      {data && <p>Last successful refresh: {new Date(data.fetchedAt).toLocaleString()}</p>}
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <Pill disabled={!state?.connected||busy||state?.sync?.state==='running'} onClick={refresh}>{busy||state?.sync?.state==='running'?'Refreshing…':'Refresh stats'}</Pill>
        <Pill tone="ghost" onClick={()=>setConnect(!connect)}>{state?.connected?'Reconnect':'Connect Substack'}</Pill>
        {state?.connected && <Pill tone="ghost" onClick={async()=>{if(!window.confirm('Remove the saved Substack connection and cached stats?'))return;try{await api('/api/substack-stats','DELETE');await load();}catch(e){setError(e.message);}}}>Disconnect</Pill>}
      </div>
      {connect && <div style={{marginTop:16}}>
        <p>In your browser, sign into your Substack dashboard. Open Developer Tools → Application/Storage → Cookies, and copy only the value of <code>substack.sid</code>. Paste it here. It is saved in the Cockpit’s private server store and never returned to this page.</p>
        <input aria-label="Substack session cookie" type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} style={{padding:12,width:'100%',boxSizing:'border-box',marginBottom:12}} />
        <Pill disabled={!token.trim()} onClick={save}>Save connection and refresh</Pill>
      </div>}
    </Card>
    {error && <Problem>{error}</Problem>}
    {state?.sync?.state==='error' && <Problem>{state.sync.error} {data?'The previous successful figures remain below.':''}</Problem>}
    {summary && <Card style={{marginBottom:16}}>
      <Mono>Current dashboard snapshot · not annual totals</Mono>
      <p>Subscribers: <strong>{number(summary.subscribers)}</strong> · App subscribers: <strong>{number(summary.appSubscribers)}</strong></p>
      <p>Reported views: <strong>{number(summary.views)}</strong> · Reported open rate: <strong>{number(summary.openRate)}</strong></p>
      <p>The dashboard controls these reporting periods and rate units. Check them against Substack before quoting them to a sponsor. Geographic data is not provided by this connector.</p>
    </Card>}
    {data && <Card>
      <label>Post publication year <input type="number" min="2020" max={new Date().getFullYear()} value={year} onChange={e=>setYear(Number(e.target.value))} style={{padding:8,width:90,marginLeft:12}} /></label>
      <h3>{selected.posts.length} posts published in {year}</h3>
      <p>Email deliveries: <strong>{number(selected.delivered)}</strong> · Opens: <strong>{number(selected.opens)}</strong> · Podcast downloads: <strong>{number(selected.downloads)}</strong></p>
      <p>Weighted opens / deliveries: <strong>{selected.openRate==null?'Unavailable':`${(selected.openRate*100).toFixed(1)}%`}</strong></p>
      <p>These are performance-to-date totals for posts published that year, including engagement after year-end. Deliveries and opens count across multiple emails; they are not unique audience reach. Coverage: {selected.coverage.delivered}/{selected.posts.length} posts have deliveries; {selected.coverage.opens} have both opens and deliveries; {selected.coverage.downloads} have downloads.</p>
      <Pill onClick={download}>Download post figures (CSV)</Pill>
      <div style={{overflowX:'auto',marginTop:16}}><table style={{width:'100%',textAlign:'left',fontSize:13}}><thead><tr>{['Post','Published','Delivered','Opens','Downloads'].map(h=><th key={h} style={{padding:8}}>{h}</th>)}</tr></thead><tbody>{selected.posts.map(p=><tr key={p.post_id}><td style={{padding:8}}>{p.title||p.post_id}</td><td>{p.post_date?.slice(0,10)}</td><td>{number(p.delivered)}</td><td>{number(p.opens)}</td><td>{number(p.downloads)}</td></tr>)}</tbody></table></div>
    </Card>}
  </div>;
}
