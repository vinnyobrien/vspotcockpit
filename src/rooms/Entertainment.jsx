import React from "react";
import { ExternalLink, Radio, Mic2, CalendarDays } from "lucide-react";
import { C, BODY, Mono, Big, Card, Section } from "../lib/ui.jsx";

const PROGRAMMES = [
  { name: "The V Spot News", cadence: "Sunday · 6pm Ireland", type: "Satirical eCommerce news", action: "publishing" },
  { name: "The Struggle Bus", cadence: "Wednesday", type: "Unfiltered career conversations", action: "shows" },
  { name: "The Ostrich Report", cadence: "Thursday", type: "Marketplaces with Hendrik Laubscher", action: "shows" },
  { name: "V Spot PSAs", cadence: "Friday", type: "Sponsored comedy shorts", action: "publishing" },
];
const LINKS = [
  { label: "V Spot Media website", url: "https://thevspotnews.com/" },
  { label: "YouTube Studio", url: "https://studio.youtube.com/" },
  { label: "LinkedIn", url: "https://www.linkedin.com/" },
  { label: "Substack", url: "https://substack.com/" },
  { label: "Spotify for Creators", url: "https://creators.spotify.com/" },
  { label: "Metricool", url: "https://app.metricool.com/" },
];
export default function Entertainment({ onNavigate }) {
  return <div>
    <div style={{ borderRadius: 20, padding: "24px 22px", background: "#1A1F3C", color: "#F3F1EC", marginBottom: 20, borderBottom: "5px solid #E8272A" }}>
      <div style={{ display:"flex", alignItems:"center", gap: 16, flexWrap:"wrap" }}>
        <img src="/cockpit-mark.svg" width="66" height="66" alt="V Spot Cockpit mark" style={{ objectFit:"contain" }} />
        <div><Mono c="#D2B48C" s={10}>V SPOT MEDIA · ON AIR</Mono>
          <div style={{ fontSize: 31, fontWeight: 800, letterSpacing: ".03em", lineHeight: 1.05 }}>THE ENTERTAINMENT DESK</div>
          <div style={{ fontFamily: BODY, fontSize: 13, color:"#D2B48C", marginTop: 8 }}>All the shows. All the channels. One control room.</div>
        </div>
      </div>
    </div>
    <Section label="Tonight's programming">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:12 }}>
        {PROGRAMMES.map((p,i)=><Card key={p.name} pad={18} style={{borderTop: "4px solid " + (i%2 ? "#D2B48C" : "#E8272A")}}>
          <Mono s={9}>{p.cadence}</Mono>
          <div style={{fontSize:19,fontWeight:750,margin:"9px 0 5px",color:C.ink}}>{p.name}</div>
          <div style={{fontSize:12.5,color:C.ink2,minHeight:38}}>{p.type}</div>
          <button onClick={()=>onNavigate(p.action)} style={{cursor:"pointer",border:0,borderRadius:9,background:"#1A1F3C",color:"#fff",padding:"9px 12px",fontFamily:BODY,fontSize:12,marginTop:10}}>Open {p.action === "shows" ? "episodes" : "publishing"}</button>
        </Card>)}
      </div>
    </Section>
    <Section label="Social & distribution links">
      <Card pad={18}>
        <p style={{fontSize:12.5,color:C.ink2,margin:"0 0 12px"}}>Direct website link and platform workspaces. Profile-specific links can replace the platform homepages once verified; no handles are assumed.</p>
        <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
          {LINKS.map(l=><a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"10px 13px",border:"1px solid rgba(20,24,51,.15)",borderRadius:11,color:C.ink,fontSize:12.5,textDecoration:"none",fontFamily:BODY}}>{l.label}<ExternalLink size={13}/></a>)}
        </div>
      </Card>
    </Section>
    <Section label="Production shortcuts">
      <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
        {[["Publishing","publishing",Radio],["Guests & backstage passes","guests",Mic2],["Content calendar","calendar",CalendarDays]].map(([label,room,Icon])=><button key={room} onClick={()=>onNavigate(room)} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"12px 14px",borderRadius:11,border:"1px solid rgba(20,24,51,.15)",background:"#fff",cursor:"pointer",fontFamily:BODY,color:C.ink}}><Icon size={16}/>{label}</button>)}
      </div>
    </Section>
  </div>;
}
