import { execFile } from "child_process";
import { promisify } from "util";

const execFileP = promisify(execFile);

/**
 * Mesure la durée d'un fichier audio en millisecondes via ffprobe.
 * Utilise FFPROBE_PATH si défini, sinon le binaire "ffprobe" du PATH.
 */
export async function probeDurationMs(filePath: string): Promise<number> {
  const ffprobeCmd = process.env.FFPROBE_PATH || "ffprobe";

  try {
    const { stdout } = await execFileP(ffprobeCmd, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=nk=1:nw=1",
      filePath,
    ]);

    const seconds = parseFloat(stdout.trim());
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error("ffprobe returned invalid duration");
    }

    return Math.round(seconds * 1000);
  } catch (err) {
    console.error("[probeDurationMs] ffprobe error", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err instanceof Error ? err : new Error(String(err));
  }
}

