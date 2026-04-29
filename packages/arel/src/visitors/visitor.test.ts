import { describe, expect, it } from "vitest";
import { Node } from "../nodes/node.js";
import { Visitor } from "./visitor.js";

class A extends Node {
  accept<T>(_v: { visit(n: Node): T }): T {
    return _v.visit(this);
  }
}
class B extends A {}
class C extends Node {
  accept<T>(_v: { visit(n: Node): T }): T {
    return _v.visit(this);
  }
}

class TestVisitor extends Visitor {
  visited: string[] = [];
  visitA(node: A): string {
    this.visited.push(`A(${node.constructor.name})`);
    return "A";
  }
  static {
    this.dispatchCache().set(A, "visitA");
  }
}

describe("Visitor dispatch", () => {
  it("dispatches to a registered method", () => {
    const v = new TestVisitor();
    expect(v.accept(new A())).toBe("A");
  });

  it("walks the prototype chain to find an ancestor's handler", () => {
    const v = new TestVisitor();
    expect(v.accept(new B())).toBe("A");
    expect(v.visited).toEqual(["A(B)"]);
  });

  it("memoizes ancestor lookups in the cache", () => {
    const v = new TestVisitor();
    v.accept(new B());
    expect(TestVisitor.dispatchCache().get(B)).toBe("visitA");
  });

  it("throws TypeError for nodes with no handler", () => {
    const v = new TestVisitor();
    expect(() => v.accept(new C())).toThrow(/Cannot visit C/);
  });

  it("each subclass has its own cache seeded from the parent", () => {
    class Sub extends TestVisitor {
      visitC(_n: C): string {
        return "C";
      }
      static {
        this.dispatchCache().set(C, "visitC");
      }
    }
    const sub = new Sub();
    expect(sub.accept(new A())).toBe("A");
    expect(sub.accept(new C())).toBe("C");
    expect(TestVisitor.dispatchCache().has(C)).toBe(false);
  });
});
