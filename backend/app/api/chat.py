from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse
from app.services import chat as chat_service

router = APIRouter(tags=["chat"])


@router.post("/chat/support", response_model=ChatResponse)
async def support_chat(
    payload: ChatRequest,
    _current_user: User = Depends(get_current_user),
) -> ChatResponse:
    """The citizen app's "Talk to Someone" companion. The LLM key stays
    server-side; with no key configured this returns a fixed supportive
    reply + helplines. Never errors the client."""
    messages = [{"role": m.role, "content": m.content} for m in payload.messages]
    reply, source = await chat_service.support_reply(messages)
    return ChatResponse(reply=reply, source=source)
