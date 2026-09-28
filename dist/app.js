"use strict";
const $ = (id) => document.getElementById(id);
const labels = {
  happy: "Happy",
  neutral: "Neutral",
  sad: "Sad",
  surprised: "Surprised",
  angry: "Angry",
  fearful: "Fearful",
  disgusted: "Disgusted",
};
const video = $("video"),
  canvas = $("overlay"),
  button = $("toggle");
let stream = null,
  running = false,
  generation = 0,
  loaded = false,
  loading = false;
for (const [key, label] of Object.entries(labels))
  $("scores").insertAdjacentHTML(
    "beforeend",
    `<div class="score"><div class="score-label"><span>${label}</span><span id="value-${key}">—</span></div><div class="track"><div class="fill" id="bar-${key}"></div></div></div>`,
  );
function resetResults(
  title = "No prediction yet.",
  hint = "Results will appear here when the camera is on.",
) {
  $("prediction").textContent = title;
  $("hint").textContent = hint;
  for (const key of Object.keys(labels)) {
    $("value-" + key).textContent = "—";
    $("bar-" + key).style.width = "0%";
  }
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}
function stop(message = "Camera stopped.") {
  generation++;
  running = false;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
  $("empty").hidden = false;
  $("empty").style.display = "flex";
  $("camera-state").textContent = "Camera off";
  $("status").textContent = message;
  button.disabled = false;
  button.textContent = "Start camera ↗";
  resetResults();
}
async function start() {
  if (running || loading) return;
  loading = true;
  button.disabled = true;
  const token = ++generation;
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new Error("unsupported");
    $("status").textContent =
      "Loading the models… The first start may take a moment.";
    if (!window.faceapi) throw new Error("model");
    if (!loaded) {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("./models"),
        faceapi.nets.faceExpressionNet.loadFromUri("./models"),
      ]);
      loaded = true;
    }
    if (token !== generation) return;
    $("status").textContent = "Allow camera access in your browser.";
    const acquired = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });
    if (token !== generation) {
      acquired.getTracks().forEach((t) => t.stop());
      return;
    }
    stream = acquired;
    video.srcObject = stream;
    await video.play();
    if (token !== generation) return;
    running = true;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    $("stage").style.aspectRatio = `${video.videoWidth}/${video.videoHeight}`;
    $("empty").style.display = "none";
    $("camera-state").textContent = "Camera on";
    $("status").textContent = "Keep your face turned toward the camera.";
    button.textContent = "Stop camera";
    button.disabled = false;
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      if (running) stop("Camera disconnected. Please try again.");
    });
    void detect(token);
  } catch (err) {
    stop(errorMessage(err));
  } finally {
    loading = false;
    if (!running) button.disabled = false;
  }
}
function errorMessage(err) {
  if (err.name === "NotAllowedError")
    return "Camera access was denied. Allow access in your browser’s address bar and try again.";
  if (err.name === "NotFoundError")
    return "No camera found. Check that your camera is connected.";
  if (err.name === "NotReadableError")
    return "Could not open the camera. Close other apps using it and try again.";
  if (err.message === "unsupported")
    return "Camera access is not supported in this view. Open the HTTPS link in Chrome or Safari.";
  return "Could not start the model or camera. Check your connection and try again, or open the link in Chrome or Safari.";
}
async function detect(token) {
  if (!running || generation !== token) return;
  try {
    const result = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.5,
        }),
      )
      .withFaceExpressions();
    if (!running || generation !== token) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!result) {
      resetResults(
        "Looking for a face…",
        "Try with one face in a well-lit space.",
      );
      $("status").textContent = "Keep your face visible in the camera view.";
    } else {
      const { x, y, width, height } = result.detection.box;
      ctx.strokeStyle = "#a4ef80";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      const sorted = Object.entries(result.expressions).sort(
        (a, b) => b[1] - a[1],
      );
      const [key, score] = sorted[0];
      $("prediction").textContent = score < 0.5 ? "Uncertain" : labels[key];
      $("hint").textContent =
        score < 0.5
          ? "The model could not identify a clear expression."
          : "A live model prediction of the visible facial expression.";
      $("status").textContent = "Face detected · Live analysis";
      for (const k of Object.keys(labels)) {
        const pct = Math.round(result.expressions[k] * 100);
        $("value-" + k).textContent = pct + "%";
        $("bar-" + k).style.width = pct + "%";
      }
    }
    setTimeout(() => void detect(token), 140);
  } catch (err) {
    if (token === generation)
      stop("Analysis stopped. Restart the camera to try again.");
  }
}
button.addEventListener("click", () => (running ? stop() : void start()));
window.addEventListener("pagehide", () => stop());
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (running || loading))
    stop("Camera stopped because you left the tab.");
});
const registry = document.modelContext;
if (registry?.registerTool) {
  const controller = new AbortController();
  try {
    Promise.resolve(
      registry.registerTool(
        {
          name: "stop_camera",
          description: "Stop the camera and clear current expression results.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute(input) {
            if (
              !input ||
              typeof input !== "object" ||
              Array.isArray(input) ||
              Object.keys(input).length
            )
              throw new Error("Expected empty object");
            stop();
            return { camera: "stopped" };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
  } catch {}
  window.addEventListener("pagehide", () => controller.abort(), { once: true });
}
