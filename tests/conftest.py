import os
import tempfile
from pathlib import Path

# Point the app at throwaway SQLite files *before* importing it — the module
# creates an `app = create_app()` at import time, which would otherwise touch
# the real data/*.db files.
_BOOTSTRAP_DIR = Path(tempfile.mkdtemp(prefix="findmydesk-pytest-bootstrap-"))
os.environ.setdefault("DESK_DATABASE_URL", f"sqlite:///{_BOOTSTRAP_DIR / 'desks.db'}")
os.environ.setdefault("USER_DATABASE_URL", f"sqlite:///{_BOOTSTRAP_DIR / 'users.db'}")
os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")

import pytest

from App.app import create_app
from App.extensions import db
from App.models import AppUser, Desk


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv("DESK_DATABASE_URL", f"sqlite:///{tmp_path / 'desks.db'}")
    monkeypatch.setenv("USER_DATABASE_URL", f"sqlite:///{tmp_path / 'users.db'}")
    flask_app = create_app()
    flask_app.config["TESTING"] = True
    return flask_app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def seed_user(app):
    with app.app_context():
        user = AppUser(
            id="alice@example.com",
            full_name="Alice Tester",
            email="alice@example.com",
            desk_preferences=[],
            preferred_users=[],
            anchor_days=[],
        )
        db.session.add(user)
        db.session.commit()
    return {"email": "alice@example.com", "name": "Alice Tester"}


@pytest.fixture
def seed_desk(app):
    with app.app_context():
        desk = Desk(
            id="ground-001",
            floor="ground",
            zone="north",
            x_percent=10,
            y_percent=20,
            near_window=True,
            features=["monitor"],
        )
        db.session.add(desk)
        db.session.commit()
    return "ground-001"
