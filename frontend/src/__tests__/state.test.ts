import { describe, it, expect, beforeEach } from "vitest";
import { getAuth, isLoggedIn, getUsername, setAuth, clearAuth, onAuthChange } from "../state";

beforeEach(() => {
  localStorage.clear();
});

describe("isLoggedIn", () => {
  it("returns false when no token", () => {
    expect(isLoggedIn()).toBe(false);
  });

  it("returns true after setAuth", () => {
    setAuth("tok123", "alice");
    expect(isLoggedIn()).toBe(true);
  });

  it("returns false after clearAuth", () => {
    setAuth("tok123", "alice");
    clearAuth();
    expect(isLoggedIn()).toBe(false);
  });
});

describe("getUsername", () => {
  it("returns null when not logged in", () => {
    expect(getUsername()).toBeNull();
  });

  it("returns username after setAuth", () => {
    setAuth("tok", "bob");
    expect(getUsername()).toBe("bob");
  });
});

describe("getAuth", () => {
  it("returns token and username", () => {
    setAuth("mytoken", "charlie");
    expect(getAuth()).toEqual({ token: "mytoken", username: "charlie" });
  });
});

describe("onAuthChange", () => {
  it("calls listener on setAuth", () => {
    let called = 0;
    const unsub = onAuthChange(() => called++);
    setAuth("t", "u");
    expect(called).toBe(1);
    unsub();
  });

  it("calls listener on clearAuth", () => {
    setAuth("t", "u");
    let called = 0;
    const unsub = onAuthChange(() => called++);
    clearAuth();
    expect(called).toBe(1);
    unsub();
  });

  it("does not call listener after unsubscribe", () => {
    let called = 0;
    const unsub = onAuthChange(() => called++);
    unsub();
    setAuth("t", "u");
    expect(called).toBe(0);
  });
});
