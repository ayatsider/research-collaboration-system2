import mongoose from "mongoose";
import dotenv from "dotenv";
import readline from "readline";
import neo4j from "neo4j-driver";
import { createClient } from "redis";

import Researcher from "./models/researcher.model.js";
import Project from "./models/project.model.js";
import Publication from "./models/publication.model.js";

dotenv.config();

/* ================= MongoDB ================= */
await mongoose.connect(process.env.MONGO_URI);
console.log("MongoDB connected ✅");

/* ================= Neo4j ================= */
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);
const neoSession = driver.session({ database: process.env.NEO4J_DATABASE });
console.log("Neo4j connected ✅");

/* ================= Redis ================= */
const redis = createClient({ url: process.env.REDIS_URL });
redis.on("error", (err) => console.error("Redis Error ❌", err));
await redis.connect();
console.log("Redis connected ✅");

/* ================= CLI ================= */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q) => new Promise((res) => rl.question(q, res));

/* ================= Main Menu ================= */
async function mainMenu() {
  while (true) {
    console.log(`
===== Research Collaboration CLI =====
1. Add Researcher
2. Add Project
3. Add Publication
4. Show Researchers
5. Show Projects
6. Show Collaborations (Neo4j)
7. Show Researcher Profile (Redis Cache)
0. Exit
`);
    const choice = await ask("Choose: ");
    switch (choice) {
      case "1": await addResearcher(); break;
      case "2": await addProject(); break;
      case "3": await addPublication(); break;
      case "4": await showResearchers(); break;
      case "5": await showProjects(); break;
      case "6": await showCollaborations(); break;
      case "7": await showResearcherProfile(); break;
      case "0": await shutdown(); return;
      default: console.log("Invalid choice ❌");
    }
  }
}

/* ================= Functions ================= */
async function addResearcher() {
  const name = await ask("Name: ");
  const department = await ask("Department: ");
  const interests = await ask("Interests (comma): ");

  const r = await Researcher.create({
    name,
    department,
    interests: interests.split(",").map((i) => i.trim()),
  });

  await neoSession.run(
    "MERGE (:Researcher {name:$name, department:$department})",
    { name, department }
  );

  console.log("Researcher added ✅");
}

async function addProject() {
  const title = await ask("Project title: ");
  const description = await ask("Description: ");

  const researchers = await Researcher.find();
  if (!researchers.length) { console.log("No researchers found."); return; }

  researchers.forEach((r, i) => console.log(`${i + 1}. ${r.name}`));
  const sel = await ask("Participants (numbers, comma or empty): ");
  const participants = sel
    ? sel.split(",").map((n) => researchers[n - 1]?._id).filter(Boolean)
    : [];

  const project = await Project.create({ title, description, participants });

  for (const id of participants) {
    const r = await Researcher.findById(id);
    const rel = await ask(`Relation with ${r.name} (co-authorship / supervision / teamwork): `);
    await neoSession.run(
      `
      MATCH (r:Researcher {name:$name})
      MERGE (p:Project {title:$title})
      MERGE (r)-[:${rel.toUpperCase().replace("-", "_")}]->(p)
      `,
      { name: r.name, title }
    );
    await redis.del(`profile:${r._id}`); // invalidate cache
  }

  const addPubs = await ask("Add publications for this project? (y/n): ");
  if (addPubs.toLowerCase() === "y") {
    const num = Number(await ask("How many? "));
    for (let i = 0; i < num; i++) {
      const pubTitle = await ask(`Publication ${i + 1} Title: `);
      const pubYear = Number(await ask("Year: "));
      const pub = await Publication.create({ title: pubTitle, year: pubYear, authors: participants });
      project.publications.push(pub._id);

      for (const rId of participants) {
        const r = await Researcher.findById(rId);
        await neoSession.run(
          `
          MATCH (r:Researcher {name:$name})
          MERGE (pub:Publication {title:$pubTitle, year:$pubYear})
          MERGE (r)-[:AUTHOR_OF]->(pub)
          `,
          { name: r.name, pubTitle, pubYear }
        );
        await redis.del(`profile:${r._id}`);
      }
    }
    await project.save();
  }

  console.log("Project added ✅");
}

