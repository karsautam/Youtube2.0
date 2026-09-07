import mongoose from "mongoose";
const userschema = mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String },
  channelname: { type: String },
  description: { type: String },
  image: { type: String },
  location: { type: String, default: "" },
  joinedon: { type: Date, default: Date.now },
});

export default mongoose.model("user", userschema);
