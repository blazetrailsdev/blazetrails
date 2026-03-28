import { timingSafeEqual } from "crypto";

export class SecurityUtils {
  static fixedLengthSecureCompare(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);

    if (aBuf.length !== bBuf.length) {
      throw new Error("string length mismatch.");
    }

    return timingSafeEqual(aBuf, bBuf);
  }

  static secureCompare(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);

    if (aBuf.length !== bBuf.length) {
      return false;
    }

    return timingSafeEqual(aBuf, bBuf);
  }
}
