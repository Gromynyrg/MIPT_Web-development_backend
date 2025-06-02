from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from .config import settings

DATABASE_URL = settings.ADMIN_DATABASE_URL
engine = create_engine(DATABASE_URL, echo=False)
SessionLocalAdmin = sessionmaker(autocommit=False, autoflush=False, bind=engine)
BaseAdmin = declarative_base()


def get_admin_db():
    db = SessionLocalAdmin()
    try:
        yield db
    finally:
        db.close()