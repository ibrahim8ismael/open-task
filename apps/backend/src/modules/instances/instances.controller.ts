import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/decorators/auth.decorators";

const flag = (key: string, fallback: string): boolean => (process.env[key] ?? fallback) === "1";

const webUrl = (): string => (process.env.WEB_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

@Public()
@Controller("api/instances")
export class InstancesController {
  @Get()
  getInstance(): Record<string, unknown> {
    const now = new Date().toISOString();
    const webUrl = (process.env.WEB_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    return {
      instance: {
        id: "00000000-0000-0000-0000-000000000000",
        created_at: now,
        updated_at: now,
        instance_name: "Open Task",
        whitelist_emails: undefined,
        instance_id: undefined,
        license_key: undefined,
        current_version: "0.1.0-internal",
        latest_version: undefined,
        last_checked_at: undefined,
        namespace: undefined,
        is_telemetry_enabled: false,
        is_support_required: false,
        is_activated: true,
        is_setup_done: true,
        is_signup_screen_visited: true,
        user_count: undefined,
        is_verified: true,
        created_by: undefined,
        updated_by: undefined,
        workspaces_exist: true,
      },
      config: {
        enable_signup: flag("ENABLE_SIGNUP", "1"),
        is_workspace_creation_disabled: flag("DISABLE_WORKSPACE_CREATION", "0"),
        is_google_enabled: flag("IS_GOOGLE_ENABLED", "0"),
        is_github_enabled: flag("IS_GITHUB_ENABLED", "0"),
        is_gitlab_enabled: flag("IS_GITLAB_ENABLED", "0"),
        is_gitea_enabled: flag("IS_GITEA_ENABLED", "0"),
        is_magic_login_enabled: flag("ENABLE_MAGIC_LINK_LOGIN", "1"),
        is_email_password_enabled: flag("ENABLE_EMAIL_PASSWORD", "1"),
        github_app_name: process.env.GITHUB_APP_NAME ?? "",
        slack_client_id: process.env.SLACK_CLIENT_ID ?? undefined,
        has_unsplash_configured: Boolean(process.env.UNSPLASH_ACCESS_KEY),
        has_llm_configured: Boolean(process.env.LLM_API_KEY),
        file_size_limit: Number(process.env.FILE_SIZE_LIMIT ?? 5242880),
        is_smtp_configured: Boolean(process.env.EMAIL_HOST),
        app_base_url: webUrl,
        space_base_url: process.env.SPACE_BASE_URL ?? webUrl,
        admin_base_url: process.env.ADMIN_BASE_URL ?? webUrl,
        is_self_managed: true,
        instance_changelog_url: process.env.INSTANCE_CHANGELOG_URL ?? "",
      },
    };
  }

  @Get("/")
  getInstanceSlash(): Record<string, unknown> {
    return this.getInstance();
  }
}
