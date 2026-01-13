from datetime import datetime, timedelta
import secrets
from typing import Any, Optional
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import ValidationError
from sqlalchemy.orm import Session
from app.core import security, database
from app.core.config import settings
from app.models.user import User
from app.models.oauth_account import OAuthAccount
from app.schemas.user import Token, UserCreate, UserUpdate, User as UserSchema, LoginRequest
from jose import jwt, JWTError

router = APIRouter()
http_bearer = HTTPBearer()

GOOGLE_PROVIDER = "google"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def _create_oauth_state(*, action: str, next_url: str, user_id: Optional[int] = None) -> str:
    payload: dict[str, Any] = {
        "action": action,
        "next": next_url,
        "nonce": secrets.token_urlsafe(16),
        "exp": int((datetime.utcnow() + timedelta(minutes=10)).timestamp()),
    }
    if user_id is not None:
        payload["user_id"] = user_id
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_oauth_state(state: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if not payload.get("action") or not payload.get("next"):
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        return payload
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")


def _safe_next_url(next_url: Optional[str]) -> str:
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    if not next_url:
        return f"{base}/dashboard"
    if next_url.startswith(base):
        return next_url
    return f"{base}/dashboard"


def _get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)) -> int:
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return int(user_id)
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


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

    if not user.hashed_password:
        raise HTTPException(status_code=400, detail="Password login is not available for this account. Use Google sign-in.")
    
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

    if not user.hashed_password:
        raise HTTPException(status_code=400, detail="Password login is not available for this account. Use Google sign-in.")

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


