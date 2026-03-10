import json
from models import EmotionOut


def build_emotion(row, liked_ids: set[int] = set()) -> EmotionOut:
    return EmotionOut(
        id=row["id"],
        parameters=json.loads(row["parameters"]),
        created_at=row["created_at"],
        username=row["username"],
        emotion_type=row["emotion_type"],
        likes_count=row["likes_count"],
        liked_by_me=row["id"] in liked_ids,
        thumbnail=row["thumbnail"],
        views=row["views"] if "views" in row.keys() else 0,
    )
