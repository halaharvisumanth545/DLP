import mongoose from "mongoose";
import dns from "node:dns";

/**
 * Remove duplicate questions from the database.
 * Groups by normalized text + topic and keeps only the newest document per group.
 * Runs once on server startup to clean up legacy duplicates.
 */
async function cleanupDuplicateQuestions() {
  try {
    const Question = mongoose.model("Question");

    // Find groups of questions with duplicate text + topic
    const duplicates = await Question.aggregate([
      {
        $group: {
          _id: { text: { $toLower: "$text" }, topic: "$topic" },
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    if (duplicates.length === 0) {
      console.log("[DB Cleanup] No duplicate questions found.");
      return;
    }

    let totalRemoved = 0;
    for (const group of duplicates) {
      // Keep the first (oldest) document, delete the rest
      const idsToDelete = group.ids.slice(1);
      const result = await Question.deleteMany({ _id: { $in: idsToDelete } });
      totalRemoved += result.deletedCount;
    }

    console.log(`[DB Cleanup] Removed ${totalRemoved} duplicate questions from ${duplicates.length} groups.`);
  } catch (error) {
    // If Question model isn't registered yet, skip cleanup silently
    if (error.name === "MissingSchemaError") {
      console.log("[DB Cleanup] Question model not registered yet, skipping cleanup.");
    } else {
      console.error("[DB Cleanup] Error during duplicate cleanup:", error);
    }
  }
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing in .env");

  // Use Google public DNS so mongodb+srv:// SRV lookups work on
  // networks whose local DNS server cannot resolve Atlas hostnames.
  dns.setServers(["8.8.8.8", "8.8.4.4"]);

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);

  console.log("MongoDB connected");

  // Clean up existing duplicate questions
  await cleanupDuplicateQuestions();
}