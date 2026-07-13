from psycopg_pool import ConnectionPool
from pgvector.psycopg import register_vector

from .config import settings


def _dsn() -> str:
    # Prisma appends `?schema=public`, which libpq/psycopg doesn't understand.
    # Strip the query string; the default search_path already resolves `public`.
    return settings.database_url.split("?")[0]


def _configure(conn) -> None:
    # Teach psycopg how to read/write pgvector `vector` values on every connection.
    register_vector(conn)


pool = ConnectionPool(_dsn(), min_size=1, max_size=5, configure=_configure, open=True)
