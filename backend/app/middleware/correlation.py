from flask import Flask, g, request

from app.logging.structured import get_logger, new_correlation_id

logger = get_logger("http")


def register_correlation_middleware(app: Flask) -> None:
    @app.before_request
    def attach_correlation():
        g.correlation_id = request.headers.get("X-Correlation-ID") or new_correlation_id()

    @app.after_request
    def echo_correlation(response):
        if hasattr(g, "correlation_id"):
            response.headers["X-Correlation-ID"] = g.correlation_id
        return response
