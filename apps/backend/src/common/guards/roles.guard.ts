import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { LEVEL_KEY, ROLES_KEY } from "../decorators/auth.decorators";
import { PrismaService } from "../prisma/prisma.service";

const RANK: Record<string, number> = { GUEST: 5, MEMBER: 15, ADMIN: 20 };

function minRank(roles: string[] | undefined): number {
  if (!roles || roles.length === 0) return RANK.MEMBER;
  return Math.min(...roles.map((r) => RANK[r] ?? RANK.MEMBER));
}

/**
 * Role guard (docs/03 §3.5). Levels:
 * - WORKSPACE: needs active WorkspaceMember (slug from params/body/query); workspace ADMIN bypasses.
 * - PROJECT: needs active ProjectMember (projectId from params); workspace ADMIN bypasses.
 * No @Roles/@Level metadata -> any authenticated user passes.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    const level = this.reflector.getAllAndOverride<string>(LEVEL_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles && !level) return true;
    // NONE: authenticated, no workspace/project membership required (e.g. invite join)
    if (level === "NONE") return true;
    const req = ctx.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.id;
    if (!userId) return false;
    const need = minRank(roles);

    const slug: string | undefined = req.params?.slug ?? req.body?.slug ?? req.query?.slug;
    if (slug) {
      const ws = await this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } });
      if (!ws) throw new ForbiddenException({ detail: "Workspace not found." });
      const wm = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId: ws.id, memberId: userId, isActive: true, deletedAt: null },
      });
      if (!wm) throw new ForbiddenException({ detail: "Not a workspace member." });
      if (wm.role === "ADMIN") return true;
      if ((RANK[wm.role] ?? 0) < need) throw new ForbiddenException({ detail: "Insufficient role." });
      req.workspace = ws;
      if (!level || level === "WORKSPACE") return true;
      // PROJECT level continues below
    }

    if (level === "PROJECT") {
      const projectId: string | undefined = req.params?.projectId ?? req.params?.pid ?? req.body?.projectId;
      if (!projectId) throw new ForbiddenException({ detail: "Project scope required." });
      const pm = await this.prisma.projectMember.findFirst({
        where: { projectId, memberId: userId, isActive: true, deletedAt: null },
      });
      if (!pm) throw new ForbiddenException({ detail: "Not a project member." });
      if ((RANK[pm.role] ?? 0) < need) throw new ForbiddenException({ detail: "Insufficient role." });
      return true;
    }
    return true;
  }
}
