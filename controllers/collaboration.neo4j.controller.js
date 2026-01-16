import { getDriver } from "../services/neo4j.service.js";

export async function createCollaboration(req, res) {
  const { researcher1, researcher2, type } = req.body; // type: co-author, supervisor, teammate
  const driver = getDriver();
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MERGE (r1:Researcher {name: $researcher1})
      MERGE (r2:Researcher {name: $researcher2})
      MERGE (r1)-[:${type.toUpperCase()}]->(r2)
      RETURN r1, r2
      `,
      { researcher1, researcher2 }
    );
    res.json(result.records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
}
