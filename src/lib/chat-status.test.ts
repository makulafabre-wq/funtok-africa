import { describe, expect, it } from "vitest";
import { chatStatus, isChatOnline, isChatTyping } from "./chat-status";

describe("chat status", () => {
  const now = new Date("2026-11-07T09:51:00Z").getTime();
  it("shows online only while the presence heartbeat is valid", () => {
    const presence = { lastSeenAt: null, onlineUntil: new Date(now + 75000).toISOString() };
    expect(isChatOnline(presence, now)).toBe(true);
    expect(isChatOnline(presence, now + 75000)).toBe(false);
  });
  it("expires typing after six seconds", () => {
    expect(isChatTyping(new Date(now - 5999).toISOString(), now)).toBe(true);
    expect(isChatTyping(new Date(now - 6000).toISOString(), now)).toBe(false);
    expect(isChatTyping(null, now)).toBe(false);
  });
  it("prioritizes typing over online", () => {
    expect(chatStatus({ lastSeenAt: null, onlineUntil: new Date(now + 75000).toISOString() }, true, now)).toBe("typing…");
  });
  it("does not expose a status when sharing is disabled", () => {
    expect(chatStatus({ lastSeenAt: null, onlineUntil: null }, false, now)).toBe("");
  });
});