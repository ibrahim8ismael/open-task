import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { compare } from "bcryptjs";
import { CurrentUser, Public, RequestUser } from "../../common/decorators/auth.decorators";
import { issueCsrfToken, verifyCsrfToken } from "../../common/utils/csrf";
import { authErrorRedirect, safeRedirectUrl } from "../../common/utils/redirect";
import { clientIp, throttleCheck, throttleKey } from "../../common/utils/throttle";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AuthService } from "./auth.service";
import {
  ChangePasswordDto,
  EmailCheckDto,
  ForgotPasswordDto,
  MagicGenerateDto,
  ResetPasswordDto,
  SetPasswordDto,
} from "./dto/auth.dto";

interface FormBody {
  email?: string;
  password?: string;
  code?: string;
  next_path?: string;
  csrfmiddlewaretoken?: string;
}

interface IEmailCheckResponseShape {
  existing: boolean;
  status: "MAGIC_CODE" | "CREDENTIAL";
  is_password_autoset: boolean;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private webBase(): string {
    return this.auth.webBase();
  }

  private csrfOk(req: Request): boolean {
    const body = (req.body ?? {}) as FormBody;
    const submitted = body.csrfmiddlewaretoken ?? (req.headers["x-csrftoken"] as string | undefined);
    return verifyCsrfToken(submitted);
  }

  private throttled(req: Request, scope: string): boolean {
    return !throttleCheck(throttleKey(clientIp(req), scope));
  }

  // --- CSRF + checks (public, JSON) ---

  @Public()
  @Get("get-csrf-token")
  getCsrf(@Res({ passthrough: true }) res: Response): { csrf_token: string } {
    const token = issueCsrfToken();
    res.cookie("csrftoken", token, { httpOnly: false, sameSite: "lax", secure: this.auth.cookieSecure(), path: "/" });
    return { csrf_token: token };
  }

  @Public()
  @Post("email-check")
  @HttpCode(200)
  async emailCheck(@Body() dto: EmailCheckDto): Promise<IEmailCheckResponseShape> {
    const email = this.auth.normalizeEmail(dto.email);
    const smtpConfigured = Boolean(process.env.EMAIL_HOST);
    const magicEnabled = (process.env.ENABLE_MAGIC_LINK_LOGIN ?? "1") === "1";
    const magicStatus: "MAGIC_CODE" | "CREDENTIAL" = smtpConfigured && magicEnabled ? "MAGIC_CODE" : "CREDENTIAL";
    if (!this.auth.validEmail(email)) return { existing: false, status: magicStatus, is_password_autoset: true };
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { existing: false, status: magicStatus, is_password_autoset: true };
    const isPasswordAutoset = !user.passwordHash;
    return {
      existing: true,
      status: isPasswordAutoset ? magicStatus : "CREDENTIAL",
      is_password_autoset: isPasswordAutoset,
    };
  }

  // --- email sign-in / sign-up (public, HTML form POST -> 302) ---

  @Public()
  @Post("sign-in")
  async signIn(@Req() req: Request, @Res() res: Response): Promise<void> {
    const body = (req.body ?? {}) as FormBody;
    const nextPath = body.next_path;
    const redirect = (code: string, msg: string, extra?: Record<string, string>): void => {
      res.redirect(authErrorRedirect(this.webBase(), nextPath, code, msg, extra));
    };
    if (this.throttled(req, "sign-in")) return redirect("RATE_LIMITED", "Too many attempts. Try again later.");
    if (!this.csrfOk(req)) return redirect("INVALID_CSRF", "Invalid CSRF token.");
    const email = body.email ? this.auth.normalizeEmail(body.email) : "";
    const password = body.password ?? "";
    if (!email || !password)
      return redirect("REQUIRED_EMAIL_PASSWORD_SIGN_IN", "Email and password are required.", { email });
    if (!this.auth.validEmail(email)) return redirect("INVALID_EMAIL_SIGN_IN", "Invalid email.", { email });
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return redirect("USER_DOES_NOT_EXIST", "User does not exist.", { email });
    if (!user.passwordHash || !(await compare(password, user.passwordHash)))
      return redirect("INVALID_PASSWORD", "Invalid password.", { email });
    const key = await this.auth.createSession(user.id, req);
    this.auth.setSessionCookie(res, key);
    const path = nextPath && nextPath.trim() ? nextPath : await this.auth.redirectionPath(user.id);
    res.redirect(safeRedirectUrl(this.webBase(), path));
  }

