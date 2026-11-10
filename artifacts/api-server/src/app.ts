import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const onError: ErrorRequestHandler = (error, req, res, _next) => {
  req.log.error({ err: error }, 'Request failed');
  const badJson = error instanceof SyntaxError && 'body' in error;
  res.status(badJson ? 400 : 500).json({
    error: badJson ? 'Request must contain valid JSON.' : 'The service is unavailable. Please try again.',
  });
};
app.use(onError);

export default app;
