import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { randomUUID } from "crypto";

const isProd = process.env.NODE_ENV === "production";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req: any, res: any) => {
          const headerId = req.headers["x-request-id"];
          const existing = req.requestId || headerId;
          const id = existing ?? randomUUID();
          req.requestId = id;
          if (!res.getHeader("x-request-id")) res.setHeader("x-request-id", id);
          return id;
        },

        autoLogging: {
          ignore: (req: any) => req.url === "/metrics",
        },

        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.body.idempotencyKey",
            "req.body.cardNumber",
            "req.body.cvv",
          ],
          censor: "[REDACTED]",
          remove: false,
        },

  
        customLogLevel: (req: any, res: any, err?: any) => {
          if (err) return "error";
          const s = Number(res?.statusCode ?? 0);
          if (s >= 500) return "error";
          if (s >= 400) return "warn";
          return "info";
        },

        customProps: (req: any) => ({ requestId: req.requestId }),

        transport: !isProd
          ? { target: "pino-pretty", options: { singleLine: true } }
          : undefined,
      },
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggerModule {}
