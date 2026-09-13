export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getAnnotationRepository } = await import("@/server/annotations/repository");
    const { getServerFoundation } = await import("@/server/foundation/provider");
    const foundation = await getServerFoundation();
    await getAnnotationRepository(foundation).snapshot();
  }
}