  @Public()
  @Post("sign-up")
  async signUp(@Req() req: Request, @Res() res: Response): Promise<void> {
    const body = (req.body ?? {}) as FormBody;
    const nextPath = body.next_path;
    const redirect = (code: string, msg: string, extra?: Record<string, string>): void => {
      res.redirect(authErrorRedirect(this.webBase(), nextPath, code, msg, extra));
    };
    if (this.throttled(req, "sign-up")) return redirect("RATE_LIMITED", "Too many attempts. Try again later.");
    if (!this.csrfOk(req)) return redirect("INVALID_CSRF", "Invalid CSRF token.");
    const email = body.email ? this.auth.normalizeEmail(body.email) : "";
    const password = body.password ?? "";
    if (!email || !password)
      return redirect("REQUIRED_EMAIL_PASSWORD_SIGN_UP", "Email and password are required.", { email });
    if (!this.auth.validEmail(email)) return redirect("INVALID_EMAIL_SIGN_UP", "Invalid email.", { email });
    if (password.length < 8) return redirect("PASSWORD_TOO_SHORT", "Password must be at least 8 characters.", { email });
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return redirect("USER_ALREADY_EXISTS", "User already exists. Please sign in.", { email });
    const created = await this.auth.createUser(email, password);
    const key = await this.auth.createSession(created.id, req);
    this.auth.setSessionCookie(res, key);
    const path = nextPath && nextPath.trim() ? nextPath : await this.auth.redirectionPath(created.id);
    res.redirect(safeRedirectUrl(this.webBase(), path));
  }

  // --- magic codes ---

  @Public()
  @Post("magic-generate")
  @HttpCode(200)
  async magicGenerate(
    @Req() req: Request,
    @Body() dto: MagicGenerateDto,
  ): Promise<{ detail: string; code?: string }> {
    if (this.throttled(req, "magic-generate")) return { detail: "Too many attempts. Try again later." };
    const email = this.auth.normalizeEmail(dto.email);
    if (!this.auth.validEmail(email)) return { detail: "If the email exists, a code was sent." };
    const { code, dev } = await this.auth.issueMagicCode(email);
    // SMTP delivery inside issueMagicCode; dev fallback echoes the code
    void dev;
    return code ? { detail: "Code generated (dev only).", code } : { detail: "If the email exists, a code was sent." };
  }

