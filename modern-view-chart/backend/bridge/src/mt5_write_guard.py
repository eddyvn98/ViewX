WRITE_FINGERPRINT_FIELDS = (
    "command",
    "symbol",
    "ticket",
    "order_type",
    "type",
    "volume",
    "quantity",
    "sl",
    "tp",
    "price",
    "is_market",
    "magic",
    "comment",
)


def _normalize(value):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float, bool)):
        return value
    return str(value).strip()


def build_write_fingerprint(data):
    normalized = {
        field: _normalize(data.get(field))
        for field in WRITE_FINGERPRINT_FIELDS
    }
    normalized["command"] = str(data.get("command") or "").strip().lower()
    return tuple((field, normalized[field]) for field in WRITE_FINGERPRINT_FIELDS)
