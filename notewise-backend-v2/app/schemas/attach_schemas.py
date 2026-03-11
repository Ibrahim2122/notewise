from pydantic import BaseModel, AnyUrl

class AttachTextIn(BaseModel):
    text: str

class AttachLinkIn(BaseModel):
    url: AnyUrl