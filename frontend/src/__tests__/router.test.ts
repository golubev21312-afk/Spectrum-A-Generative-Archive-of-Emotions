import { describe, it, expect } from "vitest";
import { parseRoute } from "../router";

describe("parseRoute", () => {
  it("empty hash → create", () => {
    expect(parseRoute("")).toEqual({ name: "create" });
  });

  it("#/create", () => {
    expect(parseRoute("#/create")).toEqual({ name: "create" });
  });

  it("#/view", () => {
    expect(parseRoute("#/view")).toEqual({ name: "view" });
  });

  it("#/feed", () => {
    expect(parseRoute("#/feed")).toEqual({ name: "feed" });
  });

  it("#/auth", () => {
    expect(parseRoute("#/auth")).toEqual({ name: "auth" });
  });

  it("#/notifications", () => {
    expect(parseRoute("#/notifications")).toEqual({ name: "notifications" });
  });

  it("#/emotion/42 → { name: emotion, id: 42 }", () => {
    expect(parseRoute("#/emotion/42")).toEqual({ name: "emotion", id: 42 });
  });

  it("#/emotion/0 is invalid → feed", () => {
    expect(parseRoute("#/emotion/0")).toEqual({ name: "feed" });
  });

  it("#/emotion/abc → feed fallback", () => {
    expect(parseRoute("#/emotion/abc")).toEqual({ name: "feed" });
  });

  it("#/profile/alice → { name: profile, username: alice }", () => {
    expect(parseRoute("#/profile/alice")).toEqual({ name: "profile", username: "alice" });
  });

  it("#/profile/ (empty) → feed", () => {
    expect(parseRoute("#/profile/")).toEqual({ name: "feed" });
  });

  it("unknown hash → create", () => {
    expect(parseRoute("#/unknown")).toEqual({ name: "create" });
  });
});
