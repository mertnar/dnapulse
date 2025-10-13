module github.com/dnasol/dna-platform/services/ingestion

go 1.21

require (
	github.com/dnasol/dna-platform/sdks/go-sdk v0.0.0
	github.com/golang-jwt/jwt/v5 v5.2.0
	github.com/segmentio/kafka-go v0.4.47
	google.golang.org/protobuf v1.31.0
)

require (
	github.com/klauspost/compress v1.17.4 // indirect
	github.com/pierrec/lz4/v4 v4.1.19 // indirect
)

replace github.com/dnasol/dna-platform/sdks/go-sdk => ../../sdks/go-sdk
