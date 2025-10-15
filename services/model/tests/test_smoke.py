def test_basic_math():
    assert 2 + 2 == 4

def test_imports():
    # Test that main modules can be imported
    try:
        from app.main import app
        assert app is not None
    except ImportError as e:
        # If imports fail, that's also useful to know
        print(f"Import test failed: {e}")
        assert False, f"Failed to import app.main: {e}"
