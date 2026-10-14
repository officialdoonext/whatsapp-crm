import { describe, expect, it } from "vitest";
import {
  checkUserAccess,
  buildWhatsAppAdminUrl,
  buildCallAdminUrl,
  ADMIN_CONTACT_PHONE,
} from "./user-status";
import type { User } from "@supabase/supabase-js";

describe("checkUserAccess", () => {
  const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();

  it("blocks unauthenticated callers", () => {
    const res = checkUserAccess(null);
    expect(res.isAllowed).toBe(false);
    expect(res.reason).toBe("unauthenticated");
  });

  it("blocks user when status is inactive", () => {
    const user = { id: "u-1", user_metadata: { status: "inactive", expiry_date: futureDate } } as unknown as User;
    const res = checkUserAccess(user);
    expect(res.isAllowed).toBe(false);
    expect(res.reason).toBe("inactive");
  });

  it("blocks user when profile status is inactive even if user_metadata says active", () => {
    const user = { id: "u-1", user_metadata: { status: "active", expiry_date: futureDate } } as unknown as User;
    const profile = { status: "inactive", expiry_date: futureDate };
    const res = checkUserAccess(user, profile);
    expect(res.isAllowed).toBe(false);
    expect(res.reason).toBe("inactive");
  });

  it("blocks user when expiry date is missing", () => {
    const user = { id: "u-1", user_metadata: { status: "active" } } as unknown as User;
    const res = checkUserAccess(user);
    expect(res.isAllowed).toBe(false);
    expect(res.reason).toBe("no_expiry");
  });

  it("blocks user when expiry date has passed", () => {
    const user = { id: "u-1", user_metadata: { status: "active", expiry_date: pastDate } } as unknown as User;
    const res = checkUserAccess(user);
    expect(res.isAllowed).toBe(false);
    expect(res.reason).toBe("expired");
  });

  it("allows access when status is active and expiry date is in the future", () => {
    const user = { id: "u-1", user_metadata: { status: "active", expiry_date: futureDate } } as unknown as User;
    const res = checkUserAccess(user);
    expect(res.isAllowed).toBe(true);
    expect(res.reason).toBeNull();
  });
});

describe("Admin contact helpers", () => {
  it("builds correct call admin URL", () => {
    expect(buildCallAdminUrl()).toBe(`tel:${ADMIN_CONTACT_PHONE}`);
  });

  it("builds correct WhatsApp admin URL with prefilled text", () => {
    const url = buildWhatsAppAdminUrl("test@example.com");
    expect(url).toContain("8143538314");
    expect(url).toContain("request%20forenable%20CRM%20whats%20app%20automation");
    expect(url).toContain("test%40example.com");
  });
});
