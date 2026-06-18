import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { quoteRouter } from "./routes/quote.routes";
import { errorMiddleware, notFoundMiddleware } from "./middlewares/error.middleware";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "OK" });
});

app.use("/api", quoteRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
