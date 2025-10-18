package mongo

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// IngestedEvent represents an event stored in MongoDB
type IngestedEvent struct {
	ID          primitive.ObjectID     `bson:"_id,omitempty"`
	EventID     string                 `bson:"event_id"`
	TenantID    string                 `bson:"tenant_id"`
	Type        string                 `bson:"type"`
	Source      interface{}            `bson:"source"`
	Payload     map[string]interface{} `bson:"payload"`
	Attributes  map[string]interface{} `bson:"attributes"`
	IngestedAt  time.Time              `bson:"ingested_at"`
	ProcessedAt time.Time              `bson:"processed_at"`
	CreatedAt   time.Time              `bson:"created_at"`
	UpdatedAt   time.Time              `bson:"updated_at"`
}

// Store handles MongoDB operations for ingestion service
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

	database := client.Database("ingestion")
	collection := database.Collection("events")

	// Create index on event_id for faster lookups
	indexModel := mongo.IndexModel{
		Keys:    bson.D{{Key: "event_id", Value: 1}},
		Options: options.Index().SetUnique(true),
	}
	collection.Indexes().CreateOne(ctx, indexModel)

	// Create index on ingested_at for time-based queries
	indexModel2 := mongo.IndexModel{
		Keys: bson.D{{Key: "ingested_at", Value: -1}},
	}
	collection.Indexes().CreateOne(ctx, indexModel2)

	return &Store{
		client:     client,
		database:   database,
		collection: collection,
	}, nil
}

// StoreEvent stores an ingested event in MongoDB
func (s *Store) StoreEvent(ctx context.Context, event *IngestedEvent) error {
	event.CreatedAt = time.Now()
	event.UpdatedAt = time.Now()
	event.IngestedAt = time.Now()

	_, err := s.collection.InsertOne(ctx, event)
	return err
}

// GetEvent retrieves an event by event_id
func (s *Store) GetEvent(ctx context.Context, eventID string) (*IngestedEvent, error) {
	var event IngestedEvent
	err := s.collection.FindOne(ctx, bson.M{"event_id": eventID}).Decode(&event)
	if err != nil {
		return nil, err
	}
	return &event, nil
}

// GetEventsByTimeRange retrieves events within a time range
func (s *Store) GetEventsByTimeRange(ctx context.Context, start, end time.Time, limit int64) ([]*IngestedEvent, error) {
	filter := bson.M{
		"ingested_at": bson.M{
			"$gte": start,
			"$lte": end,
		},
	}

	opts := options.Find().SetSort(bson.D{{Key: "ingested_at", Value: -1}})
	if limit > 0 {
		opts.SetLimit(limit)
	}

	cursor, err := s.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var events []*IngestedEvent
	if err := cursor.All(ctx, &events); err != nil {
		return nil, err
	}

	return events, nil
}

// UpdateEventProcessed marks an event as processed
func (s *Store) UpdateEventProcessed(ctx context.Context, eventID string) error {
	filter := bson.M{"event_id": eventID}
	update := bson.M{
		"$set": bson.M{
			"processed_at": time.Now(),
			"updated_at":   time.Now(),
		},
	}

	_, err := s.collection.UpdateOne(ctx, filter, update)
	return err
}

// GetStats returns ingestion statistics
func (s *Store) GetStats(ctx context.Context) (map[string]interface{}, error) {
	pipeline := []bson.M{
		{
			"$group": bson.M{
				"_id":          nil,
				"total_events": bson.M{"$sum": 1},
				"processed_events": bson.M{
					"$sum": bson.M{
						"$cond": bson.M{
							"if":   bson.M{"$ne": []interface{}{"$processed_at", nil}},
							"then": 1,
							"else": 0,
						},
					},
				},
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
			"total_events":     0,
			"processed_events": 0,
		}, nil
	}

	return map[string]interface{}{
		"total_events":     result[0]["total_events"],
		"processed_events": result[0]["processed_events"],
	}, nil
}

// Close closes the MongoDB connection
func (s *Store) Close(ctx context.Context) error {
	return s.client.Disconnect(ctx)
}
