# from sqlalchemy import create_engine
# from sqlalchemy.ext.declarative import declarative_base
# from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# engine = create_engine(settings.DATABASE_URL)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base = declarative_base()

# Mock Base
class Base:
    metadata = type('MockMetadata', (), {'create_all': lambda bind: None})

engine = None

def get_db():
    # db = SessionLocal()
    # try:
    #     yield db
    # finally:
    #     db.close()
    yield None
