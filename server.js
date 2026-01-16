import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";

// استدعاء الراوتات
import researcherRoutes from "./routes/researcher.routes.js";
import projectRoutes from "./routes/project.routes.js";
import publicationRoutes from "./routes/publication.routes.js";
import collaborationRoutes from "./routes/collaboration.routes.js";

// اتصال MongoDB
import mongoose from "mongoose";
import { initNeo4j } from "./services/neo4j.service.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(bodyParser.json());

// Routes
app.use("/researchers", researcherRoutes);
app.use("/projects", projectRoutes);
app.use("/publications", publicationRoutes);
app.use("/collaborations", collaborationRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

// Neo4j connection
initNeo4j();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
