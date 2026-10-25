import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import { CHANNEL, STATE_KEY, freshState, sanitizeState } from "./shared.js";

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  if (role !== "GM") return;

  const metadata = await OBR.room.getMetadata();
  if (!metadata[STATE_KEY]) {
    await OBR.room.setMetadata({ [STATE_KEY]: freshState() });
  }

  OBR.broadcast.onMessage(CHANNEL, async (event) => {
    const msg = event.data;
    if (!msg || msg.type !== "STATE_PROPOSE") return;
    const next = sanitizeState(msg.state);
    await OBR.room.setMetadata({ [STATE_KEY]: next });
    await OBR.broadcast.sendMessage(CHANNEL, { type: "STATE_COMMIT", state: next }, { destination: "ALL" });
  });
});
