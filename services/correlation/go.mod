module github.com/dnasol/dna-platform/services/correlation

go 1.23.0

toolchain go1.24.9

require (
	github.com/dnasol/dna-platform/sdks/go-sdk v0.0.0
	github.com/prometheus/client_golang v1.17.0
	github.com/segmentio/kafka-go v0.4.47
	github.com/sirupsen/logrus v1.9.3
	github.com/stretchr/testify v1.8.4
	gopkg.in/yaml.v3 v3.0.1
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/golang/protobuf v1.5.3 // indirect
	github.com/klauspost/compress v1.15.9 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.4 // indirect
	github.com/pierrec/lz4/v4 v4.1.15 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/prometheus/client_model v0.4.1-0.20230718164431-9a2bf3000d16 // indirect
	github.com/prometheus/common v0.44.0 // indirect
	github.com/prometheus/procfs v0.11.1 // indirect
	golang.org/x/sys v0.13.0 // indirect
	google.golang.org/protobuf v1.31.0 // indirect
)

replace github.com/dnasol/dna-platform/sdks/go-sdk => ../../sdks/go-sdk
