package ratelimit

import (
	"context"
	"sync"
	"time"
)

// TokenBucket implements a simple token bucket rate limiter
type TokenBucket struct {
	capacity   int64
	tokens     int64
	refillRate int64 // tokens per second
	lastRefill time.Time
	mu         sync.Mutex
}

// NewTokenBucket creates a new token bucket rate limiter
func NewTokenBucket(capacity, refillRate int64) *TokenBucket {
	return &TokenBucket{
		capacity:   capacity,
		tokens:     capacity, // Start with full bucket
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

// Allow checks if a request is allowed and consumes a token if available
func (tb *TokenBucket) Allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	// Refill tokens based on elapsed time
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill)
	tokensToAdd := int64(elapsed.Seconds() * float64(tb.refillRate))

	if tokensToAdd > 0 {
		tb.tokens = min(tb.capacity, tb.tokens+tokensToAdd)
		tb.lastRefill = now
	}

	// Check if we have tokens available
	if tb.tokens > 0 {
		tb.tokens--
		return true
	}

	return false
}

// AllowN checks if N requests are allowed and consumes N tokens if available
func (tb *TokenBucket) AllowN(n int64) bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	// Refill tokens based on elapsed time
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill)
	tokensToAdd := int64(elapsed.Seconds() * float64(tb.refillRate))

	if tokensToAdd > 0 {
		tb.tokens = min(tb.capacity, tb.tokens+tokensToAdd)
		tb.lastRefill = now
	}

	// Check if we have enough tokens
	if tb.tokens >= n {
		tb.tokens -= n
		return true
	}

	return false
}

// Wait blocks until a token is available
func (tb *TokenBucket) Wait(ctx context.Context) error {
	for {
		if tb.Allow() {
			return nil
		}

		// Calculate wait time until next token is available
		tb.mu.Lock()
		waitTime := time.Duration(float64(time.Second) / float64(tb.refillRate))
		tb.mu.Unlock()

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(waitTime):
			continue
		}
	}
}

// Stats returns current bucket statistics
func (tb *TokenBucket) Stats() (tokens int64, capacity int64, refillRate int64) {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	// Refill tokens based on elapsed time
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill)
	tokensToAdd := int64(elapsed.Seconds() * float64(tb.refillRate))

	if tokensToAdd > 0 {
		tb.tokens = min(tb.capacity, tb.tokens+tokensToAdd)
		tb.lastRefill = now
	}

	return tb.tokens, tb.capacity, tb.refillRate
}

// UpdateRate updates the refill rate (useful for dynamic configuration)
func (tb *TokenBucket) UpdateRate(newRate int64) {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.refillRate = newRate
}

// Reset resets the bucket to full capacity
func (tb *TokenBucket) Reset() {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.tokens = tb.capacity
	tb.lastRefill = time.Now()
}

// Helper function for min
func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
