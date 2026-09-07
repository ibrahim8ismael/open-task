import { Body, Controller, Get, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { randomUUID } from "node:crypto";

@Controller("auth")
export class AuthController {
  @Get("get-csrf-token")
  getCsrf(@Res({ passthrough: true }) res: Response): { csrf_token: string } {
    const token = randomUUID();
    res.cookie("csrftoken", token, { httpOnly: false, sameSite: "lax" });
    return { csrf_token: token };
  }

  @Get("get-csrf-token/")
  getCsrfSlash(@Res({ passthrough: true }) res: Response): { csrf_token: string } {
    return this.getCsrf(res);
  }

  @Post("email-check")
  emailCheck(@Body() body: { email?: string }): { exists: boolean } {
    return { exists: false };
  }

  @Post("email-check/")
  emailCheckSlash(@Body() body: { email?: string }): { exists: boolean } {
    return this.emailCheck(body);
  }

  // TODO B0.5: sign-in/sign-up/sign-out, magic, oauth, password flows (docs/04 §4.1)
}
