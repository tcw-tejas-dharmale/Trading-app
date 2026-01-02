from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import ValidationError
from sqlalchemy.orm import Session
from app.core import security, database
from app.core.config import settings
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserUpdate, User as UserSchema, LoginRequest
from jose import jwt, JWTError

router = APIRouter()
http_bearer = HTTPBearer()

@router.post("/login/access-token", response_model=Token, include_in_schema=False)
async def login_access_token(request: Request, db: Session = Depends(database.get_db)) -> Any:
    login_in = None
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            payload = await request.json()
            login_in = LoginRequest(**payload)
        except (ValidationError, ValueError):
            login_in = None
    elif "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        email = form.get("email") or form.get("username")
        password = form.get("password")
        try:
            login_in = LoginRequest(email=email, password=password)
        except ValidationError:
            login_in = None

    if not login_in:
        raise HTTPException(status_code=422, detail="Invalid login payload. Provide email and password.")

    user = db.query(User).filter(User.email == login_in.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not security.verify_password(login_in.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    access_token_expires = timedelta(minutes=security.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login_user(login_in: LoginRequest, db: Session = Depends(database.get_db)) -> Any:
    user = db.query(User).filter(User.email == login_in.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if not security.verify_password(login_in.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    access_token_expires = timedelta(minutes=security.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me", response_model=UserSchema)
def read_current_user(
    db: Session = Depends(database.get_db),
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
) -> Any:
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

@router.put("/users/me", response_model=UserSchema)
def update_current_user(
    *,
    db: Session = Depends(database.get_db),
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    user_in: UserUpdate,
) -> Any:
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if user_in.email and user_in.email != user.email:
            existing_user = db.query(User).filter(User.email == user_in.email).first()
            if existing_user:
                raise HTTPException(status_code=400, detail="Email already in use")
            user.email = user_in.email

        if user_in.name:
            user.name = user_in.name

        if user_in.current_password and not user_in.new_password:
            raise HTTPException(status_code=400, detail="New password required")

        if user_in.new_password:
            if not user_in.current_password:
                raise HTTPException(status_code=400, detail="Current password required")
            if not security.verify_password(user_in.current_password, user.hashed_password):
                raise HTTPException(status_code=400, detail="Incorrect current password")
            user.hashed_password = security.get_password_hash(user_in.new_password)

        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

@router.post("/signup", response_model=UserSchema)
def create_user(
    *,
    db: Session = Depends(database.get_db),
    user_in: UserCreate,
) -> Any:
    # user = db.query(User).filter(User.email == user_in.email).first()
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
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
    
    new_user = User(
        email=user_in.email,
        name=user_in.name,
        hashed_password=security.get_password_hash(user_in.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
