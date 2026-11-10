import { Router, type IRouter } from "express";
import healthRouter from "./health";
import rankingsRouter from "./rankings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(rankingsRouter);

export default router;
