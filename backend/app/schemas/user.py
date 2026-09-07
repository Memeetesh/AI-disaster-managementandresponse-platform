from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=128)
    # Self-registration can only ever create citizens. Responder/admin
    # accounts are provisioned by an existing admin (see /users endpoints,
    # phase 2+) — never trust a role claimed at signup.
    role: UserRole = UserRole.CITIZEN


class UserLogin(BaseModel):
    phone: str
    password: str


class UserCreate(BaseModel):
    """Admin-only provisioning of responder/admin accounts."""

    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.RESPONDER


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str
    email: str | None
    role: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
