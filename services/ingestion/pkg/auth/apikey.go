package auth

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/dnasol/dna-platform/services/ingestion/pkg/mongo"
)

// ValidateAPIKey validates API key and returns the APIKey and Organization
func ValidateAPIKey(ctx context.Context, store *mongo.Store, apiKey string) (*mongo.APIKey, *mongo.Organization, error) {
	// Hash the API key to match stored hash
	// Note: In practice, you'd hash the incoming key and compare
	// For now, we'll assume the key is already hashed in the DB for simplicity
	// In production, hash the plain key and store the hash in DB

	return store.ValidateAPIKey(ctx, apiKey)
}

// HashAPIKey hashes API key with bcrypt
func HashAPIKey(apiKey string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(apiKey), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// CompareAPIKey compares a plain API key with a hashed one
func CompareAPIKey(hashedKey, plainKey string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashedKey), []byte(plainKey))
}

// JWTClaims represents the JWT claims
type JWTClaims struct {
	AgentID      string `json:"agent_id"`
	OrgID        string `json:"org_id"`
	DataSourceID string `json:"data_source_id"`
	jwt.RegisteredClaims
}

// GenerateJWT generates JWT token for agent
func GenerateJWT(agentID, orgID, dataSourceID string, expiry time.Duration) (string, error) {
	secret := getJWTSecret()

	claims := JWTClaims{
		AgentID:      agentID,
		OrgID:        orgID,
		DataSourceID: dataSourceID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "dna-pulse-ingestion",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateJWT validates JWT token and returns claims
func ValidateJWT(tokenString string) (*JWTClaims, error) {
	secret := getJWTSecret()

	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}

// ParseJWTWithoutValidation parses JWT token without signature validation (for development)
func ParseJWTWithoutValidation(tokenString string) (*JWTClaims, error) {
	// Use jwt.ParseUnverified to skip signature validation
	token, _, err := new(jwt.Parser).ParseUnverified(tokenString, &JWTClaims{})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}

// getJWTSecret retrieves JWT secret from environment
func getJWTSecret() string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-secret-key-change-in-production"
	}
	return secret
}
