import Researcher from "../models/researcher.mongo.js";

export async function createResearcher(req, res) {
  try {
    const researcher = new Researcher(req.body);
    await researcher.save();
    res.status(201).json(researcher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getResearchers(req, res) {
  try {
    const researchers = await Researcher.find();
    res.json(researchers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
