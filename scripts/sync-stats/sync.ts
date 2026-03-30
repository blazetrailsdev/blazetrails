import Database from "better-sqlite3";
import { execSync } from "child_process";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const REPO = "blazetrailsdev/blazetrails";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "stats.db");

function gh(args: string): string {
  return execSync(`gh ${args}`, { encoding: "utf-8", maxBuffer: 10_000_000 });
}

function ghJson<T>(args: string): T {
  return JSON.parse(gh(args)) as T;
}

function initDb(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS pull_requests (
      number INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      branch TEXT,
      base_branch TEXT,
      body TEXT,
      created_at TEXT NOT NULL,
      merged_at TEXT,
      closed_at TEXT,
      merge_commit_sha TEXT,
      additions INTEGER,
      deletions INTEGER,
      changed_files INTEGER,
      labels TEXT,
      review_count INTEGER,
      comment_count INTEGER,
      commit_count INTEGER,
      time_open_seconds INTEGER
    );

    CREATE TABLE IF NOT EXISTS pr_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_number INTEGER NOT NULL REFERENCES pull_requests(number),
      filename TEXT NOT NULL,
      status TEXT,
      additions INTEGER,
      deletions INTEGER,
      changes INTEGER,
      patch TEXT,
      UNIQUE(pr_number, filename)
    );

    CREATE TABLE IF NOT EXISTS pr_commits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_number INTEGER NOT NULL REFERENCES pull_requests(number),
      sha TEXT NOT NULL,
      message TEXT,
      author TEXT,
      authored_at TEXT,
      UNIQUE(pr_number, sha)
    );

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id INTEGER PRIMARY KEY,
      head_sha TEXT NOT NULL,
      pr_number INTEGER REFERENCES pull_requests(number),
      event TEXT,
      status TEXT,
      conclusion TEXT,
      created_at TEXT,
      updated_at TEXT,
      run_started_at TEXT,
      duration_seconds INTEGER,
      workflow_name TEXT
    );

    CREATE TABLE IF NOT EXISTS workflow_jobs (
      id INTEGER PRIMARY KEY,
      run_id INTEGER NOT NULL REFERENCES workflow_runs(id),
      name TEXT NOT NULL,
      status TEXT,
      conclusion TEXT,
      started_at TEXT,
      completed_at TEXT,
      duration_seconds INTEGER
    );

    CREATE TABLE IF NOT EXISTS test_compare_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merge_commit_sha TEXT NOT NULL,
      pr_number INTEGER REFERENCES pull_requests(number),
      package TEXT NOT NULL,
      matched INTEGER NOT NULL,
      total INTEGER NOT NULL,
      percent REAL NOT NULL,
      skipped INTEGER DEFAULT 0,
      files_mapped INTEGER DEFAULT 0,
      files_total INTEGER DEFAULT 0,
      misplaced INTEGER DEFAULT 0,
      UNIQUE(merge_commit_sha, package)
    );

    CREATE TABLE IF NOT EXISTS api_compare_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merge_commit_sha TEXT NOT NULL,
      pr_number INTEGER REFERENCES pull_requests(number),
      package TEXT NOT NULL,
      matched INTEGER NOT NULL,
      total INTEGER NOT NULL,
      percent REAL NOT NULL,
      misplaced INTEGER DEFAULT 0,
      missing INTEGER DEFAULT 0,
      UNIQUE(merge_commit_sha, package)
    );

    CREATE TABLE IF NOT EXISTS pr_comments (
      id INTEGER PRIMARY KEY,
      pr_number INTEGER NOT NULL REFERENCES pull_requests(number),
      author TEXT,
      body TEXT,
      created_at TEXT,
      updated_at TEXT,
      comment_type TEXT NOT NULL,
      path TEXT,
      diff_hunk TEXT,
      in_reply_to_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS pr_reviews (
      id INTEGER PRIMARY KEY,
      pr_number INTEGER NOT NULL REFERENCES pull_requests(number),
      author TEXT,
      state TEXT,
      body TEXT,
      submitted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      prs_synced INTEGER DEFAULT 0,
      runs_synced INTEGER DEFAULT 0,
      logs_parsed INTEGER DEFAULT 0
    );
  `);
}

interface PrData {
  number: number;
  title: string;
  author: { login: string };
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  mergeCommit: { oid: string } | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: { name: string }[];
  headRefName: string;
  baseRefName: string;
  body: string;
  reviewDecision: string;
}

interface PrFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface WorkflowRun {
  id: number;
  head_sha: string;
  event: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  run_started_at: string;
  name: string;
}

interface WorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string;
}

function getLastSyncedPr(db: Database.Database): number {
  const row = db.prepare("SELECT MAX(number) as max_pr FROM pull_requests").get() as {
    max_pr: number | null;
  };
  return row?.max_pr ?? 0;
}

function syncPullRequests(db: Database.Database): number {
  const lastSynced = getLastSyncedPr(db);
  console.log(`Last synced PR: #${lastSynced}`);

  const fields = [
    "number",
    "title",
    "author",
    "createdAt",
    "mergedAt",
    "closedAt",
    "mergeCommit",
    "additions",
    "deletions",
    "changedFiles",
    "labels",
    "headRefName",
    "baseRefName",
    "body",
    "reviewDecision",
  ].join(",");

  // gh pr list auto-paginates — fetch all at once with a high limit
  const allPrs = ghJson<PrData[]>(
    `pr list --repo ${REPO} --state merged --limit 1000 --json ${fields} --jq '[.[] | select(.number > ${lastSynced})]'`,
  );

  console.log(`Found ${allPrs.length} new merged PRs to sync`);

  const insertPr = db.prepare(`
    INSERT OR REPLACE INTO pull_requests
    (number, title, author, branch, base_branch, body, created_at, merged_at, closed_at,
     merge_commit_sha, additions, deletions, changed_files, labels,
     review_count, comment_count, commit_count, time_open_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const pr of allPrs) {
    const timeOpenMs =
      pr.mergedAt && pr.createdAt
        ? new Date(pr.mergedAt).getTime() - new Date(pr.createdAt).getTime()
        : null;
    const timeOpenSeconds = timeOpenMs ? Math.round(timeOpenMs / 1000) : null;

    insertPr.run(
      pr.number,
      pr.title,
      pr.author.login,
      pr.headRefName,
      pr.baseRefName,
      pr.body,
      pr.createdAt,
      pr.mergedAt,
      pr.closedAt,
      pr.mergeCommit?.oid ?? null,
      pr.additions,
      pr.deletions,
      pr.changedFiles,
      JSON.stringify(pr.labels.map((l) => l.name)),
      -1,
      -1,
      0,
      timeOpenSeconds,
    );
  }

  return allPrs.length;
}

function syncPrFiles(db: Database.Database) {
  const prsWithoutFiles = db
    .prepare(
      `SELECT number FROM pull_requests
       WHERE number NOT IN (SELECT DISTINCT pr_number FROM pr_files)
       ORDER BY number`,
    )
    .all() as { number: number }[];

  if (prsWithoutFiles.length === 0) return;
  console.log(`Fetching file details for ${prsWithoutFiles.length} PRs...`);

  const insertFile = db.prepare(`
    INSERT OR IGNORE INTO pr_files (pr_number, filename, status, additions, deletions, changes, patch)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const { number } of prsWithoutFiles) {
    try {
      const files = ghJson<PrFile[]>(`api repos/${REPO}/pulls/${number}/files --paginate`);
      for (const f of files) {
        insertFile.run(
          number,
          f.filename,
          f.status,
          f.additions,
          f.deletions,
          f.changes,
          f.patch ?? null,
        );
      }
    } catch {
      console.warn(`  Failed to fetch files for PR #${number}`);
    }
  }
}

