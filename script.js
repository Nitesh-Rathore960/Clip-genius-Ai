
/* =================================
   CLIPGENIUS AI - MAIN JAVASCRIPT
================================= */

/*
  Backend connect hone ke baad yahan
  apne backend ka URL add karna.

  Example:
  const API_BASE = "https://your-backend.example.com";
*/

const API_BASE = "https://clipgenius-backend-0qyb.onrender.com";

// ELEMENTS
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.querySelector(".nav-links");
const youtubeUrl = document.getElementById("youtubeUrl");
const pasteBtn = document.getElementById("pasteBtn");
const generateBtn = document.getElementById("generateBtn");
const processingStatus = document.getElementById("processingStatus");
const videoInfo = document.getElementById("videoInfo");
const clipCount = document.getElementById("clipCount");
const clipDuration = document.getElementById("clipDuration");
const usageText = document.getElementById("usageText");
const usageBar = document.getElementById("usageBar");
const clipsContainer = document.getElementById("clipsContainer");
// VIDEO UPLOAD ELEMENTS
const videoFile = document.getElementById("videoFile");
const uploadStatus = document.getElementById("uploadStatus");

let uploadedFileId = null;

const MAX_FILE_SIZE = 500 * 1024 * 1024;

const DAILY_LIMIT = 30;
const STORAGE_KEY = "clipgenius_usage_v1";

// DAILY USAGE
function getToday() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function getUsage() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    if (!saved || saved.date !== getToday()) {
      return { date: getToday(), count: 0 };
    }

    return saved;
  } catch {
    return { date: getToday(), count: 0 };
  }
}

function saveUsage(count) {
  const usage = {
    date: getToday(),
    count: Math.min(count, DAILY_LIMIT)
  };

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(usage)
  );

  updateUsage();
}

function updateUsage() {
  const usage = getUsage();
  const remaining = Math.max(
    0,
    DAILY_LIMIT - usage.count
  );

  usageText.textContent =
    `${usage.count} / ${DAILY_LIMIT} clips`;

  usageBar.style.width =
    `${(usage.count / DAILY_LIMIT) * 100}%`;

  generateBtn.disabled = remaining <= 0;

  if (remaining <= 0) {
    generateBtn.innerHTML = "Daily Limit Reached";
  } else {
    generateBtn.innerHTML =
      "<span>✦</span> Generate AI Clips";
  }
}

// MOBILE NAVIGATION
menuBtn.addEventListener("click", () => {
  navLinks.classList.toggle("active");
});

navLinks.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("active");
  });
});

// YOUTUBE URL VALIDATION
function getYouTubeId(value) {
  try {
    const url = new URL(value.trim());

    const host = url.hostname
      .replace(/^www\./, "")
      .replace(/^m\./, "");

    let id = "";

    if (host === "youtu.be") {
      id = url.pathname.split("/")[1];
    }

    if (
      host === "youtube.com" ||
      host === "music.youtube.com"
    ) {
      if (url.pathname === "/watch") {
        id = url.searchParams.get("v");
      } else {
        const parts = url.pathname.split("/");
        if (
          ["shorts", "embed", "live"].includes(parts[1])
        ) {
          id = parts[2];
        }
      }
    }

    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      return null;
    }

    return id;

  } catch {
    return null;
  }
}

// INPUT VALIDATION
youtubeUrl.addEventListener("input", () => {
  videoInfo.textContent = "";
  processingStatus.style.display = "none";
});

// PASTE BUTTON
pasteBtn.addEventListener("click", async () => {
  try {
    const copiedText = await navigator.clipboard.readText();

    youtubeUrl.value = copiedText.trim();
    youtubeUrl.dispatchEvent(new Event("input"));

    if (getYouTubeId(youtubeUrl.value)) {
      videoInfo.textContent = "✓ Valid YouTube link detected.";
    } else {
      videoInfo.textContent = "Please paste a valid YouTube link.";
    }

  } catch {
    showStatus(
      "Clipboard access unavailable. Please paste your link manually.",
      "error"
    );
  }
});

