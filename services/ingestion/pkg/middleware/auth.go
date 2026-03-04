package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/dnasol/dna-platform/services/ingestion/pkg/auth"
	"github.com/dnasol/dna-platform/services/ingestion/pkg/mongo"
)

// ContextKey type for context keys
type ContextKey string

const (
	// ContextKeyAgentID is the context key for agent ID
	ContextKeyAgentID ContextKey = "agent_id"
	// ContextKeyOrgID is the context key for organization ID
	ContextKeyOrgID ContextKey = "org_id"
	// ContextKeyDataSourceID is the context key for data source ID
	ContextKeyDataSourceID ContextKey = "data_source_id"
)

// APIKeyMiddleware validates API-key from header
func APIKeyMiddleware(store *mongo.Store) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiKey := r.Header.Get("X-API-Key")
			if apiKey == "" {
				http.Error(w, "Missing X-API-Key header", http.StatusUnauthorized)
				return
			}

			// Validate API key
			_, org, err := auth.ValidateAPIKey(r.Context(), store, apiKey)
			if err != nil {
				http.Error(w, "Invalid API key", http.StatusUnauthorized)
				return
			}

			// Add organization ID to context
			ctx := context.WithValue(r.Context(), ContextKeyOrgID, org.ID.Hex())
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// JWTMiddleware validates JWT token from Authorization header
func JWTMiddleware() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if JWT validation is disabled
			disableJWT := os.Getenv("DISABLE_JWT_VALIDATION")
			ctx := r.Context()

			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				// Extract token
				parts := strings.Split(authHeader, " ")
				if len(parts) == 2 && parts[0] == "Bearer" {
					tokenString := parts[1]

					if disableJWT == "true" {
						// Parse token without validation (for development)
						claims, err := auth.ParseJWTWithoutValidation(tokenString)
						if err == nil {
							// Add claims to context even if validation is disabled
							ctx = context.WithValue(ctx, ContextKeyAgentID, claims.AgentID)
							ctx = context.WithValue(ctx, ContextKeyOrgID, claims.OrgID)
							ctx = context.WithValue(ctx, ContextKeyDataSourceID, claims.DataSourceID)
						}
					} else {
						// Validate JWT
						claims, err := auth.ValidateJWT(tokenString)
						if err != nil {
							http.Error(w, "Invalid token: "+err.Error(), http.StatusUnauthorized)
							return
						}

						// Add claims to context
						ctx = context.WithValue(ctx, ContextKeyAgentID, claims.AgentID)
						ctx = context.WithValue(ctx, ContextKeyOrgID, claims.OrgID)
						ctx = context.WithValue(ctx, ContextKeyDataSourceID, claims.DataSourceID)
					}
				}
			}

			// If validation is disabled and no token provided, pass through without context values
			if disableJWT == "true" {
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// If validation is enabled, require token
			if authHeader == "" {
				http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
