import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function testMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected ✅");
    const db = mongoose.connection.db;
    console.log("Database name:", db.databaseName);
    await mongoose.disconnect();
    console.log("MongoDB disconnected ✅");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
  }
}

testMongo();
