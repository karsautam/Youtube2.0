import mongoose from "mongoose";
const userschema = mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String },
  channelname: { type: String },
  description: { type: String },
  image: { type: String },
  location: { type: String, default: "" },
  // The one device currently allowed to stay signed in (single-device policy).
  // Claimed atomically so two simultaneous logins cannot both skip OTP.
  activeDeviceId: { type: String, default: null },
  joinedon: { type: Date, default: Date.now },
});

export default mongoose.model("user", userschema);
