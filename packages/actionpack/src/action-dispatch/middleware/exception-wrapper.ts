/**
 * ActionDispatch::ExceptionWrapper
 *
 * Wraps exceptions to provide consistent error metadata for error pages.
 */

import { ActionableError, type BacktraceCleaner } from "@blazetrails/activesupport";
import { RoutingError } from "../../action-controller/metal/exceptions.js";

const STATUS_MAP: Record<string, number> = {
  Error: 500,
  TypeError: 500,
  RangeError: 500,
  ReferenceError: 500,
  SyntaxError: 500,
  NotFoundError: 404,
  RoutingError: 404,
  UnknownFormat: 406,
  InvalidAuthenticityToken: 422,
  ParameterMissing: 400,
  ParameterTypeError: 400,
  InvalidParameterError: 400,
  ParamsTooDeepError: 400,
  UnpermittedParameters: 400,
  // ActionDispatch ParseError/ParamError family — Rails' rescue_responses uses
  // the fully-qualified class names that `param-error.ts` and `parameters.ts`
  // assign via `this.name`. All map to 400 Bad Request, matching Rails.
  "ActionDispatch::Http::Parameters::ParseError": 400,
  "ActionDispatch::ParamError": 400,
  "ActionDispatch::ParameterTypeError": 400,
  "ActionDispatch::InvalidParameterError": 400,
  "ActionDispatch::ParamsTooDeepError": 400,
};

/** @internal Rails `rescue_templates` — exception class → diagnostics partial. */
const RESCUE_TEMPLATES: Record<string, string> = {
  MissingTemplate: "missing_template",
  RoutingError: "routing_error",
  ActionNotFound: "unknown_action",
  StatementInvalid: "invalid_statement",
  TemplateError: "template_error",
  MissingExactTemplate: "missing_exact_template",
};

/** @internal Rails `wrapper_exceptions` — classes whose `cause` is the real error. */
const WRAPPER_EXCEPTIONS = new Set<string>(["ActionView::Template::Error", "TemplateError"]);

/** @internal Rails `silent_exceptions` — never log/trace framework frames for these. */
const SILENT_EXCEPTIONS = new Set<string>([
  "RoutingError",
  "ActionDispatch::Http::MimeNegotiation::InvalidType",
]);

/** @internal Stable, monotonic id per exception, mirroring Ruby's `object_id`. */
const EXCEPTION_IDS = new WeakMap<object, number>();
let _nextExceptionId = 1;
function _idFor(err: object): number {
  let id = EXCEPTION_IDS.get(err);
  if (id === undefined) {
    id = _nextExceptionId++;
    EXCEPTION_IDS.set(err, id);
  }
  return id;
}

type TraceEntry = { file: string; line: number };

export class ExceptionWrapper {
  readonly exception: Error;
  readonly backtraceCleaner: BacktraceCleaner | null;
  readonly exceptionClassName: string;
  readonly wrappedCauses: ExceptionWrapper[];
  readonly statusCode: number;
  readonly statusText: string;

  constructor(exception: Error);
  constructor(backtraceCleaner: BacktraceCleaner | null, exception: Error);
  constructor(a: Error | BacktraceCleaner | null, b?: Error) {
    let backtraceCleaner: BacktraceCleaner | null;
    let exception: Error;
    if (b !== undefined) {
      backtraceCleaner = a as BacktraceCleaner | null;
      exception = b;
    } else {
      backtraceCleaner = null;
      exception = a as Error;
    }
    this.backtraceCleaner = backtraceCleaner;
    this.exception = exception;
    this.exceptionClassName = exception.name || exception.constructor?.name || "Error";
    this.wrappedCauses = this.wrappedCausesFor(exception, backtraceCleaner);
    this.statusCode = this.computeStatusCode();
    this.statusText = STATUS_TEXTS[this.statusCode] ?? "Internal Server Error";
  }

  /**
   * Unwraps the inner cause when the exception is a registered wrapper
   * (e.g. ActionView::Template::Error). Falls back to the exception itself.
   * Mirrors Rails' `ExceptionWrapper#unwrapped_exception`.
   */
  get unwrappedException(): Error {
    if (WRAPPER_EXCEPTIONS.has(this.exceptionClassName) && this.exception.cause instanceof Error) {
      return this.exception.cause;
    }
    return this.exception;
  }

  /** The exception class/constructor name. */
  get exceptionName(): string {
    const cause = this.exception.cause;
    if (cause && (cause as Error).constructor) {
      return (cause as Error).constructor.name;
    }
    return this.exceptionClassName;
  }

  /** The exception message. */
  get message(): string {
    return this.exception.message;
  }

