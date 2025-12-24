from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routes import auth, market
from app.models import instrument # Import new models
from app.core.database import Base, engine

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Optimized CORS configuration for better security and performance
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Accept"],
        expose_headers=["Content-Length", "Content-Type"],
        max_age=3600,  # Cache preflight requests for 1 hour
    )
else:
    # Default CORS for development - more restrictive than before
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Only allow localhost in dev
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Accept"],
        expose_headers=["Content-Length", "Content-Type"],
        max_age=3600,
    )

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}", tags=["login"])
app.include_router(market.router, prefix=f"{settings.API_V1_STR}/market", tags=["market"])

@app.get("/")
def root():
    return {"message": "Welcome to Trading App API"}
