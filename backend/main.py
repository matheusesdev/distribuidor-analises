import asyncio
import json

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from slowapi.errors import RateLimitExceeded

from app_core.config import ALLOWED_ORIGINS, PORT, SYNC_INTERVAL_SECONDS, TESTING
from app_core.limiter import limiter
from app_core.logging_setup import logger
from app_core.text_utils import normalize_text_value
from domain.sync import perform_sync
from routes import all_routers

app = FastAPI(title="VCA Distribuidor - Backend Oficial")
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Muitas tentativas. Aguarde antes de tentar novamente."})


@app.middleware("http")
async def normalize_json_responses(request: Request, call_next):
    response = await call_next(request)
    content_type = (response.headers.get("content-type") or "").lower()
    if "application/json" not in content_type:
        return response
    headers = {k: v for k, v in response.headers.items() if k.lower() not in {"content-length", "content-type", "transfer-encoding", "content-encoding"}}
    body = b""
    async for chunk in response.body_iterator:
        body += chunk
    if not body:
        return Response(content=body, status_code=response.status_code, headers=headers, media_type="application/json")
    try:
        decoded = json.loads(body.decode(response.charset or "utf-8"))
    except Exception:
        return Response(content=body, status_code=response.status_code, headers=headers, media_type="application/json")
    normalized = normalize_text_value(decoded)
    return JSONResponse(content=normalized, status_code=response.status_code, headers=headers)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.middleware("http")
async def inject_auth_from_cookie(request: Request, call_next):
    if not request.headers.get("authorization"):
        analyst_token = request.cookies.get("analystToken")
        manager_token = request.cookies.get("managerToken")
        token = analyst_token or manager_token
        if token:
            headers = dict(request.scope["headers"])
            headers[b"authorization"] = f"Bearer {token}".encode()
            request.scope["headers"] = list(headers.items())
    return await call_next(request)


cors_origins = [origin.rstrip("/") for origin in ALLOWED_ORIGINS if origin]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

for router in all_routers:
    app.include_router(router)


async def background_task():
    while True:
        await perform_sync()
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)


@app.on_event("startup")
async def startup_event():
    if TESTING:
        return
    asyncio.create_task(background_task())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)