  /** Whether the wrapped exception is an ActionController::RoutingError. */
  isRoutingError(): boolean {
    return this.exception instanceof RoutingError || this.exceptionClassName === "RoutingError";
  }

  /**
   * Whether the wrapped exception is an ActionView::Template::Error. The
   * concrete class isn't ported yet, so this falls back to a name check.
   * @internal Blocked on ActionView::Base port — see PR body.
   */
  isTemplateError(): boolean {
    return (
      this.exceptionClassName === "TemplateError" ||
      this.exceptionClassName === "ActionView::Template::Error"
    );
  }

  /** Delegates to ActionView::Template::Error#sub_template_message when available. */
  subTemplateMessage(): string {
    const e = this.exception as { subTemplateMessage?: () => string };
    return typeof e.subTemplateMessage === "function" ? e.subTemplateMessage() : "";
  }

  /** Whether the wrapped exception has a cause (chained error). */
  hasCause(): boolean {
    return this.exception.cause != null;
  }

  /** RoutingError-style `failures` accessor; empty array when not present. */
  failures(): unknown[] {
    const f = (this.exception as { failures?: unknown[] }).failures;
    return Array.isArray(f) ? f : [];
  }

  /** Whether the exception exposes DidYouMean-style corrections. */
  hasCorrections(): boolean {
    const e = this.exception as { originalMessage?: unknown; corrections?: unknown };
    return "originalMessage" in e && "corrections" in e;
  }

  /** The DidYouMean original message; falls back to `message`. */
  originalMessage(): string {
    const e = this.exception as { originalMessage?: string };
    return typeof e.originalMessage === "string" ? e.originalMessage : this.message;
  }

  /** DidYouMean correction suggestions; empty when none. */
  corrections(): string[] {
    const e = this.exception as { corrections?: string[] };
    return Array.isArray(e.corrections) ? e.corrections : [];
  }

  /** SyntaxError-style `file_name` accessor. */
  fileName(): string | null {
    const e = this.exception as { fileName?: string };
    return typeof e.fileName === "string" ? e.fileName : (this.sourceLocation?.file ?? null);
  }

  /** SyntaxError-style `line_number` accessor. */
  lineNumber(): number | null {
    const e = this.exception as { lineNumber?: number };
    return typeof e.lineNumber === "number" ? e.lineNumber : (this.sourceLocation?.line ?? null);
  }

  /** ActionableError actions registered for this exception. */
  actions(): Record<string, () => void> {
    return ActionableError.actions(this.exception);
  }

  /** Annotated source code from the exception, when available. */
  annotatedSourceCode(): string[] {
    const e = this.exception as { annotatedSourceCode?: () => string[] };
    return typeof e.annotatedSourceCode === "function" ? e.annotatedSourceCode() : [];
  }

  /** Diagnostics template name for the exception class. */
  rescueTemplate(): string {
    return RESCUE_TEMPLATES[this.exceptionClassName] ?? "diagnostics";
  }

