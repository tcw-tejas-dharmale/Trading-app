from pydantic import BaseModel, EmailStr, constr
from typing import Optional

class UserBase(BaseModel):
    name: str
    email: EmailStr

class UserCreate(UserBase):
    password: constr(min_length=8, max_length=72)

class User(UserBase):
    id: int

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[constr(min_length=8, max_length=72)] = None
    new_password: Optional[constr(min_length=8, max_length=72)] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
