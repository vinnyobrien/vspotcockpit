import React, { useRef } from "react";

// Lazy on first visit; retained thereafter so async results survive navigation.
export default function RoomSession({ active, children }) {
  const visited = useRef(false);
  if (active) visited.current = true;
  return visited.current ? <section hidden={!active}>{children}</section> : null;
}
