"""Browsertests bruger deres egen MariaDB-database."""
import signal
import sys
from pathlib import Path
from waitress import serve

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from backend.app import create_app
from backend.seed import seed_database
from backend.tests.database import test_database


def stop_server(signum, frame):
    raise SystemExit(0)


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, stop_server)
    signal.signal(signal.SIGINT, stop_server)
    with test_database() as config:
        app = create_app(config)
        with app.app_context():
            seed_database()
        serve(app, host='127.0.0.1', port=5003)
