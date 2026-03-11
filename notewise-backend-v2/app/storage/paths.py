import uuid

def source_blob_path(*, user_id: str, workspace_id: uuid.UUID, source_id: uuid.UUID, ext: str) -> str:
    ext = ext.lower().lstrip(".")
    return f"users/{user_id}/workspaces/{workspace_id}/sources/{source_id}.{ext}"