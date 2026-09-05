import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { sha256, verifyRelease } from "../release/migrate.mjs";

type Docker = (args: string[], env?: NodeJS.ProcessEnv) => Promise<string>;
type Release = { output: string; manifestSha256: string };

export async function buildLinuxMigrationImage(project: string, release: Release, owner: string, docker: Docker) {
  if (!/^[a-f0-9]{24}$/.test(owner)) throw new Error("Invalid Linux rehearsal ownership token.");
  const root = await realpath(project);
  const config = JSON.parse(await readFile(join(root, "config/migration-runtime.linux.json"), "utf8"));
  if (config.version !== 1 || config.platform !== "linux/amd64" || !/^v22\.\d+\.\d+$/.test(config.nodeVersion)
    || !/^node@sha256:[a-f0-9]{64}$/.test(config.nodeImage)) throw new Error("Linux migration runtime must use the reviewed image digest and platform.");
  const { manifest } = await verifyRelease(release.output, release.manifestSha256);
  if (manifest.nodeVersion !== config.nodeVersion) throw new Error("Linux runtime and migration release Node versions differ.");
  const [base] = JSON.parse(await docker(["image", "inspect", config.nodeImage]));
  if (base.Os !== "linux" || base.Architecture !== "amd64" || !base.RepoDigests?.includes(config.nodeImage)) throw new Error("Cached Node image differs from the reviewed Linux runtime.");
  const parent = join(root, ".tmp");
  await mkdir(parent, { recursive: true });
  if (await realpath(parent) !== parent) throw new Error("Linux staging parent must stay inside the project.");
  const temp = await mkdtemp(join(parent, "linux-release-"));
  const owned = async () => {
    const path = await realpath(temp);
    if (dirname(path) !== parent || !path.startsWith(parent + sep + "linux-release-")) throw new Error("Linux build directory ownership changed.");
  };
  try {
    await owned();
    const context = join(temp, "context");
    await mkdir(join(context, "launcher"), { recursive: true });
    await cp(release.output, join(context, "release"), { recursive: true });
    await verifyRelease(join(context, "release"), release.manifestSha256);
    const trustedFiles: Record<string, string> = {};
    for (const [source, target] of [["scripts/release/Dockerfile", "Dockerfile"], ["scripts/release/launch.mjs", "launcher/launch.mjs"], ["scripts/release/migrate.mjs", "launcher/migrate.mjs"]]) {
      const bytes = await readFile(join(root, source));
      trustedFiles[target] = sha256(bytes);
      await writeFile(join(context, target), bytes, { flag: "wx" });
    }
    const idFile = join(temp, "image-id");
    const dockerConfig = join(temp, "docker-config");
    await mkdir(dockerConfig);
    await writeFile(join(dockerConfig, "config.json"), "{}\n", { flag: "wx" });
    await docker(["build", "--pull=false", "--network=none", "--platform", config.platform,
      "--build-arg", `CUAC_NODE_IMAGE=${config.nodeImage}`, "--label", `cuac.rehearsal=${owner}`,
      "--label", `cuac.release.manifest=${release.manifestSha256}`, "--iidfile", idFile, context], {
      NODE_ENV: "test", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
      ProgramFiles: process.env.ProgramFiles, DOCKER_BUILDKIT: "1", DOCKER_CONFIG: dockerConfig,
    });
    const imageId = (await readFile(idFile, "utf8")).trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error("Invalid Linux migration image ID.");
    const [image] = JSON.parse(await docker(["image", "inspect", imageId]));
    if (image.Config.Labels?.["cuac.rehearsal"] !== owner || image.Config.User !== "1000:1000"
      || image.Os !== "linux" || image.Architecture !== "amd64") throw new Error("Linux migration image configuration changed.");
    return { imageId, nodeImage: config.nodeImage, nodeVersion: config.nodeVersion, platform: config.platform, trustedFiles };
  } finally { await owned(); await rm(temp, { recursive: true }); }
}
