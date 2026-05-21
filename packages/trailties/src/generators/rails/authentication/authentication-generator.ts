import { GeneratorBase, type GeneratorOptions } from "../../base.js";
import {
  ref,
  tsBody,
  tsClass,
  tsMethod,
  tsModule,
  type Method,
  type Ref,
} from "../../../template-builder/index.js";

export interface AuthenticationRunOptions {
  api?: boolean;
  skipMailer?: boolean;
}

const APP_RECORD = ref("ApplicationRecord", "./application-record.js");
const APP_CONTROLLER = ref("ApplicationController", "../application-controller.js");
const APP_MAILER = ref("ApplicationMailer", "./application-mailer.js");
const CURRENT_ATTRS = ref("ActiveSupport.CurrentAttributes");

// Mirrors railties/lib/rails/generators/rails/authentication/authentication_generator.rb.
export class AuthenticationGenerator extends GeneratorBase {
  constructor(options: GeneratorOptions) {
    super(options);
  }

  run(options: AuthenticationRunOptions = {}): string[] {
    const { api = false, skipMailer = false } = options;
    this.createFile(
      "src/app/models/session.ts",
      buildClass("Session", APP_RECORD, [
        stub("associations", "// belongsTo: User", { static: true }),
      ]),
    );
    this.createFile(
      "src/app/models/user.ts",
      buildClass("User", APP_RECORD, [
        stub("associations", "// hasSecurePassword; hasMany sessions, dependent: destroy", {
          static: true,
        }),
        stub("normalizes", "// emailAddress → e.strip().toLowerCase()", { static: true }),
      ]),
    );
    this.createFile(
      "src/app/models/current.ts",
      tsModule({
        imports: [
          { from: "@blazetrails/activesupport", named: { ActiveSupport: "ActiveSupport" } },
        ],
        declarations: [
          tsClass({
            name: "Current",
            extends: CURRENT_ATTRS,
            body: [stub("attributes", "// attribute :session", { static: true })],
          }),
        ],
      }),
    );

    this.createFile(
      "src/app/controllers/sessions-controller.ts",
      buildClass("SessionsController", APP_CONTROLLER, [
        asyncStub("new_", "// allowUnauthenticatedAccess only: [new_, create]"),
        asyncStub("create", "// User.authenticateBy → startNewSessionFor → redirect"),
        asyncStub("destroy", "// terminateSession → redirect to /session/new"),
      ]),
    );
    this.createFile(
      "src/app/controllers/concerns/authentication.ts",
      tsModule({
        declarations: [
          tsClass({
            name: "Authentication",
            body: [
              tsMethod({
                name: "includeInto",
                params: [{ name: "klass", type: "any" }],
                static: true,
                body: tsBody`klass.beforeAction?.("requireAuthentication");\nklass.helperMethod?.("authenticated");`,
              }),
              asyncStub("authenticated", "// resumeSession"),
              asyncStub("requireAuthentication", "// resumeSession || requestAuthentication"),
              asyncStub("resumeSession", "// Current.session ||= findSessionByCookie", {
                visibility: "private",
              }),
              asyncStub("findSessionByCookie", "// Session.findBy(cookies.signed.sessionId)", {
                visibility: "private",
              }),
              asyncStub("startNewSessionFor", "// user.sessions.createBang + cookie", {
                visibility: "private",
                param: "user",
              }),
              asyncStub("terminateSession", "// Current.session.destroy + cookies.delete", {
                visibility: "private",
              }),
            ],
          }),
        ],
      }),
    );
    this.createFile(
      "src/app/controllers/passwords-controller.ts",
      buildClass("PasswordsController", APP_CONTROLLER, [
        asyncStub("new_", "// allowUnauthenticatedAccess"),
        asyncStub("create", "// PasswordsMailer.reset(user).deliverLater"),
        asyncStub("edit", "// setUserByToken"),
        asyncStub("update", "// user.update(password, passwordConfirmation)"),
        asyncStub("setUserByToken", "// User.findByPasswordResetTokenBang", {
          visibility: "private",
        }),
      ]),
    );

    this.createFile(
      "src/app/channels/application-cable/connection.ts",
      tsModule({
        declarations: [
          tsClass({
            name: "Connection",
            body: [
              stub("identifiedBy", "// currentUser", { static: true }),
              asyncStub("connect", "// setCurrentUser || rejectUnauthorizedConnection"),
              asyncStub("setCurrentUser", "// Session.findBy(cookies.signed.sessionId)", {
                visibility: "private",
              }),
            ],
          }),
        ],
      }),
    );

    if (!skipMailer) {
      this.createFile(
        "src/app/mailers/passwords-mailer.ts",
        buildClass("PasswordsMailer", APP_MAILER, [
          asyncStub("reset", '// mail subject: "Reset your password", to: user.emailAddress', {
            param: "user",
          }),
        ]),
      );
      this.createFile(
        "test/mailers/previews/passwords-mailer-preview.ts",
        tsModule({
          declarations: [
            tsClass({
              name: "PasswordsMailerPreview",
              body: [stub("reset", "// TODO: preview PasswordsMailer.reset")],
            }),
          ],
        }),
      );
      if (!api) {
        this.createFile(
          "src/app/views/passwords-mailer/reset.html.tse",
          `<p>\n  You can reset your password within the next 15 minutes on\n  <%= linkTo("this password reset page", editPasswordUrl(user.passwordResetToken)) %>.\n</p>\n`,
        );
        this.createFile(
          "src/app/views/passwords-mailer/reset.text.tse",
          `You can reset your password within the next 15 minutes on this password reset page:\n<%= editPasswordUrl(user.passwordResetToken) %>\n`,
        );
      }
    }

    this.configureApplicationController();
    this.configureAuthenticationRoutes();
    return this.getCreatedFiles();
  }

  private configureApplicationController(): void {
    if (!this.fileExists("src/app/controllers/application-controller.ts")) return;
    this.appendToFile(
      "src/app/controllers/application-controller.ts",
      `\nimport { Authentication } from "./concerns/authentication.js";\nAuthentication.includeInto(ApplicationController);\n`,
    );
  }

  private configureAuthenticationRoutes(): void {
    const routesFile = this.fileExists("src/config/routes.ts")
      ? "src/config/routes.ts"
      : this.fileExists("src/config/routes.js")
        ? "src/config/routes.js"
        : null;
    if (!routesFile) return;
    this.insertIntoFile(
      routesFile,
      "// routes",
      `  router.resources("passwords", { param: "token" });\n  router.resource("session");\n`,
    );
  }
}

function buildClass(name: string, ext: Ref, body: Method[]): string {
  return tsModule({ declarations: [tsClass({ name, extends: ext, body })] });
}

interface StubOpts {
  static?: boolean;
  visibility?: "private" | "protected";
  param?: string;
}

function stub(name: string, comment: string, opts: StubOpts = {}): Method {
  return tsMethod({
    name,
    params: opts.param ? [{ name: opts.param, type: "any" }] : [],
    static: opts.static,
    visibility: opts.visibility,
    body: tsBody`${comment}`,
  });
}

function asyncStub(name: string, comment: string, opts: StubOpts = {}): Method {
  return tsMethod({
    name,
    params: opts.param ? [{ name: opts.param, type: "any" }] : [],
    async: true,
    returnType: "Promise<void>",
    static: opts.static,
    visibility: opts.visibility,
    body: tsBody`${comment}`,
  });
}
