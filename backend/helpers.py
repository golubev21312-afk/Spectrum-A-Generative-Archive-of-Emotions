import json
from models import EmotionOut


def build_emotion(
    row,
    liked_ids: set[int] = set(),
    reactions: dict | None = None,
    my_reactions: dict | None = None,
) -> EmotionOut:
    eid = row["id"]
    return EmotionOut(
        id=eid,
        parameters=json.loads(row["parameters"]),
        created_at=row["created_at"],
        username=row["username"],
        emotion_type=row["emotion_type"],
        likes_count=row["likes_count"],
        liked_by_me=eid in liked_ids,
        thumbnail=row["thumbnail"],
        views=row["views"] if "views" in row.keys() else 0,
        reactions=reactions.get(eid, {}) if reactions else {},
        my_reaction=my_reactions.get(eid) if my_reactions else None,
    )
