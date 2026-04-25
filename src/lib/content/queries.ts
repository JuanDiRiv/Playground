import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  ChallengeSchema,
  ExerciseSchema,
  QuestionSchema,
  TopicSchema,
  type Challenge,
  type Exercise,
  type Question,
  type Topic,
  type TopicSlug,
} from "@/lib/schemas/content";

export async function listTopics(): Promise<Topic[]> {
  const snap = await getAdminDb()
    .collection("topics")
    .orderBy("order")
    .get();
  return snap.docs.map((doc) => TopicSchema.parse(doc.data()));
}

export async function getTopic(slug: TopicSlug): Promise<Topic | null> {
  const doc = await getAdminDb().collection("topics").doc(slug).get();
  if (!doc.exists) return null;
  return TopicSchema.parse(doc.data());
}

export async function listQuestions(slug: TopicSlug): Promise<Question[]> {
  const snap = await getAdminDb()
    .collection("topics")
    .doc(slug)
    .collection("questions")
    .get();
  return snap.docs.map((doc) => QuestionSchema.parse(doc.data()));
}

export async function listExercises(slug: TopicSlug): Promise<Exercise[]> {
  const snap = await getAdminDb()
    .collection("topics")
    .doc(slug)
    .collection("exercises")
    .get();
  return snap.docs.map((doc) => ExerciseSchema.parse(doc.data()));
}

export async function listChallenges(
  slug: TopicSlug,
): Promise<Challenge[]> {
  const snap = await getAdminDb()
    .collection("topics")
    .doc(slug)
    .collection("challenges")
    .get();
  return snap.docs.map((doc) => ChallengeSchema.parse(doc.data()));
}