interface PrCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
}

function syncPrCommits(db: Database.Database) {
  const prsWithoutCommits = db
    .prepare(
      `SELECT number FROM pull_requests
       WHERE number NOT IN (SELECT DISTINCT pr_number FROM pr_commits)
       ORDER BY number`,
    )
    .all() as { number: number }[];

  if (prsWithoutCommits.length === 0) return;
  console.log(`Fetching commits for ${prsWithoutCommits.length} PRs...`);

  const insertCommit = db.prepare(`
    INSERT OR IGNORE INTO pr_commits (pr_number, sha, message, author, authored_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateCount = db.prepare(`UPDATE pull_requests SET commit_count = ? WHERE number = ?`);

  for (const { number } of prsWithoutCommits) {
    try {
      const commits = ghJson<PrCommit[]>(`api repos/${REPO}/pulls/${number}/commits --paginate`);
      for (const c of commits) {
        insertCommit.run(
          number,
          c.sha,
          c.commit.message,
          c.commit.author.name,
          c.commit.author.date,
        );
      }
      updateCount.run(commits.length, number);
    } catch {
      console.warn(`  Failed to fetch commits for PR #${number}`);
    }
  }
}

interface IssueComment {
  id: number;
  user: { login: string } | null;
  body: string;
  created_at: string;
  updated_at: string;
}

