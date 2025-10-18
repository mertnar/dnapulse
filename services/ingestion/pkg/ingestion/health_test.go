package ingestion_test

import "testing"

func TestBasic(t *testing.T) {
	if 3 != 1+2 {
		t.Fatal("basic math failed")
	}
}
