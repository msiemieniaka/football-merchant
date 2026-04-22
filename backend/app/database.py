import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Get DB URL from .env (Docker passes this automatically)
# Connection goes through PgBouncer for connection pooling
DATABASE_URL = os.getenv("DATABASE_URL")

# Create the engine with optimized pool settings for PgBouncer
# Since PgBouncer handles connection pooling, we use smaller pool on app side
engine = create_engine(
    DATABASE_URL,
    # Connection pool settings optimized for PgBouncer
    pool_size=5,           # Smaller pool since PgBouncer manages connections
    max_overflow=10,       # Allow 10 additional connections under load
    pool_timeout=30,       # Wait 30s for connection from pool
    pool_recycle=1800,     # Recycle connections every 30 min
    pool_pre_ping=True,    # Verify connection health before use
    # Echo SQL for debugging (disable in production)
    echo=os.getenv("SQL_DEBUG", "false").lower() == "true"
)

# Create a SessionLocal class. Each instance will be a database session.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our models
Base = declarative_base()

# Dependency to get DB session in FastAPI endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()