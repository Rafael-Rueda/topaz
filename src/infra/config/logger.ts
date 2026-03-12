import pino from "pino";

import { env } from "./env.js";

export const logger = pino({
    level: env.NODE_ENV === "production" ? "info" : "debug",
    transport:
        env.NODE_ENV !== "production"
            ? {
                  target: "pino-pretty",
                  options: {
                      colorize: true,
                      translateTime: "HH:MM:ss",
                      ignore: "pid,hostname,service",
                      messageFormat: "[{service}] {msg}",
                  },
              }
            : undefined,
    base: {
        service: "topaz",
    },
});

export type Logger = typeof logger;
