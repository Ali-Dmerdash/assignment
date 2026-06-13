import mongoose from "mongoose";
import { requireEnv } from "./env.js";
import "../models/index.js";

const MONGO_URI = requireEnv("MONGO_URI");

mongoose.connection.on("error", (err) => {
  console.error("[mongo] connection error:", err);
});
mongoose.connection.on("disconnected", () => {
  console.warn("[mongo] disconnected");
});

export async function connectDB(): Promise<void> {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log("[mongo] connected");
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
