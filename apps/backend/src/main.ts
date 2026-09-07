import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: false });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.WEB_BASE_URL ?? "http://localhost:3000").split(","),
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
