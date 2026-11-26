import React from "react";
import { ArrowUpRight } from "lucide-react";
import { WORKSPACES } from "../lib/workspaces.js";

function OutputLinks({ outputs, onOpen }) {
  return <ul className="workspace-outputs">
    {outputs.map(({ label, value, room }) => (
      <li key={label}>
        <button type="button" onClick={() => onOpen(room)}>
          {value !== undefined && <strong>{value}</strong>}
          <span>{label}</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </li>
    ))}
  </ul>;
}

export function ToolLinks({ ids, rooms, current, onOpen }) {
  return <div className="workspace-tools">
    {ids.map((id) => {
      const tool = rooms.find((room) => room.id === id);
      if (!tool) return null;
      return <button key={id} type="button" aria-current={id === current ? "page" : undefined}
        onClick={() => onOpen(id)}>{tool.name}</button>;
    })}
  </div>;
}

export default function Workspaces({ rooms, outputs, onOpen, selected }) {
  const visible = selected ? WORKSPACES.filter((workspace) => workspace.id === selected) : WORKSPACES;
  return (
    <section className="workspace-board" aria-label="Workspaces">
      {visible.map(({ id, label, tools }) => (
        <section key={id} className="workspace-card" aria-labelledby={`workspace-${id}`}>
          <h2 id={`workspace-${id}`}>{label}</h2>
          {outputs[id].length > 0 && <OutputLinks outputs={outputs[id]} onOpen={onOpen} />}
          <ToolLinks ids={selected ? tools : tools.slice(0, 3)} rooms={rooms} onOpen={onOpen} />
          {!selected && <button className="workspace-all" type="button" onClick={() => onOpen(id)}>
            Open {label}<ArrowUpRight size={14} aria-hidden="true" />
          </button>}
        </section>
      ))}
    </section>
  );
}

export function RelatedTools({ room, rooms, onOpen }) {
  const groups = WORKSPACES.filter(({ tools }) => tools.includes(room));
  if (!groups.length) return null;
  return <nav className="workspace-related" aria-label="Related work">
    {groups.map(({ id, label }) => <button key={id} type="button" onClick={() => onOpen(id)}>{label}</button>)}
    <ToolLinks ids={[...new Set(groups.flatMap(({ tools }) => tools.slice(0, 3)))].filter((id) => id !== room)}
      rooms={rooms} onOpen={onOpen} />
  </nav>;
}
