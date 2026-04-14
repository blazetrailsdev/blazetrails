import { describe, expect, it } from "vitest";
import { extractBlocks } from "./check.js";

describe("extractBlocks", () => {
  it("pulls out ts and typescript blocks with correct start lines", () => {
    const md = [
      "# Heading", // 1
      "", // 2
      "```ts", // 3 <- block starts line 4
      "const x = 1;", // 4
      "```", // 5
      "", // 6
      "```typescript", // 7 <- block starts line 8
      "const y = 2;", // 8
      "```", // 9
    ].join("\n");
    const { blocks, untagged } = extractBlocks("a.md", md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].startLine).toBe(4);
    expect(blocks[0].code).toBe("const x = 1;");
    expect(blocks[1].startLine).toBe(8);
    expect(untagged).toHaveLength(0);
  });

  it("skips non-ts languages", () => {
    const md = ["```sh", "ls", "```", "", "```ts", "const x = 1;", "```"].join("\n");
    const { blocks } = extractBlocks("a.md", md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe("const x = 1;");
  });

  it("flags untagged fenced blocks", () => {
    const md = ["```", "const x = 1;", "```"].join("\n");
    const { blocks, untagged } = extractBlocks("a.md", md);
    expect(blocks).toHaveLength(0);
    expect(untagged).toHaveLength(1);
    expect(untagged[0].line).toBe(1);
  });

  it("honors <!-- typecheck:skip --> on the preceding non-blank line", () => {
    const md = ["<!-- typecheck:skip -->", "", "```ts", "const x: string = 5;", "```"].join("\n");
    const { blocks } = extractBlocks("a.md", md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].skip).toBe(true);
  });

  it("does not apply skip marker when separated by non-blank content", () => {
    const md = [
      "<!-- typecheck:skip -->",
      "",
      "some prose",
      "",
      "```ts",
      "const x = 1;",
      "```",
    ].join("\n");
    const { blocks } = extractBlocks("a.md", md);
    expect(blocks[0].skip).toBe(false);
  });

  it("handles adjacent blocks without bleeding state", () => {
    const md = ["```ts", "const x = 1;", "```", "```ts", "const y = 2;", "```"].join("\n");
    const { blocks } = extractBlocks("a.md", md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].code).toBe("const x = 1;");
    expect(blocks[1].code).toBe("const y = 2;");
  });
});
