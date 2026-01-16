import neo4j from "neo4j-driver";
import dotenv from "dotenv";
dotenv.config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

const session = driver.session({ database: process.env.NEO4J_DATABASE });

async function seedNeo4j() {
  try {
    // حذف كل البيانات القديمة
    await session.run('MATCH (n) DETACH DELETE n');
    console.log("Old data cleared ✅");

    // ========================
    // 1️⃣ إضافة الباحثين
    // ========================
    const researchers = [
      { name: "Ayat Sider", department: "Computer Science", interests: ["AI", "Web"] },
      { name: "Omar Khalil", department: "Physics", interests: ["Quantum", "Optics"] },
      { name: "Lina Fares", department: "Biology", interests: ["Genetics", "Microbiology"] }
    ];

    for (const r of researchers) {
      await session.run(
        'CREATE (res:Researcher {name: $name, department: $department, interests: $interests})',
        { name: r.name, department: r.department, interests: r.interests.join(", ") }
      );
    }
    console.log("Researchers created ✅");

    // ========================
    // 2️⃣ إضافة المشاريع
    // ========================
    const projects = [
      { title: "AI Web Project", description: "Research on AI-powered web apps" },
      { title: "Quantum Optics Study", description: "Study of photons in quantum optics" }
    ];

    for (const p of projects) {
      await session.run(
        'CREATE (proj:Project {title: $title, description: $description})',
        { title: p.title, description: p.description }
      );
    }
    console.log("Projects created ✅");

    // ========================
    // 3️⃣ ربط الباحثين بالمشاريع
    // ========================
    await session.run(`
      MATCH (r:Researcher {name: "Ayat Sider"}), (p:Project {title: "AI Web Project"})
      CREATE (r)-[:WORKS_ON]->(p)
    `);

    await session.run(`
      MATCH (r:Researcher {name: "Omar Khalil"}), (p:Project {title: "Quantum Optics Study"})
      CREATE (r)-[:WORKS_ON]->(p)
    `);

    console.log("Researchers linked to Projects ✅");

    // ========================
    // 4️⃣ ربط الباحثين لبعضهم (Collaboration)
    // ========================
    await session.run(`
      MATCH (a:Researcher {name: "Ayat Sider"}), (b:Researcher {name: "Lina Fares"})
      CREATE (a)-[:COLLABORATES_WITH]->(b)
    `);

    console.log("Collaborations created ✅");

  } catch (err) {
    console.error("Neo4j seeding error:", err);
  } finally {
    await session.close();
    await driver.close();
    console.log("Neo4j disconnected ✅");
  }
}

// تشغيل السكريبت
seedNeo4j();
