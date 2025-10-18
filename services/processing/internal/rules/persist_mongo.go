package rules

import (
	"context"
	"fmt"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// PersistMongoRule persists events to MongoDB
type PersistMongoRule struct {
	client     *mongo.Client
	database   string
	collection string
}

// NewPersistMongoRule creates a new persist_mongo rule
func NewPersistMongoRule(args map[string]interface{}) (pipeline.Rule, error) {
	// These will be injected at runtime
	return &PersistMongoRule{
		database:   "dna",
		collection: "events",
	}, nil
}

// SetClient sets the MongoDB client (for dependency injection)
func (r *PersistMongoRule) SetClient(client *mongo.Client) {
	r.client = client
}

// SetCollection sets the collection name
func (r *PersistMongoRule) SetCollection(collection string) {
	r.collection = collection
}

func (r *PersistMongoRule) Name() string {
	return "persist_mongo"
}

func (r *PersistMongoRule) Type() string {
	return "persist_mongo"
}

func (r *PersistMongoRule) Apply(ctx context.Context, event *model.Event, cfg *model.RuleConfig) (*model.Event, error) {
	if r.client == nil {
		return event, fmt.Errorf("mongo client not configured")
	}

	coll := r.client.Database(r.database).Collection(r.collection)

	// Prepare document
	doc := bson.M{
		"event_id":   event.EventID,
		"tenant_id":  event.TenantID,
		"timestamp":  event.Timestamp,
		"kind":       string(event.Kind),
		"source":     event.Source,
		"payload":    event.Payload,
		"attributes": event.Attributes,
	}

	// Upsert by event_id
	filter := bson.M{"event_id": event.EventID}
	opts := options.Update().SetUpsert(true)

	_, err := coll.UpdateOne(ctx, filter, bson.M{"$set": doc}, opts)
	if err != nil {
		return event, fmt.Errorf("failed to persist to mongo: %w", err)
	}

	// Mark as persisted
	event.Attributes["persisted_mongo"] = true

	return event, nil
}