interface ReviewComment {
  id: number;
  user: { login: string } | null;
  body: string;
  created_at: string;
  updated_at: string;
  path: string;
  diff_hunk: string;
  in_reply_to_id?: number;
}

interface Review {
  id: number;
  user: { login: string } | null;
  state: string;
  body: string | null;
  submitted_at: string;
}

function syncPrComments(db: Database.Database) {
  const prsWithoutComments = db
    .prepare(
      `SELECT number FROM pull_requests
       WHERE review_count = -1
       ORDER BY number`,
    )
    .all() as { number: number }[];

  if (prsWithoutComments.length === 0) return;
  console.log(`Fetching comments for ${prsWithoutComments.length} PRs...`);

  const insertComment = db.prepare(`
    INSERT OR REPLACE INTO pr_comments
    (id, pr_number, author, body, created_at, updated_at, comment_type, path, diff_hunk, in_reply_to_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertReview = db.prepare(`
    INSERT OR REPLACE INTO pr_reviews (id, pr_number, author, state, body, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const updateCommentCount = db.prepare(
    `UPDATE pull_requests SET comment_count = ? WHERE number = ?`,
  );

  const updateReviewCount = db.prepare(
    `UPDATE pull_requests SET review_count = ? WHERE number = ?`,
  );

  for (const { number } of prsWithoutComments) {
    let totalComments = 0;
    try {
      // Issue comments (general PR comments)
      const issueComments = ghJson<IssueComment[]>(
        `api repos/${REPO}/issues/${number}/comments --paginate`,
      );
      for (const c of issueComments) {
        insertComment.run(
          c.id,
          number,
          c.user?.login ?? null,
          c.body,
          c.created_at,
          c.updated_at,
          "issue",
          null,
          null,
          null,
        );
      }
      totalComments += issueComments.length;

      // Review comments (inline code comments)
      const reviewComments = ghJson<ReviewComment[]>(
        `api repos/${REPO}/pulls/${number}/comments --paginate`,
      );
      for (const c of reviewComments) {
        insertComment.run(
          c.id,
          number,
          c.user?.login ?? null,
          c.body,
          c.created_at,
          c.updated_at,
          "review",
          c.path,
          c.diff_hunk,
          c.in_reply_to_id ?? null,
        );
      }
      totalComments += reviewComments.length;

      // Reviews themselves
      const reviews = ghJson<Review[]>(`api repos/${REPO}/pulls/${number}/reviews --paginate`);
      for (const r of reviews) {
        insertReview.run(r.id, number, r.user?.login ?? null, r.state, r.body, r.submitted_at);
      }

      updateCommentCount.run(totalComments, number);
      updateReviewCount.run(reviews.length, number);
    } catch {
      console.warn(`  Failed to fetch comments for PR #${number}`);
    }
  }
}

function syncWorkflowRuns(db: Database.Database): number {
  // Get merge commit SHAs that don't have workflow runs yet
  const missingRuns = db
    .prepare(
      `SELECT DISTINCT merge_commit_sha, number FROM pull_requests
       WHERE merge_commit_sha IS NOT NULL
       AND merge_commit_sha NOT IN (SELECT head_sha FROM workflow_runs)
       ORDER BY number`,
    )
    .all() as { merge_commit_sha: string; number: number }[];

  if (missingRuns.length === 0) {
    console.log("All workflow runs already synced");
    return 0;
  }

  console.log(`Fetching workflow runs for ${missingRuns.length} merge commits...`);

  const insertRun = db.prepare(`
    INSERT OR REPLACE INTO workflow_runs
    (id, head_sha, pr_number, event, status, conclusion, created_at, updated_at, run_started_at, duration_seconds, workflow_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertJob = db.prepare(`
    INSERT OR REPLACE INTO workflow_jobs
    (id, run_id, name, status, conclusion, started_at, completed_at, duration_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let synced = 0;

  for (const { merge_commit_sha, number } of missingRuns) {
    try {
      const resp = ghJson<{ workflow_runs: WorkflowRun[] }>(
        `api repos/${REPO}/actions/runs?head_sha=${merge_commit_sha}`,
      );

      for (const run of resp.workflow_runs) {
        const duration =
          run.run_started_at && run.updated_at
            ? Math.round(
                (new Date(run.updated_at).getTime() - new Date(run.run_started_at).getTime()) /
                  1000,
              )
            : null;

        insertRun.run(
          run.id,
          run.head_sha,
          number,
          run.event,
          run.status,
          run.conclusion,
          run.created_at,
          run.updated_at,
          run.run_started_at,
          duration,
          run.name,
        );

        // Fetch jobs for this run
        const jobsResp = ghJson<{ jobs: WorkflowJob[] }>(
          `api repos/${REPO}/actions/runs/${run.id}/jobs`,
        );

        for (const job of jobsResp.jobs) {
          const jobDuration =
            job.started_at && job.completed_at
              ? Math.round(
                  (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) /
                    1000,
                )
              : null;

          insertJob.run(
            job.id,
            run.id,
            job.name,
            job.status,
            job.conclusion,
            job.started_at,
            job.completed_at,
            jobDuration,
          );
        }

        synced++;
      }
    } catch {
      console.warn(`  Failed to fetch workflow runs for PR #${number} (${merge_commit_sha})`);
    }
  }

  return synced;
}

function parseTestCompareFromLogs(logs: string): Map<
  string,
  {
    matched: number;
    total: number;
    percent: number;
    skipped: number;
    filesMapped: number;
    filesTotal: number;
    misplaced: number;
  }
> {
  const results = new Map<
    string,
    {
      matched: number;
      total: number;
      percent: number;
      skipped: number;
      filesMapped: number;
      filesTotal: number;
      misplaced: number;
    }
  >();

  // Match lines like: "  arel  —  703/707 tests (99.4%)  |  59/59 files  |  0 misplaced"
  // Or with skipped: "  activerecord  —  5187/8385 tests (61.9%) (2960 skipped)  |  340/342 files  |  0 misplaced"
  const testRegex =
    /\s{2}(\w+)\s+—\s+(\d+)\/(\d+) tests \(([\d.]+)%\)(?:\s+\((\d+) skipped\))?\s+\|\s+(\d+)\/(\d+) files\s+\|\s+(\d+) misplaced/g;

  let match;
  while ((match = testRegex.exec(logs)) !== null) {
    const pkg = match[1];
    // Skip "Overall" — we store per-package only
    if (pkg === "Overall") continue;
    results.set(pkg, {
      matched: parseInt(match[2]),
      total: parseInt(match[3]),
      percent: parseFloat(match[4]),
      skipped: match[5] ? parseInt(match[5]) : 0,
      filesMapped: parseInt(match[6]),
      filesTotal: parseInt(match[7]),
      misplaced: parseInt(match[8]),
    });
  }

  return results;
}

function parseApiCompareFromLogs(logs: string): Map<
  string,
  {
    matched: number;
    total: number;
    percent: number;
    misplaced: number;
    missing: number;
  }
> {
  const results = new Map<
    string,
    {
      matched: number;
      total: number;
      percent: number;
      misplaced: number;
      missing: number;
    }
  >();

  // Match: "  arel  —  148/148 classes/modules (100%)  |  0 misplaced  |  0 missing"
  const apiRegex =
    /\s{2}(\w+)\s+—\s+(\d+)\/(\d+) classes\/modules \(([\d.]+)%\)\s+\|\s+(\d+) misplaced\s+\|\s+(\d+) missing/g;

  let match;
  while ((match = apiRegex.exec(logs)) !== null) {
    const pkg = match[1];
    if (pkg === "Overall") continue;
    results.set(pkg, {
      matched: parseInt(match[2]),
      total: parseInt(match[3]),
      percent: parseFloat(match[4]),
      misplaced: parseInt(match[5]),
      missing: parseInt(match[6]),
    });
  }

  return results;
}

function syncCompareStats(db: Database.Database): number {
  // Find workflow runs for the "Rails API/Test Comparison" job where we don't have stats yet
  const runsToProcess = db
    .prepare(
      `SELECT DISTINCT wr.id as run_id, wr.head_sha, wr.pr_number
       FROM workflow_runs wr
       JOIN workflow_jobs wj ON wj.run_id = wr.id
       WHERE wj.name = 'Rails API/Test Comparison'
       AND wj.conclusion = 'success'
       AND wr.head_sha NOT IN (SELECT DISTINCT merge_commit_sha FROM test_compare_stats)
       ORDER BY wr.pr_number`,
    )
    .all() as { run_id: number; head_sha: string; pr_number: number }[];

  if (runsToProcess.length === 0) {
    console.log("All compare stats already synced");
    return 0;
  }

  console.log(`Parsing CI logs for ${runsToProcess.length} workflow runs...`);

  const insertTestStats = db.prepare(`
    INSERT OR REPLACE INTO test_compare_stats
    (merge_commit_sha, pr_number, package, matched, total, percent, skipped, files_mapped, files_total, misplaced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertApiStats = db.prepare(`
    INSERT OR REPLACE INTO api_compare_stats
    (merge_commit_sha, pr_number, package, matched, total, percent, misplaced, missing)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let parsed = 0;

  for (const { run_id, head_sha, pr_number } of runsToProcess) {
    // Find the Rails comparison job ID
    const job = db
      .prepare(
        `SELECT id FROM workflow_jobs WHERE run_id = ? AND name = 'Rails API/Test Comparison'`,
      )
      .get(run_id) as { id: number } | undefined;

    if (!job) continue;

    try {
      const logs = gh(`api repos/${REPO}/actions/jobs/${job.id}/logs`);

      const testStats = parseTestCompareFromLogs(logs);
      for (const [pkg, stats] of testStats) {
        insertTestStats.run(
          head_sha,
          pr_number,
          pkg,
          stats.matched,
          stats.total,
          stats.percent,
          stats.skipped,
          stats.filesMapped,
          stats.filesTotal,
          stats.misplaced,
        );
      }

      const apiStats = parseApiCompareFromLogs(logs);
      for (const [pkg, stats] of apiStats) {
        insertApiStats.run(
          head_sha,
          pr_number,
          pkg,
          stats.matched,
          stats.total,
          stats.percent,
          stats.misplaced,
          stats.missing,
        );
      }

      if (testStats.size > 0 || apiStats.size > 0) {
        parsed++;
        const totalTests = [...testStats.values()].reduce((sum, s) => sum + s.matched, 0);
        const totalApi = [...apiStats.values()].reduce((sum, s) => sum + s.matched, 0);
        console.log(
          `  PR #${pr_number}: ${testStats.size} test packages (${totalTests} matched), ${apiStats.size} api packages (${totalApi} matched)`,
        );
      }
    } catch {
      console.warn(`  Failed to fetch logs for job ${job.id} (PR #${pr_number})`);
    }
  }

  return parsed;
}

function printSummary(db: Database.Database) {
  const prCount = (
    db.prepare("SELECT COUNT(*) as cnt FROM pull_requests").get() as {
      cnt: number;
    }
  ).cnt;
  const fileCount = (db.prepare("SELECT COUNT(*) as cnt FROM pr_files").get() as { cnt: number })
    .cnt;
  const runCount = (
    db.prepare("SELECT COUNT(*) as cnt FROM workflow_runs").get() as {
      cnt: number;
    }
  ).cnt;
  const testStatCount = (
    db.prepare("SELECT COUNT(DISTINCT merge_commit_sha) as cnt FROM test_compare_stats").get() as {
      cnt: number;
    }
  ).cnt;
  const apiStatCount = (
    db.prepare("SELECT COUNT(DISTINCT merge_commit_sha) as cnt FROM api_compare_stats").get() as {
      cnt: number;
    }
  ).cnt;

  const commentCount = (
    db.prepare("SELECT COUNT(*) as cnt FROM pr_comments").get() as { cnt: number }
  ).cnt;
  const reviewCount = (
    db.prepare("SELECT COUNT(*) as cnt FROM pr_reviews").get() as { cnt: number }
  ).cnt;
  const commitCount = (
    db.prepare("SELECT COUNT(*) as cnt FROM pr_commits").get() as { cnt: number }
  ).cnt;

  console.log("\n=== Database Summary ===");
  console.log(`  PRs: ${prCount}`);
  console.log(`  PR files: ${fileCount}`);
  console.log(`  PR commits: ${commitCount}`);
  console.log(`  PR comments: ${commentCount}`);
  console.log(`  PR reviews: ${reviewCount}`);
  console.log(`  Workflow runs: ${runCount}`);
  console.log(`  Commits with test:compare stats: ${testStatCount}`);
  console.log(`  Commits with api:compare stats: ${apiStatCount}`);
  console.log(`  Database: ${DB_PATH}`);

  // Show latest test:compare stats
  const latest = db
    .prepare(
      `SELECT package, matched, total, percent, skipped
       FROM test_compare_stats
       WHERE merge_commit_sha = (
         SELECT merge_commit_sha FROM test_compare_stats
         ORDER BY pr_number DESC LIMIT 1
       )
       ORDER BY package`,
    )
    .all() as {
    package: string;
    matched: number;
    total: number;
    percent: number;
    skipped: number;
  }[];

  if (latest.length > 0) {
    console.log("\n  Latest test:compare:");
    for (const row of latest) {
      const skipStr = row.skipped > 0 ? ` (${row.skipped} skipped)` : "";
      console.log(`    ${row.package}: ${row.matched}/${row.total} (${row.percent}%)${skipStr}`);
    }
  }
}

async function main() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  initDb(db);

  console.log("=== Syncing PR data ===");
  const prsSynced = syncPullRequests(db);

  console.log("\n=== Syncing PR files ===");
  syncPrFiles(db);

  console.log("\n=== Syncing PR commits ===");
  syncPrCommits(db);

  console.log("\n=== Syncing PR comments & reviews ===");
  syncPrComments(db);

  console.log("\n=== Syncing workflow runs ===");
  const runsSynced = syncWorkflowRuns(db);

  console.log("\n=== Syncing compare stats from CI logs ===");
  const logsParsed = syncCompareStats(db);

  // Log this sync
  db.prepare(`INSERT INTO sync_log (prs_synced, runs_synced, logs_parsed) VALUES (?, ?, ?)`).run(
    prsSynced,
    runsSynced,
    logsParsed,
  );

  printSummary(db);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
