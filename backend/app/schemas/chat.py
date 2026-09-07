from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=24)


class ChatResponse(BaseModel):
    reply: str
    # "llm"      -> answer from the configured model
    # "fallback" -> no LLM_API_KEY configured
    # "error"    -> model call failed / was blocked; safe canned reply
    source: Literal["llm", "fallback", "error"]
