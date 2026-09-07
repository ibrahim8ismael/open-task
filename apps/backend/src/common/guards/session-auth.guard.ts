import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/auth.decorators";
import { PrismaService } from "../prisma/prisma.service";
import { ApiTokensService } from "../../modules/apitokens/apitokens.service";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly tokens: ApiTokensService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest();

    // Token auth first: X-Api-Token: plane_api_* (scripts/integrations)
    const apiToken = req.headers?.["x-api-token"];
    if (typeof apiToken === "string" && apiToken.startsWith("plane_api_")) {
      const res = await this.tokens.verify(apiToken, {
        path: req.originalUrl ?? req.url,
        method: req.method,
      });
      if (res) {
        const tokenUser = await this.prisma.user.findUnique({ where: { id: res.userId } });
        if (tokenUser?.isActive) {
          req.user = { id: tokenUser.id, email: tokenUser.email, sessionKey: "" };
          req.authVia = "token";
          return true;
        }
      }
      throw new UnauthorizedException({ detail: "Invalid or expired API token." });
    }

    // Session cookie auth (apps/web)
    const sessionKey: string | undefined = req.cookies?.["session-id"];
    if (!sessionKey) throw new UnauthorizedException({ detail: "Authentication required." });
    const session = await this.prisma.session.findUnique({ where: { sessionKey } });
    if (!session || session.expireAt.getTime() <= Date.now()) {
      if (session) await this.prisma.session.delete({ where: { sessionKey } }).catch(() => undefined);
      throw new UnauthorizedException({ detail: "Session expired." });
    }
    let data: { userId?: string } = {};
    try {
      data = JSON.parse(session.sessionData) as { userId?: string };
    } catch {
      throw new UnauthorizedException({ detail: "Invalid session." });
    }
    if (!data.userId) throw new UnauthorizedException({ detail: "Invalid session." });
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException({ detail: "Account inactive." });
    req.user = { id: user.id, email: user.email, sessionKey };
    return true;
  }
}
