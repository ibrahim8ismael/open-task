import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { urlencoded } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: false });
  // Behind Caddy / Docker / LB TLS termination, express must trust the proxy
  // so `req.ip` / secure detection via `x-forwarded-*` works for throttling.
  try {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  } catch {
    // non-express adapters ignore this
  }
  app.use(helmet());
  app.use(cookieParser());
  // HTML form POSTs from apps/web auth screens (sign-in/sign-up/magic)
  app.use(urlencoded({ extended: false }));
  app.enableCors({
    origin: (process.env.WEB_BASE_URL ?? "http://localhost:3000")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  // Note: trailing-slash compat handled per-controller (dual routes), no router hacks
  const port = Number(process.env.PORT ?? 8000);
  await app.listen(port);
}
// eslint-disable-next-line no-console
bootstrap().catch((err) => console.error(err));
