package rules

import (
	"context"
	"fmt"
	"os"

	"github.com/dnasol/dna-platform/services/processing/internal/model"
	"github.com/dnasol/dna-platform/services/processing/internal/pipeline"
	"github.com/sashabaranov/go-openai"
)

// VectorizeOpenAIRule creates vector embeddings using OpenAI API
type VectorizeOpenAIRule struct {
	client      *openai.Client
	model       string
	dimensions  int
	inputField  string
	outputField string
}

// NewVectorizeOpenAIRule creates a new vectorization rule
func NewVectorizeOpenAIRule(args map[string]interface{}) (pipeline.Rule, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}

	inputField, ok := args["input_field"].(string)
	if !ok || inputField == "" {
		return nil, fmt.Errorf("input_field is required")
	}

	outputField, ok := args["output_field"].(string)
	if !ok || outputField == "" {
		return nil, fmt.Errorf("output_field is required")
	}

	// Get model (default to text-embedding-3-small)
	modelName := "text-embedding-3-small"
	if m, ok := args["model"].(string); ok && m != "" {
		modelName = m
	}

	// Get dimensions (default to 1536)
	dimensions := 1536
	if d, ok := args["dimensions"].(float64); ok {
		dimensions = int(d)
	} else if d, ok := args["dimensions"].(int); ok {
		dimensions = d
	}

	return &VectorizeOpenAIRule{
		client:      openai.NewClient(apiKey),
		model:       modelName,
		dimensions:  dimensions,
		inputField:  inputField,
		outputField: outputField,
	}, nil
}

// Type returns the rule type identifier
func (r *VectorizeOpenAIRule) Type() string {
	return "vectorize_openai"
}

// Name returns the rule name
func (r *VectorizeOpenAIRule) Name() string {
	return "vectorize_openai"
}

// Apply creates a vector embedding for the input text
func (r *VectorizeOpenAIRule) Apply(ctx context.Context, event *model.Event, config *model.RuleConfig) (*model.Event, error) {
	// Get input text
	value := getNestedField(event.Payload, r.inputField)
	if value == nil {
		return nil, fmt.Errorf("input field %s not found", r.inputField)
	}

	text, ok := value.(string)
	if !ok {
		return nil, fmt.Errorf("input field %s is not a string", r.inputField)
	}

	if text == "" {
		return nil, fmt.Errorf("input field %s is empty", r.inputField)
	}

	// Create embedding request
	req := openai.EmbeddingRequest{
		Input: []string{text},
		Model: openai.EmbeddingModel(r.model),
	}

	// Only set dimensions for models that support it
	if r.model == "text-embedding-3-small" || r.model == "text-embedding-3-large" {
		req.Dimensions = r.dimensions
	}

	// Call OpenAI API
	resp, err := r.client.CreateEmbeddings(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("OpenAI API error: %w", err)
	}

	if len(resp.Data) == 0 {
		return nil, fmt.Errorf("no embedding returned from OpenAI")
	}

	// Set output field with the embedding vector
	setNestedField(event.Payload, r.outputField, resp.Data[0].Embedding)

	return event, nil
}
