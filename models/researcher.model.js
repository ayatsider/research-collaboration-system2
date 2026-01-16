import mongoose from "mongoose";

const ResearcherSchema = new mongoose.Schema({
  name: String,
  department: String,
  interests: [String],
  publications: [{ type: mongoose.Schema.Types.ObjectId, ref: "Publication" }],
});

export default mongoose.model("Researcher", ResearcherSchema);
