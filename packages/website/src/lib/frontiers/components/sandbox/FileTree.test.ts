import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/svelte";
import FileTree from "./FileTree.svelte";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { SqlJsAdapter } from "../../sql-js-adapter.js";
import { VirtualFS } from "../../virtual-fs.js";

let SQL: SqlJsStatic;
let adapter: SqlJsAdapter;
let vfs: VirtualFS;

beforeAll(async () => {
  SQL = await initSqlJs();
});

beforeEach(() => {
  adapter = new SqlJsAdapter(new SQL.Database());
  vfs = new VirtualFS(adapter);
});

afterEach(() => cleanup());

function seedFiles() {
  vfs.write("src/app/models/user.ts", "class User {}");
  vfs.write("src/app/models/post.ts", "class Post {}");
  vfs.write("src/app/controllers/application-controller.ts", "class AppController {}");
  vfs.write("src/config/routes.ts", "// routes");
  vfs.write("db/migrations/001-create-users.ts", "migration");
  vfs.write("package.json", "{}");
}

describe("FileTree", () => {
  describe("rendering", () => {
    it("renders a tree structure from VFS paths", async () => {
      seedFiles();
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getByTestId("file-tree")).toBeTruthy());

      const dirs = screen.getAllByTestId("tree-dir");
      const files = screen.getAllByTestId("tree-file");
      expect(dirs.length).toBeGreaterThan(0);
      expect(files.length).toBeGreaterThan(0);
    });

    it("shows directories before files, both sorted alphabetically", async () => {
      vfs.write("b.ts", "b");
      vfs.write("a.ts", "a");
      vfs.write("src/z.ts", "z");
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getAllByTestId("tree-dir").length).toBeGreaterThan(0));

      const items = screen
        .getByTestId("file-tree")
        .querySelectorAll("[data-testid='tree-dir'], [data-testid='tree-file']");
      const firstDir = items[0];
      const firstFile = Array.from(items).find(
        (el) => el.getAttribute("data-testid") === "tree-file",
      );
      expect(firstDir?.getAttribute("data-testid")).toBe("tree-dir");
      expect(firstFile).toBeTruthy();
    });

    it("highlights the selected file", async () => {
      vfs.write("test.ts", "content");
      render(FileTree, { props: { vfs, selectedPath: "test.ts" } });
      await waitFor(() => expect(screen.getByTestId("tree-file")).toBeTruthy());
      expect(screen.getByTestId("tree-file").getAttribute("aria-selected")).toBe("true");
    });

    it("shows file header", async () => {
      vfs.write("test.ts", "content");
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getByText("Files")).toBeTruthy());
    });
  });

  describe("collapse/expand", () => {
    it("collapses a directory on click", async () => {
      seedFiles();
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getAllByTestId("tree-dir").length).toBeGreaterThan(0));

      const srcDir = screen
        .getAllByTestId("tree-dir")
        .find((el) => el.getAttribute("data-path") === "src");
      expect(srcDir).toBeTruthy();
      expect(srcDir!.getAttribute("aria-expanded")).toBe("true");

      const button = srcDir!.querySelector("button")!;
      await fireEvent.click(button);
      expect(srcDir!.getAttribute("aria-expanded")).toBe("false");
    });

    it("re-expands a collapsed directory", async () => {
      seedFiles();
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getAllByTestId("tree-dir").length).toBeGreaterThan(0));

      const srcDir = screen
        .getAllByTestId("tree-dir")
        .find((el) => el.getAttribute("data-path") === "src");
      const button = srcDir!.querySelector("button")!;
      await fireEvent.click(button);
      await fireEvent.click(button);
      expect(srcDir!.getAttribute("aria-expanded")).toBe("true");
    });
  });

  describe("file selection", () => {
    it("calls onselect when a file is clicked", async () => {
      vfs.write("test.ts", "content");
      const onselect = vi.fn();
      render(FileTree, { props: { vfs, onselect } });
      await waitFor(() => expect(screen.getByTestId("tree-file")).toBeTruthy());

      const button = screen.getByTestId("tree-file").querySelector("button")!;
      await fireEvent.click(button);
      expect(onselect).toHaveBeenCalledWith("test.ts");
    });
  });

  describe("context menu", () => {
    it("shows context menu on right-click", async () => {
      vfs.write("test.ts", "content");
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getByTestId("tree-file")).toBeTruthy());

      const button = screen.getByTestId("tree-file").querySelector("button")!;
      await fireEvent.contextMenu(button);
      expect(screen.getByTestId("context-menu")).toBeTruthy();
      expect(screen.getByText("Rename")).toBeTruthy();
      expect(screen.getByText("Delete")).toBeTruthy();
    });

    it("does not show context menu in readonly mode", async () => {
      vfs.write("test.ts", "content");
      render(FileTree, { props: { vfs, readonly: true } });
      await waitFor(() => expect(screen.getByTestId("tree-file")).toBeTruthy());

      const button = screen.getByTestId("tree-file").querySelector("button")!;
      await fireEvent.contextMenu(button);
      expect(screen.queryByTestId("context-menu")).toBeNull();
    });
  });

  describe("create file", () => {
    it("creates a new file via header button", async () => {
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getByTestId("new-file-button")).toBeTruthy());

      await fireEvent.click(screen.getByTestId("new-file-button"));
      const input = screen.getByTestId("create-input") as HTMLInputElement;
      input.value = "hello.ts";
      await fireEvent.input(input, { target: { value: "hello.ts" } });
      await fireEvent.keyDown(input, { key: "Enter" });

      expect(vfs.exists("hello.ts")).toBe(true);
    });

    it("cancels create on Escape", async () => {
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getByTestId("new-file-button")).toBeTruthy());

      await fireEvent.click(screen.getByTestId("new-file-button"));
      const input = screen.getByTestId("create-input");
      await fireEvent.keyDown(input, { key: "Escape" });
      expect(screen.queryByTestId("create-input")).toBeNull();
    });
  });

  describe("rename", () => {
    it("shows rename input on context menu Rename", async () => {
      vfs.write("old.ts", "content");
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getByTestId("tree-file")).toBeTruthy());

      const button = screen.getByTestId("tree-file").querySelector("button")!;
      await fireEvent.contextMenu(button);
      await fireEvent.click(screen.getByText("Rename"));

      expect(screen.getByTestId("rename-input")).toBeTruthy();
    });

    it("renames file on Enter", async () => {
      vfs.write("old.ts", "content");
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getByTestId("tree-file")).toBeTruthy());

      const button = screen.getByTestId("tree-file").querySelector("button")!;
      await fireEvent.contextMenu(button);
      await fireEvent.click(screen.getByText("Rename"));

      const input = screen.getByTestId("rename-input") as HTMLInputElement;
      input.value = "new.ts";
      await fireEvent.input(input, { target: { value: "new.ts" } });
      await fireEvent.keyDown(input, { key: "Enter" });

      expect(vfs.exists("new.ts")).toBe(true);
      expect(vfs.exists("old.ts")).toBe(false);
    });
  });

  describe("delete", () => {
    it("shows confirmation dialog before deleting", async () => {
      vfs.write("doomed.ts", "content");
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getByTestId("tree-file")).toBeTruthy());

      const button = screen.getByTestId("tree-file").querySelector("button")!;
      await fireEvent.contextMenu(button);
      await fireEvent.click(screen.getByText("Delete"));

      expect(screen.getByTestId("delete-confirm")).toBeTruthy();
      expect(vfs.exists("doomed.ts")).toBe(true);

      await fireEvent.click(screen.getByTestId("delete-confirm-button"));
      expect(vfs.exists("doomed.ts")).toBe(false);
    });

    it("cancels delete on Cancel button", async () => {
      vfs.write("safe.ts", "content");
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getByTestId("tree-file")).toBeTruthy());

      const button = screen.getByTestId("tree-file").querySelector("button")!;
      await fireEvent.contextMenu(button);
      await fireEvent.click(screen.getByText("Delete"));
      await fireEvent.click(screen.getByTestId("delete-cancel"));

      expect(vfs.exists("safe.ts")).toBe(true);
      expect(screen.queryByTestId("delete-confirm")).toBeNull();
    });

    it("deletes directory and contents after confirmation", async () => {
      vfs.write("dir/a.ts", "a");
      vfs.write("dir/b.ts", "b");
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getAllByTestId("tree-dir").length).toBeGreaterThan(0));

      const dirNode = screen
        .getAllByTestId("tree-dir")
        .find((el) => el.getAttribute("data-path") === "dir");
      const button = dirNode!.querySelector("button")!;
      await fireEvent.contextMenu(button);
      await fireEvent.click(screen.getByText("Delete"));
      await fireEvent.click(screen.getByTestId("delete-confirm-button"));

      expect(vfs.exists("dir/a.ts")).toBe(false);
      expect(vfs.exists("dir/b.ts")).toBe(false);
    });
  });

  describe("auto-refresh", () => {
    it("updates when VFS changes externally", async () => {
      vfs.write("initial.ts", "content");
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getByTestId("tree-file")).toBeTruthy());

      vfs.write("added.ts", "new content");
      await waitFor(() => {
        const files = screen.getAllByTestId("tree-file");
        return expect(files.length).toBe(2);
      });
    });
  });

  describe("readonly mode", () => {
    it("hides new file/folder buttons in readonly mode", async () => {
      vfs.write("test.ts", "content");
      render(FileTree, { props: { vfs, readonly: true } });
      await waitFor(() => expect(screen.getByTestId("file-tree")).toBeTruthy());
      expect(screen.queryByTestId("new-file-button")).toBeNull();
      expect(screen.queryByTestId("new-folder-button")).toBeNull();
    });
  });

  describe("keyboard navigation", () => {
    it("navigates with arrow keys", async () => {
      vfs.write("a.ts", "a");
      vfs.write("b.ts", "b");
      render(FileTree, { props: { vfs } });
      await waitFor(() => expect(screen.getAllByTestId("tree-file").length).toBe(2));

      const tree = screen.getByTestId("file-tree");
      await fireEvent.keyDown(tree, { key: "ArrowDown" });
      await fireEvent.keyDown(tree, { key: "ArrowDown" });
      await fireEvent.keyDown(tree, { key: "Enter" });
    });
  });
});
