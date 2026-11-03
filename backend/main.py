from faster_whisper import WhisperModel
import subprocess
import imageio_ffmpeg
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from pathlib import Path
import tempfile
import uuid
from typing import Optional

app = FastAPI(title="ClipGenius AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://nitesh-rathore960.github.io"
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "clipgenius_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_SIZE = 500 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".mp4", ".mov", ".mkv", ".webm", ".avi"
}

class GenerateRequest(BaseModel):
    youtube_url: Optional[HttpUrl] = None
    upload_id: Optional[str] = None
    clip_count: int = 3
    max_duration: int = 30

@app.get("/")
def home():
    return {
        "message": "ClipGenius AI Backend is running"
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/health/ffmpeg")
def check_ffmpeg():
    try:
        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()

        result = subprocess.run(
            [ffmpeg_path, "-version"],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode != 0:
            raise Exception("FFmpeg is not working")

        return {
            "status": "ok",
            "ffmpeg": "working"
        }

    except Exception as e:
        raise HTTPException(500, str(e))
        
@app.post("/api/audio/extract")
def extract_audio(upload_id: str):

    try:
        upload_uuid = uuid.UUID(upload_id)
    except ValueError:
        raise HTTPException(400, "Invalid upload ID")

    matches = list(UPLOAD_DIR.glob(f"{upload_uuid}.*"))

    if not matches:
        raise HTTPException(404, "Uploaded video not found")

    video_path = matches[0]
    audio_path = UPLOAD_DIR / f"{upload_uuid}_audio.wav"

    try:
        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()

        result = subprocess.run(
            [
                ffmpeg_path,
                "-y",
                "-i", str(video_path),
                "-map", "0:a:0",
                "-vn",
                "-ac", "1",
                "-ar", "16000",
                "-c:a", "pcm_s16le",
                str(audio_path)
            ],
            capture_output=True,
            text=True,
            timeout=120
        )

        if result.returncode != 0:
            audio_path.unlink(missing_ok=True)
            raise HTTPException(
                400,
                "Audio extraction failed. Check whether the video contains audio."
            )

        return {
            "success": True,
            "message": "Audio extracted successfully",
            "audio_size_kb": round(audio_path.stat().st_size / 1024, 2)
        }

    except subprocess.TimeoutExpired:
        audio_path.unlink(missing_ok=True)
        raise HTTPException(408, "Audio extraction timed out")

    except HTTPException:
        raise

    except Exception:
        audio_path.unlink(missing_ok=True)
        raise HTTPException(500, "Audio extraction failed")
        
@app.post("/api/audio/transcribe")
def transcribe_audio(upload_id: str):

    try:
        upload_uuid = uuid.UUID(upload_id)
    except ValueError:
        raise HTTPException(400, "Invalid upload ID")

    audio_path = UPLOAD_DIR / f"{upload_uuid}_audio.wav"

    if not audio_path.exists():
        raise HTTPException(404, "Extracted audio not found")

    try:
        model = WhisperModel(
            "tiny",
            device="cpu",
            compute_type="int8"
        )

        segments, info = model.transcribe(
            str(audio_path),
            beam_size=1
        )

        transcript = []

        for segment in segments:
            transcript.append({
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip()
            })

        return {
            "success": True,
            "language": info.language,
            "transcript": transcript
        }

        except Exception as e:
            print("TRANSCRIPTION ERROR:", repr(e))
                raise HTTPException(500, str(e))

@app.post("/api/generate")
def generate_clips(data: GenerateRequest):

    if not data.youtube_url and not data.upload_id:
        raise HTTPException(400, "Provide a YouTube URL or upload a video.")

    if data.youtube_url and data.upload_id:
        raise HTTPException(400, "Choose only one video source.")

    if data.upload_id:
        try:
            upload_uuid = uuid.UUID(data.upload_id)
        except ValueError:
            raise HTTPException(400, "Invalid upload ID")

        matches = list(UPLOAD_DIR.glob(f"{upload_uuid}.*"))

        if not matches:
            raise HTTPException(404, "Uploaded video not found. Please upload again.")

    if data.clip_count not in [3, 5, 10]:
        raise HTTPException(400, "Invalid clip count")

    if data.max_duration not in [15, 30, 45, 60]:
        raise HTTPException(400, "Invalid clip duration")

    return {
        "success": True,
        "status": "connected",
        "message": "Video received. AI processing is not implemented yet.",
        "clips": []
                                }

@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    extension = Path(file.filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            "Unsupported video format"
        )

    upload_id = str(uuid.uuid4())
    destination = UPLOAD_DIR / f"{upload_id}{extension}"

    total_size = 0

    try:
        with destination.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_SIZE:
                    raise HTTPException(
                        413,
                        "Video must be 500 MB or smaller"
                    )

                output.write(chunk)

    except HTTPException:
        destination.unlink(missing_ok=True)
        raise

    except Exception:
        destination.unlink(missing_ok=True)
        raise HTTPException(500, "Upload failed")

    finally:
        await file.close()

    return {
        "success": True,
        "upload_id": upload_id,
        "filename": file.filename,
        "size_mb": round(total_size / (1024 * 1024), 2),
        "message": "Video uploaded successfully"
    }
    
