const notAvailable = (name: string) => () => {
  throw new Error(`${name} not available in browser`);
};

// fs
export const readFileSync = notAvailable("readFileSync");
export const writeFileSync = notAvailable("writeFileSync");
export const existsSync = () => false;
export const mkdirSync = notAvailable("mkdirSync");
export const unlinkSync = notAvailable("unlinkSync");
export const readdirSync = () => [];
export const statSync = notAvailable("statSync");
export const rmdirSync = notAvailable("rmdirSync");
export const accessSync = notAvailable("accessSync");
export const createReadStream = notAvailable("createReadStream");
export const createWriteStream = notAvailable("createWriteStream");
export const promises = {};

// path
export const resolve = (...args: string[]) => args.join("/");
export const join = (...args: string[]) => args.join("/");
export const dirname = (p: string) => p;
export const basename = (p: string) => p;
export const extname = (_p: string) => "";
export const relative = (from: string, to: string) => to;
export const isAbsolute = () => false;
export const sep = "/";
export const normalize = (p: string) => p;

// url
export const pathToFileURL = (p: string) => new URL(`file://${p}`);
export const fileURLToPath = (u: string | URL) => String(u);
export const URL = globalThis.URL;

// pg / mysql2 / better-sqlite3
export class Pool {
  query() {
    throw new Error("pg not available in browser");
  }
}
export class Client extends Pool {}

export default {};
