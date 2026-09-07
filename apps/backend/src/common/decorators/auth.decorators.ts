import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export interface RequestUser {
  id: string;
  email: string | null;
  sessionKey: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as RequestUser;
  },
);

export const ROLES_KEY = "roles";
export const Roles = (...roles: Array<"ADMIN" | "MEMBER" | "GUEST">): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

export const LEVEL_KEY = "level";
export const Level = (level: "WORKSPACE" | "PROJECT" | "NONE"): MethodDecorator & ClassDecorator =>
  SetMetadata(LEVEL_KEY, level);
