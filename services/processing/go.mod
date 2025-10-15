module github.com/dnasol/dna-platform/services/processing

go 1.21

require (
	github.com/dnasol/dna-platform/sdks/go-sdk v0.0.0
	github.com/segmentio/kafka-go v0.4.47
	github.com/stretchr/testify v1.8.4
	google.golang.org/protobuf v1.31.0
	gopkg.in/yaml.v3 v3.0.1
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/klauspost/compress v1.17.4 // indirect
	github.com/pierrec/lz4/v4 v4.1.19 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
)

replace github.com/dnasol/dna-platform/sdks/go-sdk => ./sdks/go-sdk