  /** Get a clean stack trace as an array of lines. */
  get traces(): string[] {
    const stack = this.exception.stack;
    if (!stack) return [];
    return stack
      .split("\n")
      .slice(1)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /** Get the application trace (filter out node_modules). */
  get applicationTrace(): string[] {
    return this.cleanBacktrace("silent");
  }

  /** Get the framework trace (only node_modules lines). */
  get frameworkTrace(): string[] {
    return this.cleanBacktrace("noise");
  }

  /** The full trace (application + framework combined). */
  get fullTrace(): string[] {
    return this.cleanBacktrace("all");
  }

  /**
   * Trace bucket for diagnostics: application trace when present, otherwise
   * framework trace (suppressed entirely for silent exceptions).
   */
  exceptionTrace(): string[] {
    const app = this.applicationTrace;
    if (app.length === 0 && !SILENT_EXCEPTIONS.has(this.exceptionClassName)) {
      return this.frameworkTrace;
    }
    return app;
  }

  /** Which trace bucket the diagnostics page should jump to. */
  traceToShow(): "Application Trace" | "Full Trace" {
    if (this.applicationTrace.length === 0 && this.rescueTemplate() !== "routing_error") {
      return "Full Trace";
    }
    return "Application Trace";
  }

  /** Id of the first trace entry in the active bucket. */
  sourceToShowId(): number {
    return 0;
  }

  /** Get the source file and line number of the exception. */
  get sourceLocation(): TraceEntry | null {
    const firstTrace = this.traces[0];
    if (!firstTrace) return null;
    return this.extractFileAndLineNumber(firstTrace);
  }

  /** Register a custom exception → status code mapping. */
  static registerStatus(exceptionName: string, statusCode: number): void {
    STATUS_MAP[exceptionName] = statusCode;
  }

  /** Get the status code for an exception name. */
  static statusCodeFor(exceptionName: string): number {
    return STATUS_MAP[exceptionName] ?? 500;
  }

  /** Rails-named alias for `statusCodeFor`. */
  static statusCodeForException(exceptionName: string): number {
    return ExceptionWrapper.statusCodeFor(exceptionName);
  }

  /** Whether this exception has a registered rescue response. */
  static rescueResponse(exceptionName: string): boolean {
    return Object.hasOwn(STATUS_MAP, exceptionName) && STATUS_MAP[exceptionName] !== 500;
  }

  /** Whether this exception should be shown based on the show_exceptions mode. */
  show(mode: "all" | "rescuable" | "none"): boolean {
    if (mode === "all") return true;
    if (mode === "none") return false;
    return ExceptionWrapper.rescueResponse(this.exceptionName);
  }

  /** `Object#inspect`-style summary of the wrapped exception. */
  exceptionInspect(): string {
    return `#<${this.exceptionClassName}: ${this.message}>`;
  }

  /** Stable per-exception id, mirroring Ruby's `Object#object_id`. */
  exceptionId(): number {
    return _idFor(this.exception);
  }

  /** Extract file paths and line numbers from the backtrace. */
  get sourceExtracts(): TraceEntry[] {
    return this.backtrace().map((trace) => this.extractSource(trace));
  }

  /** Build a simple error response. */
  toResponse(): [number, Record<string, string>, string] {
    return [
      this.statusCode,
      { "content-type": "text/plain; charset=utf-8" },
      `${this.statusCode} ${this.statusText}\n${this.message}\n`,
    ];
  }

  /** @internal Raw backtrace lines (Rails: `attr_reader :backtrace`). */
  backtrace(): string[] {
    return this.buildBacktrace();
  }

  /**
   * @internal Rails walks the ActionView::PathRegistry to remap template
   * frames; that path-registry is blocked on ActionView, so we return the
   * raw stack lines and let the cleaner handle them.
   */
  buildBacktrace(): string[] {
    return this.traces;
  }

  /** @internal Yields each exception in the cause chain (Rails `causes_for`). */
  *causesFor(exception: Error): Generator<Error> {
    let cur: unknown = exception.cause;
    while (cur instanceof Error) {
      yield cur;
      cur = cur.cause;
    }
  }

  /** @internal Wraps every cause in the chain into its own ExceptionWrapper. */
  wrappedCausesFor(
    exception: Error,
    backtraceCleaner: BacktraceCleaner | null,
  ): ExceptionWrapper[] {
    const out: ExceptionWrapper[] = [];
    for (const cause of this.causesFor(exception)) {
      out.push(new ExceptionWrapper(backtraceCleaner, cause));
    }
    return out;
  }

  /** @internal Filters/silences raw backtrace via the configured cleaner. */
  cleanBacktrace(kind: "silent" | "noise" | "all"): string[] {
    const lines = this.backtrace();
    if (this.backtraceCleaner) return this.backtraceCleaner.clean(lines);
    if (kind === "silent") return lines.filter((l) => !l.includes("node_modules"));
    if (kind === "noise") return lines.filter((l) => l.includes("node_modules"));
    return lines;
  }

  /** @internal Source fragment + line number for a single backtrace line. */
  extractSource(trace: string): TraceEntry {
    const loc = this.extractFileAndLineNumber(trace);
    if (!loc) return { file: trace, line: 0 };
    return loc;
  }

  /**
   * @internal Pick six surrounding lines (line − 3 .. line + 2) keyed by
   * 1-indexed line number — mirrors Rails' `extract_source_fragment_lines`.
   */
  extractSourceFragmentLines(sourceLines: string[], line: number): Record<number, string> {
    const start = Math.max(line - 3, 0);
    const slice = sourceLines.slice(start, start + 6);
    const out: Record<number, string> = {};
    for (let i = 0; i < slice.length; i++) out[start + 1 + i] = slice[i];
    return out;
  }

  /** @internal Reads surrounding source from disk; null when unavailable. */
  sourceFragment(_path: string, _line: number): Record<number, string> | null {
    return null;
  }

  /** @internal Parse a stack frame into `{file, line}`. */
  extractFileAndLineNumber(trace: string): TraceEntry | null {
    const match =
      trace.match(/\((.+):(\d+):\d+\)/) ??
      trace.match(/at\s+(.+):(\d+):\d+/) ??
      trace.match(/(.+):(\d+):\d+/);
    if (!match) return null;
    return { file: match[1], line: parseInt(match[2], 10) };
  }

  private computeStatusCode(): number {
    return STATUS_MAP[this.unwrappedException.name] ?? STATUS_MAP[this.exceptionName] ?? 500;
  }
}

const STATUS_TEXTS: Record<number, string> = {
  100: "Continue",
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
};
