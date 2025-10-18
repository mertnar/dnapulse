package processing_test

import "testing"

func TestBasic(t *testing.T) {
	if 5 != 2+3 {
		t.Fatal("basic math failed")
	}
}
