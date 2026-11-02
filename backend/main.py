
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

app = FastAPI(title="ClipGenius AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://nitesh-rathore960.github.io"
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

class GenerateRequest(BaseModel):
    youtube_url: HttpUrl
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

@app.post("/api/generate")
def generate_clips(data: GenerateRequest):
    if data.clip_count not in [3, 5, 10]:
        return {
            "success": False,
            "message": "Invalid clip count"
        }

    if data.max_duration not in [15, 30, 45, 60]:
        return {
            "success": False,
            "message": "Invalid clip duration"
        }

    return {
        "success": True,
        "status": "connected",
        "message": (
            "Backend connected successfully. "
            "Video processing will be added next."
        ),
        "clips": []
    }
    
