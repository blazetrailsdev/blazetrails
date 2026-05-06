import { RuleTester } from "eslint";
import rule from "./sqlite-driver-await.mjs";

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

tester.run("sqlite-driver-await", rule, {
  valid: [
    // awaited call
    { code: "async function f(driver) { await driver.run('SELECT 1'); }" },
    // .then() chain
    { code: "driver.run('SELECT 1').then(r => r);" },
    // .catch() chain
    { code: "driver.run('SELECT 1').catch(e => e);" },
    // .finally() chain
    { code: "driver.run('SELECT 1').finally(() => cleanup());" },
    // property access (no call) — driver.raw, driver.open
    { code: "const db = driver.raw;" },
    { code: "const ok = driver.open;" },
    // this.driver.exec() — member expression object, not identifier; excluded by design
    { code: "this.driver.exec('PRAGMA x');" },
    // deeply nested await
    { code: "async function f(driver) { const r = await driver.exec('PRAGMA'); }" },
  ],
  invalid: [
    // bare identifier call
    {
      code: "driver.run('SELECT 1');",
      errors: [{ messageId: "missingAwait" }],
    },
    // assignment without await
    {
      code: "const r = driver.prepare('SELECT 1');",
      errors: [{ messageId: "missingAwait" }],
    },
    // second call in sequence misses await
    {
      code: "async function f(driver) { await driver.exec('A'); driver.run('B'); }",
      errors: [{ messageId: "missingAwait" }],
    },
    // returned without await
    {
      code: "function f(driver) { return driver.pragma('x'); }",
      errors: [{ messageId: "missingAwait" }],
    },
    // arbitrary chain (not then/catch/finally) is not safe
    {
      code: "driver.run('SELECT 1').rows;",
      errors: [{ messageId: "missingAwait" }],
    },
  ],
});

console.log("sqlite-driver-await: all tests passed");