  private async magicLogin(
    req: Request,
    res: Response,
    isSignup: boolean,
  ): Promise<void> {
    const body = (req.body ?? {}) as FormBody;
    const nextPath = body.next_path;
    const redirect = (code: string, msg: string): void => {
      res.redirect(authErrorRedirect(this.webBase(), nextPath, code, msg, { email: body.email ?? "" }));
    };
    if (this.throttled(req, "magic")) return redirect("RATE_LIMITED", "Too many attempts. Try again later.");
    if (!this.csrfOk(req)) return redirect("INVALID_CSRF", "Invalid CSRF token.");
    const email = body.email ? this.auth.normalizeEmail(body.email) : "";
    const code = (body.code ?? "").trim();
    if (!email || !code) return redirect("REQUIRED_EMAIL_CODE", "Email and code are required.");
    const result = await this.auth.consumeMagicCode(email, code);
    if (result === "expired") return redirect("CODE_EXPIRED", "Code expired. Request a new one.");
    if (result === "invalid") return redirect("INVALID_CODE", "Invalid code.");
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (!isSignup) return redirect("USER_DOES_NOT_EXIST", "User does not exist.");
      const created = await this.auth.createUser(email, randomPassword());
      user = await this.prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    }
    if (!user.isActive) return redirect("USER_INACTIVE", "Account is inactive.");
    const key = await this.auth.createSession(user.id, req);
    this.auth.setSessionCookie(res, key);
    const path = nextPath && nextPath.trim() ? nextPath : await this.auth.redirectionPath(user.id);
    res.redirect(safeRedirectUrl(this.webBase(), path));
  }

  @Public()
  @Post("magic-sign-in")
  async magicSignIn(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.magicLogin(req, res, false);
  }

  @Public()
  @Post("magic-sign-up")
  async magicSignUp(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.magicLogin(req, res, true);
  }

  // --- password management (public JSON + session JSON) ---

  @Public()
  @Post("forgot-password")
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ detail: string; token?: string }> {
    const email = this.auth.normalizeEmail(dto.email);
    const user = this.auth.validEmail(email)
      ? await this.prisma.user.findUnique({ where: { email } })
      : null;
    if (!user) return { detail: "If the email exists, a reset link was sent." };
    const { token, hasEmail } = await this.auth.issueResetToken(user.id);
    // Token echoed only when SMTP could not deliver AND dev mode (testability)
    if (token && this.auth.returnCodesDev()) return { detail: "Reset token generated (dev only).", token };
    return { detail: "If the email exists, a reset link was sent." + (hasEmail ? "" : " (no email on file)") };
  }

  @Public()
  @Post("reset-password/:uid/:token")
  @HttpCode(200)
  async resetPassword(@Param("token") token: string, @Body() dto: ResetPasswordDto): Promise<{ detail: string }> {
    const userId = await this.auth.consumeResetToken(token);
    if (!userId) return { detail: "Invalid or expired reset link." };
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.auth.hashPassword(dto.password) },
    });
    return { detail: "Password has been reset." };
  }

  @Post("set-password")
  @HttpCode(200)
  async setPassword(
    @Req() req: Request,
    @CurrentUser() user: RequestUser,
    @Body() dto: SetPasswordDto,
  ): Promise<{ detail: string }> {
    if (!this.csrfOk(req)) throw new UnauthorizedException({ detail: "Invalid CSRF token." });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.auth.hashPassword(dto.password) },
    });
    return { detail: "Password has been set." };
  }

  @Post("change-password")
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ detail: string }> {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!row.passwordHash || !(await compare(dto.old_password, row.passwordHash)))
      return { detail: "Current password is incorrect." };
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.auth.hashPassword(dto.new_password) },
    });
    return { detail: "Password has been changed." };
  }

  // --- sign out (form POST -> redirect home) ---

  @Public()
  @Post("sign-out")
  async signOut(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.auth.destroySession(req.cookies?.["session-id"], res);
    res.redirect(safeRedirectUrl(this.webBase(), "/"));
  }

  @Public()
  @Get("sign-out")
  async signOutGet(
    @Req() req: Request,
    @Res() res: Response,
    @Query("next_path") nextPath?: string,
  ): Promise<void> {
    await this.auth.destroySession(req.cookies?.["session-id"], res);
    res.redirect(safeRedirectUrl(this.webBase(), nextPath || "/"));
  }

  // --- OAuth stubs (TODO: needs provider client secrets) ---

  @Public()
  @Get("google")
  oauthGoogle(): { detail: string } {
    return { detail: "OAUTH_NOT_CONFIGURED: Google sign-in is not enabled yet." };
  }

  @Public()
  @Get("github")
  oauthGithub(): { detail: string } {
    return { detail: "OAUTH_NOT_CONFIGURED: GitHub sign-in is not enabled yet." };
  }
}

function randomPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let out = "";
  for (let i = 0; i < 24; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
