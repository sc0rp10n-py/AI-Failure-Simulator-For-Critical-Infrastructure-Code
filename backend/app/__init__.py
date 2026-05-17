from flask import Flask
from flask_cors import CORS

from app.config import settings
from app.logging.structured import get_logger
from app.models.db import init_db
from app.routes.api import api_bp
from app.services.session_service import ensure_session_middleware

logger = get_logger("app")


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = settings.SESSION_SECRET
    app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

    CORS(
        app,
        origins=settings.CORS_ORIGINS,
        supports_credentials=True,
        allow_headers=["Content-Type"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    init_db()
    ensure_session_middleware(app)
    app.register_blueprint(api_bp)

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "sentinel-backend"}

    logger.info("Sentinel backend initialized", extra={"event": "startup"})
    return app
