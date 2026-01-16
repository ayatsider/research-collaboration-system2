import express from "express";
import { createResearcher, getResearchers } from "../controllers/researcher.controller.js";

const router = express.Router();

router.post("/", createResearcher);
router.get("/", getResearchers);

export default router;