async function addPublication() {
  const title = await ask("Publication title: ");
  const year = Number(await ask("Year: "));
  const researchers = await Researcher.find();
  researchers.forEach((r, i) => console.log(`${i + 1}. ${r.name}`));
  const sel = await ask("Authors (numbers, comma): ");
  const authors = sel.split(",").map((n) => researchers[n - 1]?._id).filter(Boolean);

  const pub = await Publication.create({ title, year, authors });

  for (const id of authors) {
    const r = await Researcher.findById(id);
    await neoSession.run(
      `
      MATCH (r:Researcher {name:$name})
      MERGE (p:Publication {title:$title, year:$year})
      MERGE (r)-[:AUTHOR_OF]->(p)
      `,
      { name: r.name, title, year }
    );
    await redis.del(`profile:${r._id}`); // invalidate cache
  }

  console.log("Publication added ✅");
}

async function showResearchers() {
  const data = await Researcher.find();
  data.forEach((r) => console.log(`${r.name} | ${r.department}`));
}

async function showProjects() {
  const data = await Project.find().populate("participants").populate("publications");
  data.forEach((p) => {
    console.log(`\n${p.title} | ${p.description}`);
    console.log("Participants:", p.participants.map((r) => r.name).join(", "));
    if (p.publications.length) console.log("Publications:", p.publications.map((pub) => pub.title).join(", "));
  });
}

async function showCollaborations() {
  const res = await neoSession.run(
    `
    MATCH (r:Researcher)
    OPTIONAL MATCH (r)-[rel]->(n)
    RETURN r.name AS researcher, type(rel) AS relation, n.title AS target
    LIMIT 50
    `
  );
  res.records.forEach((r) =>
    console.log(`${r.get("researcher")} -[${r.get("relation")}]-> ${r.get("target")}`)
  );
}

/* ===== Redis Cached Profile (Final) ===== */
async function showResearcherProfile() {
  const researchers = await Researcher.find();
  researchers.forEach((r, i) => console.log(`${i + 1}. ${r.name}`));
  const sel = await ask("Choose researcher: ");
  const r = researchers[sel - 1];
  if (!r) return;

  const key = `profile:${r._id}`;

  // محاولة جلب من Redis
  console.time("FETCH_REDIS");
  const cached = await redis.get(key);
  if (cached) {
    console.log("⚡ From Redis");
    console.timeEnd("FETCH_REDIS");
    console.log(JSON.parse(cached));
    return;
  }
  console.timeEnd("FETCH_REDIS");

  // جلب البيانات من MongoDB و Neo4j
  console.time("FETCH_DB");

  // الببليكيشنات
  const publications = await Publication.find({ authors: r._id }).lean();

  // المشاريع
  const projects = await Project.find({ participants: r._id })
    .populate("publications")
    .lean();

  // التعاونات من Neo4j
  const neo = await neoSession.run(
    "MATCH (res:Researcher {name:$name})-[rel]->(n) RETURN type(rel) AS relation, n.title AS target",
    { name: r.name }
  );

  console.timeEnd("FETCH_DB");

  const profile = {
    _id: r._id,
    name: r.name,
    department: r.department,
    interests: r.interests,
    projects: projects.map(p => ({
      title: p.title,
      description: p.description,
      publications: p.publications.map(pub => ({ title: pub.title, year: pub.year }))
    })),
    publications: publications.map(p => ({ title: p.title, year: p.year })),
    collaborations: neo.records.map(x => ({ relation: x.get("relation"), target: x.get("target") }))
  };

  // حفظ الكاش لمدة 60 ثانية
  await redis.setEx(key, 60, JSON.stringify(profile));

  console.log("🐢 From DBs");
  console.log(profile);
}

async function shutdown() {
  await mongoose.disconnect();
  await neoSession.close();
  await driver.close();
  await redis.disconnect();
  rl.close();
  console.log("Bye 👋");
}

/* ================= Run CLI ================= */
mainMenu();
