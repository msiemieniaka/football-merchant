"""
Redis Cache Module for Football AI Backend

Provides caching functionality for API endpoints to reduce database load
and improve response times.
"""

import os
import json
import functools
from typing import Optional, Any, Callable
import redis
from datetime import datetime

# Redis configuration from environment
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL = int(os.getenv("CACHE_TTL", "300"))  # 5 minutes default
CACHE_ENABLED = os.getenv("CACHE_ENABLED", "true").lower() == "true"

# Redis client (lazy initialization)
_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> Optional[redis.Redis]:
    """Get or create Redis client connection."""
    global _redis_client
    
    if not CACHE_ENABLED:
        return None
    
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            # Test connection
            _redis_client.ping()
            print(f"[Cache] Connected to Redis at {REDIS_URL}")
        except redis.RedisError as e:
            print(f"[Cache] Failed to connect to Redis: {e}")
            _redis_client = None
    
    return _redis_client


def cache_key(prefix: str, *args, **kwargs) -> str:
    """Generate a cache key from prefix and arguments."""
    parts = [prefix]
    parts.extend(str(a) for a in args)
    parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()))
    return ":".join(parts)


def get_cache(key: str) -> Optional[Any]:
    """Get value from cache."""
    client = get_redis_client()
    if client is None:
        return None
    
    try:
        data = client.get(key)
        if data:
            return json.loads(data)
    except (redis.RedisError, json.JSONDecodeError) as e:
        print(f"[Cache] Get error for {key}: {e}")
    
    return None


def set_cache(key: str, value: Any, ttl: int = None) -> bool:
    """Set value in cache with TTL."""
    client = get_redis_client()
    if client is None:
        return False
    
    try:
        ttl = ttl or CACHE_TTL
        client.setex(key, ttl, json.dumps(value, default=str))
        return True
    except (redis.RedisError, TypeError) as e:
        print(f"[Cache] Set error for {key}: {e}")
        return False


def delete_cache(pattern: str) -> int:
    """Delete cache keys matching pattern."""
    client = get_redis_client()
    if client is None:
        return 0
    
    try:
        keys = client.keys(pattern)
        if keys:
            return client.delete(*keys)
    except redis.RedisError as e:
        print(f"[Cache] Delete error for pattern {pattern}: {e}")
    
    return 0


def invalidate_matches_cache():
    """Invalidate all matches-related cache."""
    deleted = delete_cache("matches:*")
    print(f"[Cache] Invalidated {deleted} matches cache entries")
    return deleted


def invalidate_table_cache():
    """Invalidate all table-related cache."""
    deleted = delete_cache("table:*")
    print(f"[Cache] Invalidated {deleted} table cache entries")
    return deleted


def invalidate_all_cache():
    """Invalidate all cache."""
    deleted = delete_cache("*")
    print(f"[Cache] Invalidated {deleted} total cache entries")
    return deleted


def cached(prefix: str, ttl: int = None):
    """
    Decorator to cache function results.
    
    Usage:
        @cached("matches", ttl=300)
        def get_matches():
            return db.query(...)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Skip db argument for cache key
            cache_args = args[1:] if args and hasattr(args[0], 'query') else args
            key = cache_key(prefix, *cache_args, **kwargs)
            
            # Try to get from cache
            cached_value = get_cache(key)
            if cached_value is not None:
                print(f"[Cache] HIT for {key}")
                return cached_value
            
            # Cache miss - execute function
            print(f"[Cache] MISS for {key}")
            result = func(*args, **kwargs)
            
            # Store in cache
            set_cache(key, result, ttl)
            
            return result
        return wrapper
    return decorator


def get_cache_stats() -> dict:
    """Get cache statistics."""
    client = get_redis_client()
    if client is None:
        return {"status": "disabled", "connected": False}
    
    try:
        info = client.info("stats")
        memory = client.info("memory")
        return {
            "status": "enabled",
            "connected": True,
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
            "memory_used": memory.get("used_memory_human", "unknown"),
            "keys": client.dbsize()
        }
    except redis.RedisError as e:
        return {"status": "error", "connected": False, "error": str(e)}
