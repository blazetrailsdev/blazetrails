import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/svelte";

vi.mock("../../tutorials/diagram-renderer.js", () => ({
  renderDiagram: vi.fn(),
}));

import DiagramBlock from "./DiagramBlock.svelte";
import { renderDiagram } from "../../tutorials/diagram-renderer.js";

const mockRenderDiagram = renderDiagram as ReturnType<typeof vi.fn>;

afterEach(() => {
  cleanup();
  mockRenderDiagram.mockReset();
});

describe("DiagramBlock", () => {
  it("shows loading spinner initially", () => {
    mockRenderDiagram.mockReturnValue(new Promise(() => {}));
    render(DiagramBlock, { props: { source: "graph TD; A-->B" } });
    expect(screen.getByTestId("diagram-loading")).toBeTruthy();
  });

  it("renders SVG on success", async () => {
    mockRenderDiagram.mockResolvedValue({
      success: true,
      svg: '<svg data-testid="mermaid-svg">diagram</svg>',
    });
    render(DiagramBlock, { props: { source: "graph TD; A-->B" } });
    await waitFor(() => expect(screen.getByTestId("diagram-svg")).toBeTruthy());
    expect(screen.getByTestId("diagram-svg").innerHTML).toContain("diagram");
  });

  it("shows error on failure", async () => {
    mockRenderDiagram.mockResolvedValue({ success: false, error: "Parse error on line 1" });
    render(DiagramBlock, { props: { source: "bad syntax" } });
    await waitFor(() => expect(screen.getByTestId("diagram-error")).toBeTruthy());
    expect(screen.getByTestId("diagram-error").textContent).toContain("Parse error");
  });

  it("shows source preview in error state", async () => {
    mockRenderDiagram.mockResolvedValue({ success: false, error: "fail" });
    render(DiagramBlock, { props: { source: "graph TD; broken" } });
    await waitFor(() => expect(screen.getByTestId("diagram-error")).toBeTruthy());
    expect(screen.getByTestId("diagram-error").textContent).toContain("graph TD; broken");
  });

  it("passes aria-label and role=img from label prop", async () => {
    mockRenderDiagram.mockResolvedValue({ success: true, svg: "<svg/>" });
    render(DiagramBlock, { props: { source: "graph TD; A-->B", label: "User flow diagram" } });
    await waitFor(() => expect(screen.getByTestId("diagram-block")).toBeTruthy());
    expect(screen.getByTestId("diagram-block").getAttribute("aria-label")).toBe(
      "User flow diagram",
    );
    expect(screen.getByTestId("diagram-block").getAttribute("role")).toBe("img");
  });

  it("omits role when no label", async () => {
    mockRenderDiagram.mockResolvedValue({ success: true, svg: "<svg/>" });
    render(DiagramBlock, { props: { source: "graph TD; A-->B" } });
    await waitFor(() => expect(screen.getByTestId("diagram-block")).toBeTruthy());
    expect(screen.getByTestId("diagram-block").getAttribute("role")).toBeNull();
  });

  it("calls renderDiagram with source", async () => {
    mockRenderDiagram.mockResolvedValue({ success: true, svg: "<svg/>" });
    render(DiagramBlock, { props: { source: "sequenceDiagram\n  A->>B: Hello" } });
    await waitFor(() =>
      expect(mockRenderDiagram).toHaveBeenCalledWith("sequenceDiagram\n  A->>B: Hello"),
    );
  });
});
