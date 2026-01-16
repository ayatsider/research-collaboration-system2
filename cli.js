import mongoose from "mongoose";
import dotenv from "dotenv";
import readline from "readline";
import Researcher from "./models/researcher.model.js";
import Project from "./models/project.model.js";
import Publication from "./models/publication.model.js";
import neo4j from "neo4j-driver";

dotenv.config();

// ================== اتصال MongoDB ==================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected ✅"))
  .catch(err => console.log("MongoDB connection error:", err));

// ================== اتصال Neo4j ==================
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);
const neoSession = driver.session({ database: process.env.NEO4J_DATABASE });

// ================== واجهة CLI ==================
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer)));
}

// ================== قائمة رئيسية ==================
async function mainMenu() {
  while (true) {
    console.log("\n===== Research Collaboration CLI =====");
    console.log("1. Add Researcher");
    console.log("2. Add Project");
    console.log("3. Add Publication");
    console.log("4. Show Researchers");
    console.log("5. Show Projects");
    console.log("6. Show Collaborations");
    console.log("0. Exit");

    const choice = await ask("Enter your choice (number): ");

    switch (choice) {
      case "1":
        await addResearcher();
        break;
      case "2":
        await addProject();
        break;
      case "3":
        await addPublication();
        break;
      case "4":
        await showResearchers();
        break;
      case "5":
        await showProjects();
        break;
      case "6":
        await showCollaborations();
        break;
      case "0":
        console.log("Exiting CLI...");
        await mongoose.disconnect();
        await neoSession.close();
        await driver.close();
        rl.close();
        return;
      default:
        console.log("Invalid choice. Try again.");
    }
  }
}

// ================== دوال CLI ==================
async function addResearcher() {
  const name = await ask("Researcher Name: ");
  const department = await ask("Department: ");
  const interests = await ask("Interests (comma separated): ");
  const r = new Researcher({
    name,
    department,
    interests: interests.split(",").map(s => s.trim())
  });
  await r.save();

  // انشاء الباحث في Neo4j
  await neoSession.run(
    "MERGE (r:Researcher {name: $name, department: $department})",
    { name, department }
  );

  console.log("Researcher added ✅");
}

async function addProject() {
  const title = await ask("Project Title: ");
  const description = await ask("Project Description: ");

  const researchers = await Researcher.find();
  if (researchers.length === 0) {
    console.log("No researchers found. Add some first.");
    return;
  }

  console.log("Researchers:");
  researchers.forEach((r, i) => console.log(`${i + 1}. ${r.name}`));

  const selected = await ask("Select participants by number (comma separated, or leave empty): ");
  const participants = selected
    ? selected.split(",").map(n => researchers[parseInt(n) - 1]?._id).filter(Boolean)
    : [];

  // اضف المشاريع والباحثين في MongoDB
  const p = new Project({ title, description, participants });
  await p.save();

  // اضف روابط الباحثين في Neo4j
  for (const idx of (selected ? selected.split(",") : [])) {
    const researcher = researchers[parseInt(idx) - 1];
    if (!researcher) continue;

    const relation = await ask(`Enter relationship with ${researcher.name} (co-authorship / supervision / teamwork): `);
    await neoSession.run(
      `
      MATCH (r:Researcher {name: $rName})
      MERGE (p:Project {title: $title})
      MERGE (r)-[:${relation.toUpperCase().replace("-", "_")}]->(p)
      `,
      { rName: researcher.name, title }
    );
  }

  // اضف النشرات
  const addPubs = await ask("Do you want to add publications for this project? (y/n): ");
  if (addPubs.toLowerCase() === "y") {
    const num = parseInt(await ask("How many publications? "));
    for (let i = 0; i < num; i++) {
      const pubTitle = await ask(`Publication ${i + 1} Title: `);
      const pubYear = parseInt(await ask("Year: "));
      const pub = new Publication({ title: pubTitle, year: pubYear, authors: participants });
      await pub.save();
      p.publications.push(pub._id);

      // ربط authors بالنشر في Neo4j
      for (const rId of participants) {
        const researcher = await Researcher.findById(rId);
        await neoSession.run(
          `
          MATCH (r:Researcher {name: $rName})
          MERGE (pub:Publication {title: $pubTitle, year: $pubYear})
          MERGE (r)-[:AUTHOR_OF]->(pub)
          `,
          { rName: researcher.name, pubTitle, pubYear }
        );
      }
    }
    await p.save();
  }

  console.log("Project added ✅");
}

async function addPublication() {
  const title = await ask("Publication Title: ");
  const year = parseInt(await ask("Year: "));
  const researchers = await Researcher.find();
  console.log("Researchers:");
  researchers.forEach((r, i) => console.log(`${i + 1}. ${r.name}`));
  const selected = await ask("Select authors by number (comma separated): ");
  const authors = selected.split(",").map(n => researchers[parseInt(n)-1]?._id).filter(Boolean);
  const pub = new Publication({ title, year, authors });
  await pub.save();

  // Neo4j
  for (const rId of authors) {
    const researcher = await Researcher.findById(rId);
    await neoSession.run(
      `
      MATCH (r:Researcher {name: $rName})
      MERGE (pub:Publication {title: $title, year: $year})
      MERGE (r)-[:AUTHOR_OF]->(pub)
      `,
      { rName: researcher.name, title, year }
    );
  }

  console.log("Publication added ✅");
}

async function showResearchers() {
  const researchers = await Researcher.find().populate("publications");
  researchers.forEach(r => {
    console.log(`\n${r.name} | ${r.department} | Interests: ${r.interests.join(", ")}`);
    if (r.publications.length > 0) {
      console.log("Publications:");
      r.publications.forEach(p => console.log(` - ${p.title} (${p.year})`));
    }
  });
}

async function showProjects() {
  const projects = await Project.find().populate("participants").populate("publications");
  projects.forEach(p => {
    console.log(`\n${p.title} | ${p.description}`);
    console.log("Participants:", p.participants.map(r => r.name).join(", "));
    if (p.publications.length > 0) {
      console.log("Publications:");
      p.publications.forEach(pub => console.log(` - ${pub.title} (${pub.year})`));
    }
  });
}

async function showCollaborations() {
  console.log("Collaborations in Neo4j:");
  const result = await neoSession.run("MATCH (r:Researcher)-[rel]->(p) RETURN r.name AS researcher, type(rel) AS relation, p.title AS project LIMIT 50");
  result.records.forEach(rec => {
    console.log(`${rec.get("researcher")} -[${rec.get("relation")}]-> ${rec.get("project")}`);
  });
}

// ================== تشغيل CLI ==================
mainMenu();
