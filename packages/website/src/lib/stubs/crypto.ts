const notAvailable = (name: string) => () => {
  throw new Error(`${name} not available in browser`);
};

export const randomBytes = (size: number) => {
  const buf = new Uint8Array(size);
  globalThis.crypto.getRandomValues(buf);
  return {
    toString: () =>
      Array.from(buf)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    buffer: buf.buffer,
    length: size,
    copy: notAvailable("randomBytes.copy"),
  };
};

export const createHash = (_algorithm: string) => {
  let data = "";
  const obj = {
    update(input: string) {
      data += input;
      return obj;
    },
    digest(_encoding?: string) {
      return data.slice(0, 32);
    },
  };
  return obj;
};

export const createHmac = (_alg: string, _key: unknown) => {
  const obj = {
    update(_input: string) {
      return obj;
    },
    digest(_encoding?: string) {
      throw new Error("createHmac not available in browser");
    },
  };
  return obj;
};

export const createCipheriv = notAvailable("createCipheriv");
export const createDecipheriv = notAvailable("createDecipheriv");
export const pbkdf2Sync = notAvailable("pbkdf2Sync");
export const scryptSync = notAvailable("scryptSync");
export const timingSafeEqual = notAvailable("timingSafeEqual");
export const randomUUID = () => globalThis.crypto.randomUUID();
export const generateKeyPairSync = notAvailable("generateKeyPairSync");
export const privateDecrypt = notAvailable("privateDecrypt");
export const publicEncrypt = notAvailable("publicEncrypt");
export const sign = notAvailable("sign");
export const verify = notAvailable("verify");

export default {};
