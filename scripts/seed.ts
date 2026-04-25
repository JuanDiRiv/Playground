/**
 * Uploads seed content from /content/seed into Firestore using the Admin SDK.
 *
 * Run with:
 *   npx tsx scripts/seed.ts
 *
 * Requires the same FIREBASE_ADMIN_* env vars as the app (.env.local).
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { getAdminDb } from "../src/lib/firebase/admin";
import {
  ChallengeSchema,
  ExerciseSchema,
  QuestionSchema,
  TopicSchema,
} from "../src/lib/schemas/content";

loadEnv({ path: ".env.local" });

const SEED_DIR = resolve(process.cwd(), "content/seed");

async function readJson<T>(file: string): Promise<T> {
  const raw = await readFile(resolve(SEED_DIR, file), "utf-8");
  return JSON.parse(raw) as T;
}

async function main() {
  const db = getAdminDb();

  const topics = TopicSchema.array().parse(
    await readJson("topics.json"),
  );
  const questions = QuestionSchema.array().parse(
    await readJson("questions.json"),
  );
  const exercises = ExerciseSchema.array().parse(
    await readJson("exercises.json"),
  );
  const challenges = ChallengeSchema.array().parse(
    await readJson("challenges.json"),
  );

  console.log(
    `Seeding ${topics.length} topics, ${questions.length} questions, ${exercises.length} exercises, ${challenges.length} challenges…`,
  );

  const batch = db.batch();

  for (const topic of topics) {
    batch.set(db.collection("topics").doc(topic.slug), topic);
  }

  for (const q of questions) {
    batch.set(
      db
        .collection("topics")
        .doc(q.topicSlug)
        .collection("questions")
        .doc(q.id),
      q,
    );
  }

  for (const ex of exercises) {
    batch.set(
      db
        .collection("topics")
        .doc(ex.topicSlug)
        .collection("exercises")
        .doc(ex.id),
      ex,
    );
  }

  for (const ch of challenges) {
    batch.set(
      db
        .collection("topics")
        .doc(ch.topicSlug)
        .collection("challenges")
        .doc(ch.id),
      ch,
    );
  }

  await batch.commit();
  console.log("✓ Seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
