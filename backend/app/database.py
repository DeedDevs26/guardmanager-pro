from __future__ import annotations

import gc
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .config import PATHS, ensure_directories

ensure_directories()

engine = create_engine(
    f"sqlite:///{PATHS.database_file.as_posix()}",
    connect_args={"check_same_thread": False},
    future=True,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Iterator[Session]:
    with session_scope() as session:
        yield session


def close_engine() -> None:
    """Disposes the engine and its pool to release all connection handles.
    Essential on Windows before performing file-level operations on the DB.
    """
    engine.dispose()
    if hasattr(engine, "pool"):
        engine.pool.dispose()
    gc.collect()  # Force cleanup of any unclosed connection objects


def reinit_database() -> None:
    """Completely disposes of the old engine, creates a new one,
    and reconfigures SessionLocal to bind to it.
    """
    global engine, SessionLocal
    close_engine()

    engine = create_engine(
        f"sqlite:///{PATHS.database_file.as_posix()}",
        connect_args={"check_same_thread": False},
        future=True,
    )

    # Re-register event listeners on the new engine
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    SessionLocal.configure(bind=engine)

