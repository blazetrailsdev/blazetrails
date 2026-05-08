import { describe } from "vitest";
import mysql from "mysql2/promise";
import { Mysql2Adapter } from "../../connection-adapters/mysql2-adapter.js";

export const MYSQL_TEST_URL =
  process.env.MYSQL_TEST_URL ?? "mysql://root@localhost:3306/rails_js_test";

let mysqlAvailable = false;
let mariaDb = false;

async function checkMysql(): Promise<{ available: boolean; isMariaDb: boolean }> {
  try {
    const conn = await mysql.createConnection({ uri: MYSQL_TEST_URL });
    const [rows] = await conn.query("SELECT VERSION() AS v");
    const ver = (rows as Array<{ v: string }>)[0]?.v ?? "";
    await conn.end();
    return { available: true, isMariaDb: /mariadb/i.test(ver) };
  } catch {
    return { available: false, isMariaDb: false };
  }
}

({ available: mysqlAvailable, isMariaDb: mariaDb } = await checkMysql());

export const describeIfMysql = mysqlAvailable ? describe : (describe.skip as typeof describe);
/** Gates a suite to MySQL only — skips when the server is MariaDB. */
export const describeIfMysqlOnly =
  mysqlAvailable && !mariaDb ? describe : (describe.skip as typeof describe);
export { Mysql2Adapter };