// VIDEO FILE UPLOAD
videoFile.addEventListener("change", () => {
  const file = videoFile.files[0];

  uploadedFileId = null;

  if (!file) return;

  if (file.size > MAX_FILE_SIZE) {
    uploadStatus.textContent = "Video must be 500 MB or smaller.";
    uploadStatus.style.color = "#ff8888";
    videoFile.value = "";
    return;
  }

  const allowedTypes = [
    "mp4", "mov", "mkv", "webm", "avi"
  ];

  const extension = file.name.split(".").pop().toLowerCase();

  if (!allowedTypes.includes(extension)) {
    uploadStatus.textContent = "Unsupported video format.";
    uploadStatus.style.color = "#ff8888";
    videoFile.value = "";
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  const xhr = new XMLHttpRequest();

  xhr.open("POST", `${API_BASE}/api/upload`);

  uploadStatus.textContent = "Uploading: 0%";
  uploadStatus.style.color = "#a9c6ff";

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      const percent = Math.round(
        (event.loaded / event.total) * 100
      );

      uploadStatus.textContent = `Uploading: ${percent}%`;
    }
  };

  xhr.onload = () => {
    try {
      const result = JSON.parse(xhr.responseText);

      if (xhr.status < 200 || xhr.status >= 300) {
        throw new Error(result.detail || "Upload failed.");
      }

      if (!result.success || !result.upload_id) {
        throw new Error("Invalid upload response.");
      }

      uploadedFileId = result.upload_id;

      uploadStatus.textContent =
        "✓ Video uploaded successfully: " + result.filename;

      uploadStatus.style.color = "#55e9b0";

    } catch (error) {
      uploadStatus.textContent = error.message;
      uploadStatus.style.color = "#ff8888";
    }
  };

  xhr.onerror = () => {
    uploadStatus.textContent =
      "Network error. Please try again.";

    uploadStatus.style.color = "#ff8888";
  };

  xhr.send(formData);
});

// DISPLAY STATUS
function showStatus(message, type = "info") {
  processingStatus.style.display = "block";
  processingStatus.textContent = message;

  if (type === "error") {
    processingStatus.style.color = "#ff8888";
  } else if (type === "success") {
    processingStatus.style.color = "#55e9b0";
  } else {
    processingStatus.style.color = "#a9c6ff";
  }
}

// RENDER GENERATED CLIPS
function renderClips(clips) {
  clipsContainer.replaceChildren();

  if (!Array.isArray(clips) || clips.length === 0) {
    clipsContainer.textContent =
      "No clips were returned by the processing server.";
    return;
  }

  clips.forEach((clip, index) => {
    const card = document.createElement("article");
    card.className = "feature-card";

    const heading = document.createElement("h3");
    heading.textContent = clip.title || `Clip ${index + 1}`;

    const details = document.createElement("p");
    details.textContent =
      `Start: ${clip.start}s | End: ${clip.end}s`;

    card.append(heading, details);

    if (clip.video_url) {
      try {
        const parsed = new URL(clip.video_url);

        if (parsed.protocol !== "https:") {
          throw new Error("Invalid video URL");
        }

        const download = document.createElement("a");
        download.href = parsed.href;
        download.target = "_blank";
        download.rel = "noopener noreferrer";
        download.className = "primary-btn";
        download.textContent = "Download Clip";

        card.appendChild(download);

      } catch {
        const error = document.createElement("p");
        error.textContent = "Invalid download link.";
        card.appendChild(error);
      }
    }

    clipsContainer.appendChild(card);
  });
}


// GENERATE AI CLIPS
generateBtn.addEventListener("click", async () => {

  const url = youtubeUrl.value.trim();
  const videoId = getYouTubeId(url);

  // Check video source
  if (!url && !uploadedFileId) {
    showStatus("Please enter a YouTube URL or upload a video.", "error");
    return;
  }

  if (url && !videoId) {
    showStatus("Please enter a valid YouTube URL.", "error");
    return;
  }

  if (url && uploadedFileId) {
    showStatus("Please choose only one video source.", "error");
    return;
  }

  const usage = getUsage();
  const requestedClips = Number(clipCount.value);
  const remaining = DAILY_LIMIT - usage.count;

  if (remaining <= 0 || requestedClips > remaining) {
    showStatus("Your daily clip limit has been reached.", "error");
    return;
  }

  if (uploadedFileId && !API_BASE) {
    showStatus("Backend is not connected.", "error");
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "Processing...";

  showStatus("Connecting to video processing server...");

  const payload = {
    clip_count: requestedClips,
    max_duration: Number(clipDuration.value)
  };

  if (uploadedFileId) {
    payload.upload_id = uploadedFileId;
  } else {
    payload.youtube_url = url;
  }

  try {
    const response = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.detail || "Server error");
    }

    if (!result.success) {
      throw new Error("Request was unsuccessful.");
    }

    if (!Array.isArray(result.clips)) {
      throw new Error("Invalid server response.");
    }

    if (result.clips.length === 0) {
      showStatus(
        "Video received successfully, but AI clipping is not implemented yet.",
        "success"
      );
      return;
    }

    if (result.clips.length > requestedClips) {
      throw new Error("Unexpected number of clips returned.");
    }

    renderClips(result.clips);
    saveUsage(usage.count + result.clips.length);

    showStatus("Clips generated successfully!", "success");

    document.getElementById("results").scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {
    showStatus(error.message || "Something went wrong.", "error");

  } finally {
    updateUsage();
  }
});


// INITIALIZE
updateUsage();

console.log("ClipGenius AI initialized successfully.");
    
