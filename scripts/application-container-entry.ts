try {
  const mode = (process.env.CUAC_START_MODE ?? "").trim().toLowerCase();
  if (process.argv.length !== 2) {
    throw new Error("Application container entry does not accept command arguments.");
  }

  if (mode === "development") {
    await import("./start-app.ts");
  } else if (mode === "staging-candidate") {
    await import("./start-staging-candidate.ts");
  } else if (mode === "reviewed") {
    const manifest = process.env.CUAC_STAGING_EVIDENCE_MANIFEST ?? "";
    if (!manifest.startsWith("/") || manifest.includes("\0")) {
      throw new Error("Reviewed startup requires an absolute protected evidence manifest path.");
    }
    process.argv.push(manifest);
    await import("./start-reviewed-release.ts");
  } else {
    throw new Error("CUAC_START_MODE must be development, staging-candidate, or reviewed.");
  }
} catch {
  console.error("Application container startup rejected. Inspect the protected runtime configuration.");
  process.exitCode = 1;
}
