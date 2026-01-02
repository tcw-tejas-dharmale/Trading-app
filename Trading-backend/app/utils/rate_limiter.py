import time
from collections import defaultdict, deque
from fastapi import HTTPException, status


class SimpleRateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._requests = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.time()
        queue = self._requests[key]
        while queue and queue[0] <= now - self.window_seconds:
            queue.popleft()
        if len(queue) >= self.limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please wait a moment and try again.",
            )
        queue.append(now)

