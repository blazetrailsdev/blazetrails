import { NamedBase, type NamedBaseOptions } from "../../named-base.js";

export interface BenchmarkRunOptions {
  reports?: string[];
}

export class BenchmarkGenerator extends NamedBase {
  constructor(options: NamedBaseOptions) {
    super(options);
  }

  run(options: BenchmarkRunOptions = {}): string[] {
    const reports = options.reports ?? ["before", "after"];
    const ext = this.ext();
    const filename = `script/benchmarks/${this.fileName}${ext}`;
    const reportLines = reports.map((r) => `  x.report("${r}", () => {});`).join("\n");

    this.createFile(
      filename,
      `// Any benchmarking setup goes here...

import { Benchmark } from "benchmark-ips";

Benchmark.ips((x) => {
${reportLines}

  x.compare();
});
`,
    );
    return this.getCreatedFiles();
  }
}
