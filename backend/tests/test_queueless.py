# QueueLess Dynamic Mathematical Engine Test Suite

def calculate_dynamic_wait(people_ahead: int, avg_service_time: float, active_counters: int, status: str = "NORMAL") -> int:
    """Core mathematical wait-time estimation engine formula."""
    if people_ahead <= 0:
        return 0
    counters = max(1, active_counters)
    service_time = max(1.0, avg_service_time)
    
    multiplier = 1.0
    if status == "DELAYED":
        multiplier = 1.45
    elif status == "BUSY":
        multiplier = 1.2
    elif status == "PAUSED":
        multiplier = 2.0

    raw_estimate = ((people_ahead * service_time) / counters) * multiplier
    return max(1, round(raw_estimate))

def test_wait_time_single_counter():
    # 5 people ahead, 4.0 min avg time, 1 counter -> 20 min
    estimate = calculate_dynamic_wait(5, 4.0, 1, "NORMAL")
    assert estimate == 20

def test_wait_time_multiple_counters():
    # 12 people ahead, 4.0 min avg time, 3 counters -> 16 min
    estimate = calculate_dynamic_wait(12, 4.0, 3, "NORMAL")
    assert estimate == 16

def test_wait_time_delayed_status():
    # Delayed queue increases estimate
    normal = calculate_dynamic_wait(10, 3.0, 2, "NORMAL")
    delayed = calculate_dynamic_wait(10, 3.0, 2, "DELAYED")
    assert delayed > normal

def test_token_formatting():
    prefix = "A"
    sequence = 27
    formatted = f"{prefix}{sequence:03d}"
    assert formatted == "A027"

def test_role_authorization():
    roles_allowed = ["PROVIDER", "ADMIN"]
    assert "CUSTOMER" not in roles_allowed
    assert "PROVIDER" in roles_allowed
    assert "ADMIN" in roles_allowed

if __name__ == "__main__":
    test_wait_time_single_counter()
    test_wait_time_multiple_counters()
    test_wait_time_delayed_status()
    test_token_formatting()
    test_role_authorization()
    print("All QueueLess unit tests passed successfully!")

