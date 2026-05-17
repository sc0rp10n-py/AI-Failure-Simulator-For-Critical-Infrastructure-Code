import secrets
from functools import wraps

from flask import g, request

from app.models.db import SessionLocal, UserSession


def ensure_session_middleware(app):
    @app.before_request
    def attach_session():
        token = request.cookies.get("sentinel_session")
        db = SessionLocal()
        try:
            if token:
                session = db.query(UserSession).filter_by(token=token).first()
                if session:
                    g.session = session
                    g.db = db
                    return
            session = UserSession(token=secrets.token_urlsafe(32))
            db.add(session)
            db.commit()
            db.refresh(session)
            g.session = session
            g.db = db
            g._set_session_cookie = True
        except Exception:
            db.close()
            raise

    @app.after_request
    def persist_session_cookie(response):
        if getattr(g, "_set_session_cookie", False) and getattr(g, "session", None):
            response.set_cookie(
                "sentinel_session",
                g.session.token,
                httponly=True,
                samesite="Lax",
                secure=False,
                max_age=60 * 60 * 24 * 30,
            )
        if hasattr(g, "db"):
            g.db.close()
        return response


def with_db(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not hasattr(g, "db"):
            g.db = SessionLocal()
            close_after = True
        else:
            close_after = False
        try:
            return view(*args, **kwargs)
        finally:
            if close_after:
                g.db.close()

    return wrapper
