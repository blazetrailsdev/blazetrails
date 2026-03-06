// Shared types for test comparison pipeline

// --- Extracted test manifest ---

export interface TestCaseInfo {
  /** Hierarchical path: "Describe > Nested > test name" */
  path: string;
  /** The test description text */
  description: string;
  /** Ancestor describe blocks from outermost to innermost */
  ancestors: string[];
  /** Source file */
  file: string;
  /** Line number in source */
  line: number;
  /** Test definition style */
  style: "it" | "test" | "def_test" | "describe";
  /** Assertion method names used in the test body */
  assertions: string[];
  /** Whether the test is pending/skipped */
  pending?: boolean;
}

export interface TestFileInfo {
  /** Relative file path */
  file: string;
  /** Top-level class or describe block name */
  className: string;
  /** Individual test cases */
  testCases: TestCaseInfo[];
  /** Total test count */
  testCount: number;
}

export interface TestPackageInfo {
  files: TestFileInfo[];
  totalTests: number;
}

export interface TestManifest {
  source: "ruby" | "typescript";
  generatedAt: string;
  packages: Record<string, TestPackageInfo>;
}

// --- Comparison results ---

export type TestStatus = "matched" | "missing" | "extra";

export interface TestComparison {
  rubyPath: string;
  tsPath: string | null;
  status: TestStatus;
  matchConfidence: "exact" | "normalized" | "fuzzy" | "override" | "none";
  rubyFile?: string;
  tsFile?: string;
  notes?: string;
}

export interface FileComparison {
  rubyFile: string;
  tsFile: string | null;
  tsDescribeBlock: string | null;
  matched: number;
  missing: number;
  extra: number;
  tests: TestComparison[];
}

export interface PackageComparison {
  package: string;
  files: FileComparison[];
  matched: number;
  missing: number;
  extra: number;
  coveragePercent: number;
}

export interface TestComparisonResult {
  generatedAt: string;
  railsVersion: string;
  summary: {
    totalRubyTests: number;
    matched: number;
    missing: number;
    extra: number;
    coveragePercent: number;
  };
  packages: Record<string, PackageComparison>;
}
