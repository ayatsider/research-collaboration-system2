import mongoose from "mongoose";

const PublicationSchema = new mongoose.Schema({
  title: String,
  year: Number,
  authors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Researcher" }],
});

export default mongoose.model("Publication", PublicationSchema);
