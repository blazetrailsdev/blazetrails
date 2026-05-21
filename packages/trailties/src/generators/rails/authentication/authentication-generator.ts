// Rails source: railties/lib/rails/generators/rails/authentication/authentication_generator.rb
// Skipped vs Rails: enable_bcrypt, add_migrations, hook_for :test_framework,
// hook_for :template_engine, as: :authentication. See PR body for details.

import { GeneratorBase, type GeneratorOptions } from "../../base.js";

export interface AuthenticationGeneratorOptions extends GeneratorOptions {
  // CLI parity with Rails; no-op until the ERB sub-generator is ported.
  api?: boolean;
}

export class AuthenticationGenerator extends GeneratorBase {
  constructor(options: AuthenticationGeneratorOptions) {
    super(options);
  }

  createAuthenticationFiles(): void {
    for (const [path, content] of Object.entries(TEMPLATES)) {
      this.createFile(path, content);
    }
    if (this.fileExists("app/channels/application_cable")) {
      this.createFile("app/channels/application_cable/connection.rb", CONNECTION_RB);
    }
  }

  configureApplicationController(): void {
    this.injectAfter(
      "app/controllers/application_controller.rb",
      /^class ApplicationController[^\n]*\n/m,
      "  include Authentication\n",
    );
  }

  configureAuthenticationRoutes(): void {
    const routes = "  resources :passwords, param: :token\n  resource :session\n";
    this.insertIntoFile("config/routes.rb", "end\n", routes);
  }

  private injectAfter(file: string, marker: RegExp, content: string): void {
    const fullPath = this.path.join(this.cwd, file);
    if (!this.fs.existsSync(fullPath)) return;
    const existing = this.fs.readFileSync(fullPath, "utf-8");
    const m = existing.match(marker);
    if (!m || m.index === undefined) return;
    const at = m.index + m[0].length;
    this.fs.writeFileSync(fullPath, existing.slice(0, at) + content + existing.slice(at));
    this.output(`      inject  ${file}`);
  }

  run(): string[] {
    this.createAuthenticationFiles();
    this.configureApplicationController();
    this.configureAuthenticationRoutes();
    return this.getCreatedFiles();
  }
}

const TEMPLATES: Record<string, string> = {
  "app/models/user.rb": `class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy

  normalizes :email_address, with: ->(e) { e.strip.downcase }
end
`,
  "app/models/session.rb": `class Session < ApplicationRecord
  belongs_to :user
end
`,
  "app/models/current.rb": `class Current < ActiveSupport::CurrentAttributes
  attribute :session
  delegate :user, to: :session, allow_nil: true
end
`,
  "app/controllers/sessions_controller.rb": `class SessionsController < ApplicationController
  allow_unauthenticated_access only: %i[ new create ]
  rate_limit to: 10, within: 3.minutes, only: :create, with: -> { redirect_to new_session_url, alert: "Try again later." }

  def new
  end

  def create
    if user = User.authenticate_by(params.permit(:email_address, :password))
      start_new_session_for user
      redirect_to after_authentication_url
    else
      redirect_to new_session_path, alert: "Try another email address or password."
    end
  end

  def destroy
    terminate_session
    redirect_to new_session_path
  end
end
`,
  "app/controllers/concerns/authentication.rb": `module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :require_authentication
    helper_method :authenticated?
  end

  class_methods do
    def allow_unauthenticated_access(**options)
      skip_before_action :require_authentication, **options
    end
  end

  private
    def authenticated?
      resume_session
    end

    def require_authentication
      resume_session || request_authentication
    end

    def resume_session
      Current.session ||= find_session_by_cookie
    end

    def find_session_by_cookie
      Session.find_by(id: cookies.signed[:session_id]) if cookies.signed[:session_id]
    end

    def request_authentication
      session[:return_to_after_authenticating] = request.url
      redirect_to new_session_path
    end

    def after_authentication_url
      session.delete(:return_to_after_authenticating) || root_url
    end

    def start_new_session_for(user)
      user.sessions.create!(user_agent: request.user_agent, ip_address: request.remote_ip).tap do |session|
        Current.session = session
        cookies.signed.permanent[:session_id] = { value: session.id, httponly: true, same_site: :lax }
      end
    end

    def terminate_session
      Current.session.destroy
      cookies.delete(:session_id)
    end
end
`,
  "app/controllers/passwords_controller.rb": `class PasswordsController < ApplicationController
  allow_unauthenticated_access
  before_action :set_user_by_token, only: %i[ edit update ]

  def new
  end

  def create
    if user = User.find_by(email_address: params[:email_address])
      PasswordsMailer.reset(user).deliver_later
    end

    redirect_to new_session_path, notice: "Password reset instructions sent (if user with that email address exists)."
  end

  def edit
  end

  def update
    if @user.update(params.permit(:password, :password_confirmation))
      redirect_to new_session_path, notice: "Password has been reset."
    else
      redirect_to edit_password_path(params[:token]), alert: "Passwords did not match."
    end
  end

  private
    def set_user_by_token
      @user = User.find_by_password_reset_token!(params[:token])
    rescue ActiveSupport::MessageVerifier::InvalidSignature
      redirect_to new_password_path, alert: "Password reset link is invalid or has expired."
    end
end
`,
  "app/mailers/passwords_mailer.rb": `class PasswordsMailer < ApplicationMailer
  def reset(user)
    @user = user
    mail subject: "Reset your password", to: user.email_address
  end
end
`,
  "app/views/passwords_mailer/reset.html.erb": `<p>
  You can reset your password within the next 15 minutes on
  <%= link_to "this password reset page", edit_password_url(@user.password_reset_token) %>.
</p>
`,
  "app/views/passwords_mailer/reset.text.erb": `You can reset your password within the next 15 minutes on this password reset page:
<%= edit_password_url(@user.password_reset_token) %>
`,
  "test/mailers/previews/passwords_mailer_preview.rb": `# Preview all emails at http://localhost:3000/rails/mailers/passwords_mailer
class PasswordsMailerPreview < ActionMailer::Preview
  # Preview this email at http://localhost:3000/rails/mailers/passwords_mailer/reset
  def reset
    PasswordsMailer.reset(User.take)
  end
end
`,
};

const CONNECTION_RB = `module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      set_current_user || reject_unauthorized_connection
    end

    private
      def set_current_user
        if session = Session.find_by(id: cookies.signed[:session_id])
          self.current_user = session.user
        end
      end
  end
end
`;
