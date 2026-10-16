"use server";
import { getCurrentSession } from "@/lib/authorization";
import {
  productTourContext,
  writeTourProgress,
  tourProgressInput,
  type TourProgress,
} from "@/lib/product-tour";
export async function getProductTourAction() {
  const session = await getCurrentSession();
  return session ? productTourContext(session.user.id) : null;
}
export async function saveProductTourAction(input: TourProgress) {
  const session = await getCurrentSession();
  if (!session) return { error: "session" };
  try {
    const context = productTourContext(session.user.id);
    if (!context.eligible) return { error: "unavailable" };
    return writeTourProgress(
      session.user.id,
      tourProgressInput.parse(input),
      context.steps,
    );
  } catch {
    return { error: "save" };
  }
}
