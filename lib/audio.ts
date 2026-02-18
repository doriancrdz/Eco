export async function getDurationMsFromBlob(file: Blob): Promise<number> {
  return await new Promise((resolve, reject) => {
    try {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.src = URL.createObjectURL(file);

      const cleanup = () => {
        if (audio.src) {
          URL.revokeObjectURL(audio.src);
        }
        audio.removeAttribute("src");
        audio.load();
      };

      audio.addEventListener("loadedmetadata", () => {
        const durS = audio.duration;
        cleanup();
        if (!Number.isFinite(durS) || durS <= 0) {
          return reject(new Error("invalid_duration"));
        }
        resolve(Math.round(durS * 1000));
      });

      audio.addEventListener("error", () => {
        cleanup();
        reject(new Error("audio_metadata_error"));
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

