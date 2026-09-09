import "dotenv/config";

// Explicit operator reconciliation, never an automatic retry of uncertain SMTP.
// Provide an opaque evidence reference; do not place email addresses/secrets here.
async function main() {
  const [id, resolution, evidence] = process.argv.slice(2);
  if (!id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !["accepted", "retry", "failed"].includes(resolution ?? "") || !/^[a-zA-Z0-9][a-zA-Z0-9_./:-]{2,160}$/.test(evidence ?? "")) {
    throw new Error("Usage: email:review-outbox -- ID accepted|retry|failed EVIDENCE_REFERENCE");
  }
  const { prisma } = await import("../src/lib/prisma");
  try {
    const now = new Date();
    const result = await prisma.emailOutbox.updateMany({
      where: { id, status: { in: ["uncertain", "failed"] } },
      data: {
        status: resolution as "accepted" | "retry" | "failed",
        reviewedAt: now,
        reviewNote: `${resolution}:${evidence}`,
        acceptedAt: resolution === "accepted" ? now : null,
        ...(resolution === "retry" ? { attempts: 0, nextAttemptAt: now } : {}),
        lastErrorCode: "ManuallyReconciled",
      },
    });
    if (result.count !== 1) throw new Error("Email row is missing or not awaiting review.");
    console.log(JSON.stringify({ reviewed: 1, resolution }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => { console.error("Email outbox review failed. Check arguments, target environment and reviewable row status."); process.exitCode = 1; });
