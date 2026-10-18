from contextlib import asynccontextmanager
from pathlib import Path
import logging
import os

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from lib.falkor import GraphStore
from routers.agents import router as agents_router
from routers.graph import router as graph_router


ROOT_DIR = Path(__file__).parent

load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://graph-agent-console.preview.emergentagent.com",
]


def cors_origins() -> list[str]:
    extra = [
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", "").split(",")
        if origin.strip() and origin.strip() != "*"
    ]

    return list(dict.fromkeys(DEFAULT_CORS_ORIGINS + extra))


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.graph = GraphStore()

    yield

    await app.state.graph.close()


app = FastAPI(lifespan=lifespan)

api_router = APIRouter(prefix="/api")
api_router.include_router(graph_router)
api_router.include_router(agents_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    logger.warning("Request validation error: %s", exc.errors())
    return JSONResponse(
        status_code=400,
        content={"detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_handler(
    _request: Request,
    exc: Exception,
) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    logger.exception("Unhandled server error: %s", exc)
    return JSONResponse(
        status_code=400,
        content={
            "detail": f"{type(exc).__name__}: {exc}",
        },
    )


app.include_router(api_router)
