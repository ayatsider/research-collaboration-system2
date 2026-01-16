import neo4j from "neo4j-driver";
import dotenv from "dotenv";

dotenv.config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function testConnection() {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });
  try {
    const result = await session.run("RETURN 1 AS test");
    console.log("Neo4j connected:", result.records[0].get("test"));
  } catch (err) {
    console.error("Neo4j connection error:", err);
  } finally {
    await session.close();
    await driver.close();
  }
}

testConnection();
