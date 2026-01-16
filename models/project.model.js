import mongoose from "mongoose";

const ProjectSchema = new mongoose.Schema({
  title: String,
  description: String,
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Researcher" }],
  publications: [{ type: mongoose.Schema.Types.ObjectId, ref: "Publication" }],
});

export default mongoose.model("Project", ProjectSchema);
