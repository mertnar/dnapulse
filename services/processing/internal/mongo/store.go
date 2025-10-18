package mongo

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ProcessedEvent represents a processed event stored in MongoDB
type ProcessedEvent struct {
	ID              primitive.ObjectID     `bson:"_id,omitempty"`
	EventID         string                 `bson:"event_id"`
	TenantID        string                 `bson:"tenant_id"`
	OriginalEvent   map[string]interface{} `bson:"original_event"`
	ProcessedEvent  map[string]interface{} `bson:"processed_event"`
	ProcessingRules []string               `bson:"processing_rules"`
	ProcessingTime  time.Time              `bson:"processing_time"`
	Duration        int64                  `bson:"duration_ms"`
	Status          string                 `bson:"status"`
	Error           string                 `bson:"error,omitempty"`
	CreatedAt       time.Time              `bson:"created_at"`
	UpdatedAt       time.Time              `bson:"updated_at"`
}

// Store handles MongoDB operations for processing service
type Store struct {
	client     *mongo.Client
	database   *mongo.Database
	collection *mongo.Collection
}

// NewStore creates a new MongoDB store
func NewStore(mongoURL string) (*Store, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURL))
	if err != nil {
		return nil, err
	}

	// Test connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}

	database := client.Database("processing")
	collection := database.Collection("processed_events")

	// Create index on event_id for faster lookups
	indexModel := mongo.IndexModel{
		Keys:    bson.D{{Key: "event_id", Value: 1}},
		Options: options.Index().SetUnique(true),
	}
	collection.Indexes().CreateOne(ctx, indexModel)

	// Create index on processing_time for time-based queries
	indexModel2 := mongo.IndexModel{
		Keys: bson.D{{Key: "processing_time", Value: -1}},
	}
	collection.Indexes().CreateOne(ctx, indexModel2)

	return &Store{
		client:     client,
		database:   database,
		collection: collection,
	}, nil
}

// StoreProcessedEvent stores a processed event in MongoDB
func (s *Store) StoreProcessedEvent(ctx context.Context, event *ProcessedEvent) error {
	event.CreatedAt = time.Now()
	event.UpdatedAt = time.Now()
	event.ProcessingTime = time.Now()

	_, err := s.collection.InsertOne(ctx, event)
	return err
}

// GetProcessedEvent retrieves a processed event by event_id
func (s *Store) GetProcessedEvent(ctx context.Context, eventID string) (*ProcessedEvent, error) {
	var event ProcessedEvent
	err := s.collection.FindOne(ctx, bson.M{"event_id": eventID}).Decode(&event)
	if err != nil {
		return nil, err
	}
	return &event, nil
}

// GetProcessedEventsByTimeRange retrieves processed events within a time range
func (s *Store) GetProcessedEventsByTimeRange(ctx context.Context, start, end time.Time, limit int64) ([]*ProcessedEvent, error) {
	filter := bson.M{
		"processing_time": bson.M{
			"$gte": start,
			"$lte": end,
		},
	}

	opts := options.Find().SetSort(bson.D{{Key: "processing_time", Value: -1}})
	if limit > 0 {
		opts.SetLimit(limit)
	}

	cursor, err := s.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var events []*ProcessedEvent
	if err := cursor.All(ctx, &events); err != nil {
		return nil, err
	}

	return events, nil
}

// GetStats returns processing statistics
func (s *Store) GetStats(ctx context.Context) (map[string]interface{}, error) {
	pipeline := []bson.M{
		{
			"$group": bson.M{
				"_id":             nil,
				"total_processed": bson.M{"$sum": 1},
				"successful_processed": bson.M{
					"$sum": bson.M{
						"$cond": bson.M{
							"if":   bson.M{"$eq": []interface{}{"$status", "success"}},
							"then": 1,
							"else": 0,
						},
					},
				},
				"failed_processed": bson.M{
					"$sum": bson.M{
						"$cond": bson.M{
							"if":   bson.M{"$eq": []interface{}{"$status", "error"}},
							"then": 1,
							"else": 0,
						},
					},
				},
				"avg_duration": bson.M{"$avg": "$duration_ms"},
			},
		},
	}

	cursor, err := s.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var result []bson.M
	if err := cursor.All(ctx, &result); err != nil {
		return nil, err
	}

	if len(result) == 0 {
		return map[string]interface{}{
			"total_processed":      0,
			"successful_processed": 0,
			"failed_processed":     0,
			"avg_duration":         0,
		}, nil
	}

	return map[string]interface{}{
		"total_processed":      result[0]["total_processed"],
		"successful_processed": result[0]["successful_processed"],
		"failed_processed":     result[0]["failed_processed"],
		"avg_duration":         result[0]["avg_duration"],
	}, nil
}

// Close closes the MongoDB connection
func (s *Store) Close(ctx context.Context) error {
	return s.client.Disconnect(ctx)
}