@router.get("/users/me/linked-accounts")
def read_linked_accounts(
    db: Session = Depends(database.get_db),
    user_id: int = Depends(_get_current_user_id),
) -> Any:
    accounts = db.query(OAuthAccount).filter(OAuthAccount.user_id == user_id).all()
    google = next((a for a in accounts if a.provider == GOOGLE_PROVIDER), None)
    return {
        "google": {
            "linked": bool(google),
            "email": google.email if google else None,
            "name": google.name if google else None,
            "picture_url": google.picture_url if google else None,
        }
    }

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
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system",
        )
    
    new_user = User(
        email=user_in.email,
        name=user_in.name,
        hashed_password=security.get_password_hash(user_in.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/oauth/google/login")
def google_login(next: Optional[str] = None) -> Any:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured on the server.")

    next_url = _safe_next_url(next)
    state = _create_oauth_state(action="login", next_url=next_url)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return {"url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.get("/oauth/google/link")
def google_link(
    next: Optional[str] = None,
    user_id: int = Depends(_get_current_user_id),
) -> Any:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured on the server.")

    next_url = _safe_next_url(next)
    state = _create_oauth_state(action="link", next_url=next_url, user_id=user_id)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "consent",
    }
    return {"url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.post("/oauth/google/unlink")
def google_unlink(
    db: Session = Depends(database.get_db),
    user_id: int = Depends(_get_current_user_id),
) -> Any:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.hashed_password:
        raise HTTPException(
            status_code=400,
            detail="Set a password before unlinking Google, otherwise you will be locked out.",
        )

    existing = (
        db.query(OAuthAccount)
        .filter(OAuthAccount.user_id == user_id, OAuthAccount.provider == GOOGLE_PROVIDER)
        .first()
    )
    if not existing:
        return {"unlinked": False}

    db.delete(existing)
    db.commit()
    return {"unlinked": True}


@router.get("/oauth/google/callback")
def google_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(database.get_db),
) -> Any:
    frontend_base = settings.FRONTEND_BASE_URL.rstrip("/")

    if error:
        return RedirectResponse(url=f"{frontend_base}/login?oauth_error={error}")
    if not code or not state:
        return RedirectResponse(url=f"{frontend_base}/login?oauth_error=missing_code")

    try:
        state_payload = _decode_oauth_state(state)
    except HTTPException:
        return RedirectResponse(url=f"{frontend_base}/login?oauth_error=invalid_state")

    next_url = _safe_next_url(state_payload.get("next"))
    action = state_payload.get("action")
    link_user_id = state_payload.get("user_id")

    token_response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    if token_response.status_code != 200:
        return RedirectResponse(url=f"{frontend_base}/login?oauth_error=token_exchange_failed")

    tokens = token_response.json()
    access_token = tokens.get("access_token")
    if not access_token:
        return RedirectResponse(url=f"{frontend_base}/login?oauth_error=missing_access_token")

    profile_response = requests.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if profile_response.status_code != 200:
        return RedirectResponse(url=f"{frontend_base}/login?oauth_error=profile_fetch_failed")

    profile = profile_response.json()
    provider_account_id = profile.get("sub")
    email = profile.get("email")
    name = profile.get("name") or email
    picture_url = profile.get("picture")

    if not provider_account_id or not email:
        return RedirectResponse(url=f"{frontend_base}/login?oauth_error=incomplete_profile")

    existing_oauth = (
        db.query(OAuthAccount)
        .filter(
            OAuthAccount.provider == GOOGLE_PROVIDER,
            OAuthAccount.provider_account_id == provider_account_id,
        )
        .first()
    )

    created = False
    if action == "link":
        if not link_user_id:
            return RedirectResponse(url=f"{frontend_base}/profile?oauth_error=missing_user")
        if existing_oauth and existing_oauth.user_id != int(link_user_id):
            return RedirectResponse(url=f"{frontend_base}/profile?oauth_error=already_linked")

        user = db.query(User).filter(User.id == int(link_user_id)).first()
        if not user:
            return RedirectResponse(url=f"{frontend_base}/profile?oauth_error=user_not_found")

        if not existing_oauth:
            existing_email_link = (
                db.query(OAuthAccount)
                .filter(
                    OAuthAccount.provider == GOOGLE_PROVIDER,
                    OAuthAccount.email == email,
                )
                .first()
            )
            if existing_email_link and existing_email_link.user_id != user.id:
                return RedirectResponse(url=f"{frontend_base}/profile?oauth_error=email_linked_elsewhere")

            new_oauth = OAuthAccount(
                user_id=user.id,
                provider=GOOGLE_PROVIDER,
                provider_account_id=provider_account_id,
                email=email,
                name=name,
                picture_url=picture_url,
            )
            db.add(new_oauth)
        else:
            existing_oauth.email = email
            existing_oauth.name = name
            existing_oauth.picture_url = picture_url
            db.add(existing_oauth)

        db.commit()
        join_char = "&" if "?" in next_url else "?"
        return RedirectResponse(url=f"{next_url}{join_char}linked=google")

    # action == "login"
    if existing_oauth:
        user = db.query(User).filter(User.id == existing_oauth.user_id).first()
        if not user:
            return RedirectResponse(url=f"{frontend_base}/login?oauth_error=user_not_found")
        existing_oauth.email = email
        existing_oauth.name = name
        existing_oauth.picture_url = picture_url
        db.add(existing_oauth)
        db.commit()
    else:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            created = True
            user = User(email=email, name=name, hashed_password=None)
            db.add(user)
            db.commit()
            db.refresh(user)

        existing_for_user = (
            db.query(OAuthAccount)
            .filter(OAuthAccount.user_id == user.id, OAuthAccount.provider == GOOGLE_PROVIDER)
            .first()
        )
        if existing_for_user:
            if existing_for_user.provider_account_id != provider_account_id:
                return RedirectResponse(url=f"{frontend_base}/login?oauth_error=google_already_linked")
            existing_for_user.email = email
            existing_for_user.name = name
            existing_for_user.picture_url = picture_url
            db.add(existing_for_user)
            db.commit()
        else:
            new_oauth = OAuthAccount(
                user_id=user.id,
                provider=GOOGLE_PROVIDER,
                provider_account_id=provider_account_id,
                email=email,
                name=name,
                picture_url=picture_url,
            )
            db.add(new_oauth)
            try:
                db.commit()
            except Exception:
                db.rollback()
                return RedirectResponse(url=f"{frontend_base}/login?oauth_error=account_link_failed")

    jwt_token = security.create_access_token(user.id, expires_delta=timedelta(minutes=security.settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    join_char = "&" if "?" in next_url else "?"
    created_flag = "1" if created else "0"
    return RedirectResponse(url=f"{next_url}{join_char}token={jwt_token}&created={created_flag}")
