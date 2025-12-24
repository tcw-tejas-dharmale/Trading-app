from datetime import timedelta
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
# from sqlalchemy.orm import Session
from app.core import security, database
from app.core.config import settings
# from app.models.user import User
from app.schemas.user import Token, UserCreate, User as UserSchema
from jose import jwt, JWTError

router = APIRouter()
http_bearer = HTTPBearer()

# Mock In-Memory DB
FAKE_USERS_DB: Dict[str, dict] = {}

class MockUser:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

def _get_user_by_id(user_id: int):
    for user in FAKE_USERS_DB.values():
        if user.get("id") == user_id:
            return user
    return None

@router.post("/login/access-token", response_model=Token)
def login_access_token(db: Any = Depends(database.get_db), form_data: OAuth2PasswordRequestForm = Depends()) -> Any:
    # user = db.query(User).filter(User.email == form_data.username).first()
    user_data = FAKE_USERS_DB.get(form_data.username)
    if not user_data:
         # For demo purposes, allow admin/admin login if not signed up
         if form_data.username == "admin@example.com" and form_data.password == "admin":
             user_data = {"email": "admin@example.com", "hashed_password": security.get_password_hash("admin"), "is_active": True, "id": 1}
         else:
            raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    user = MockUser(**user_data)
    
    if not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token_expires = timedelta(minutes=security.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me", response_model=UserSchema)
def read_current_user(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)) -> Any:
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user = _get_user_by_id(int(user_id))
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

@router.post("/signup", response_model=UserSchema)
def create_user(
    *,
    db: Any = Depends(database.get_db),
    user_in: UserCreate,
) -> Any:
    # user = db.query(User).filter(User.email == user_in.email).first()
    if user_in.email in FAKE_USERS_DB:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system",
        )
    
    # user = User(
    #     email=user_in.email,
    #     hashed_password=security.get_password_hash(user_in.password),
    #     is_active=True,
    # )
    # db.add(user)
    # db.commit()
    # db.refresh(user)
    
    user_id = len(FAKE_USERS_DB) + 1
    new_user = {
        "id": user_id,
        "email": user_in.email,
        "name": user_in.name,
        "hashed_password": security.get_password_hash(user_in.password),
        "is_active": True
    }
    FAKE_USERS_DB[user_in.email] = new_user
    
    return new_user
