import { describe, expect, it } from "vitest";
import {
  CookieStore,
  SessionId as CookieSessionId,
  DEFAULT_SAME_SITE,
  type CookieStoreRequest,
  type CookieJarLike,
} from "../../middleware/session/cookie-store.js";
import { SessionId as RackSessionId } from "../../middleware/session/abstract-store.js";

class FakeJar {
  store = new Map<string, unknown>();
  signedOrEncrypted: CookieJarLike;
  constructor() {
    const store = this.store;
    this.signedOrEncrypted = new Proxy({} as CookieJarLike, {
      get: (_t, key: string) => store.get(key),
      set: (_t, key: string, value) => {
        store.set(key, value);
        return true;
      },
    });
  }
}

function makeReq(initial: Record<string, unknown> = {}): CookieStoreRequest & {
  headers: Record<string, unknown>;
  jar: FakeJar;
} {
  const headers: Record<string, unknown> = { ...initial };
  const jar = new FakeJar();
  return {
    headers,
    jar,
    cookieJar: jar as unknown as CookieStoreRequest["cookieJar"],
    fetchHeader<T>(key: string, fallback: (key: string) => T) {
      if (Object.prototype.hasOwnProperty.call(headers, key)) return headers[key];
      return fallback(key);
    },
    setHeader(key: string, value: unknown) {
      headers[key] = value;
    },
  };
}

function makeStore(): CookieStore {
  return new CookieStore(() => undefined);
}

describe("ActionDispatch::Session::CookieStore", () => {
  it("defaults cookieOnly and sameSite when constructed without overrides", () => {
    const opts: Record<string, unknown> = {};
    new CookieStore(() => undefined, opts);
    expect(opts.cookieOnly).toBe(true);
    expect(opts.sameSite).toBe(DEFAULT_SAME_SITE);
  });

  it("preserves an explicit sameSite override (including null)", () => {
    const opts: Record<string, unknown> = { sameSite: null };
    new CookieStore(() => undefined, opts);
    expect(opts.sameSite).toBeNull();
  });

  describe("DEFAULT_SAME_SITE", () => {
    it("yields request.cookiesSameSiteProtection", () => {
      expect(DEFAULT_SAME_SITE({ cookiesSameSiteProtection: "Lax" })).toBe("Lax");
    });
  });

  describe("cookieJar", () => {
    it("returns the request's signedOrEncrypted jar", () => {
      const store = makeStore();
      const req = makeReq();
      expect(store.cookieJar(req)).toBe(req.jar.signedOrEncrypted);
    });
  });

  describe("setCookie / getCookie", () => {
    it("writes and reads through the signedOrEncrypted jar under store.key", () => {
      const store = makeStore();
      const req = makeReq();
      store.setCookie(req, null, { session_id: "abc", user: 1 });
      expect(req.jar.store.get(store.key)).toEqual({ session_id: "abc", user: 1 });
      expect(store.getCookie(req)).toEqual({ session_id: "abc", user: 1 });
    });
  });

  describe("unpackedCookieData", () => {
    it("returns the cached header value when present", () => {
      const store = makeStore();
      const req = makeReq({
        "action_dispatch.request.unsigned_session_cookie": { session_id: "cached" },
      });
      expect(store.unpackedCookieData(req)).toEqual({ session_id: "cached" });
    });

    it("falls back to the cookie jar and memoizes onto the header", () => {
      const store = makeStore();
      const req = makeReq();
      req.jar.store.set(store.key, { session_id: "from-jar" });
      expect(store.unpackedCookieData(req)).toEqual({ session_id: "from-jar" });
      expect(req.headers["action_dispatch.request.unsigned_session_cookie"]).toEqual({
        session_id: "from-jar",
      });
    });

    it("memoizes an empty object when no cookie is present", () => {
      const store = makeStore();
      const req = makeReq();
      expect(store.unpackedCookieData(req)).toEqual({});
      expect(req.headers["action_dispatch.request.unsigned_session_cookie"]).toEqual({});
    });
  });

  describe("persistentSessionIdBang", () => {
    it("returns an object containing a generated session_id when input is null", () => {
      const store = makeStore();
      const out = store.persistentSessionIdBang(null);
      expect(typeof out["session_id"]).toBe("string");
      expect((out["session_id"] as string).length).toBe(32);
    });

    it("preserves an existing session_id", () => {
      const store = makeStore();
      const out = store.persistentSessionIdBang({ session_id: "keep-me", user: 1 });
      expect(out["session_id"]).toBe("keep-me");
      expect(out["user"]).toBe(1);
    });

    it("uses the provided sid when no session_id is present", () => {
      const store = makeStore();
      const sid = new RackSessionId("a".repeat(32));
      const out = store.persistentSessionIdBang({}, sid);
      expect(out["session_id"]).toBe(sid.publicId);
    });
  });

  describe("extractSessionId", () => {
    it("returns a SessionId wrapping the cookie's session_id", () => {
      const store = makeStore();
      const req = makeReq();
      req.jar.store.set(store.key, { session_id: "from-jar" });
      const sid = store.extractSessionId(req);
      expect(sid).toBeInstanceOf(RackSessionId);
      expect(sid!.publicId).toBe("from-jar");
    });

    it("returns null when no session_id is present", () => {
      const store = makeStore();
      const req = makeReq();
      expect(store.extractSessionId(req)).toBeNull();
    });
  });

  describe("loadSession", () => {
    it("returns the SessionId and data, generating an id when missing", () => {
      const store = makeStore();
      const req = makeReq();
      const [sid, data] = store.loadSession(req);
      expect(sid).toBeInstanceOf(RackSessionId);
      expect(sid.publicId).toMatch(/^[0-9a-f]{32}$/);
      expect(data["session_id"]).toBe(sid.publicId);
    });

    it("round-trips an existing session", () => {
      const store = makeStore();
      const req = makeReq();
      req.jar.store.set(store.key, { session_id: "abcd", user: 7 });
      const [sid, data] = store.loadSession(req);
      expect(sid.publicId).toBe("abcd");
      expect(data["user"]).toBe(7);
    });
  });

  describe("writeSession", () => {
    it("returns a CookieStore::SessionId carrying the data and assigning session_id", () => {
      const store = makeStore();
      const req = makeReq();
      const sid = new RackSessionId("a".repeat(32));
      const data: Record<string, unknown> = { user: 1 };
      const result = store.writeSession(req, sid, data, {});
      expect(result).toBeInstanceOf(CookieSessionId);
      expect(result.publicId).toBe(sid.publicId);
      expect(result.cookieValue).toBe(data);
      expect(data["session_id"]).toBe(sid.publicId);
    });
  });

  describe("deleteSession", () => {
    it("generates a fresh sid and stamps the unsigned-cookie header", () => {
      const store = makeStore();
      const req = makeReq();
      const result = store.deleteSession(req, null, {});
      expect(result).toBeInstanceOf(RackSessionId);
      expect(req.headers["action_dispatch.request.unsigned_session_cookie"]).toEqual({
        session_id: result!.publicId,
      });
    });

    it("returns null and clears the header when options.drop is true", () => {
      const store = makeStore();
      const req = makeReq();
      const result = store.deleteSession(req, null, { drop: true });
      expect(result).toBeNull();
      expect(req.headers["action_dispatch.request.unsigned_session_cookie"]).toEqual({});
    });
  });
});
