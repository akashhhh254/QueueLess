import uuid
from datetime import datetime, timezone
from backend.app.database import engine, SessionLocal
from backend.app.models import (
    Base, ServiceLocation, Service, Queue, Counter,
    LocationType, QueueStatus
)

def seed_database():
    """Initializes schema and seeds realistic baseline institutions and counters."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if db.query(ServiceLocation).count() > 0:
            print("[QueueLess Seed] Database already contains records. Skipping seed.")
            return

        print("[QueueLess Seed] Populating real institutional queue structures...")

        hospital = ServiceLocation(
            id=f"loc_{uuid.uuid4().hex[:8]}",
            name="Metropolitan General Hospital",
            address="742 Healthcare Boulevard",
            city="Metro City",
            state="CA",
            type=LocationType.HOSPITAL,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(hospital)

        service_opd = Service(
            id=f"srv_{uuid.uuid4().hex[:8]}",
            location_id=hospital.id,
            name="General OPD & Triage",
            description="Routine clinical examination, general medicine, and vital signs screening.",
            average_service_time=4.5,
            is_active=True,
            created_at=datetime.now(timezone.utc)
        )
        db.add(service_opd)

        queue_opd = Queue(
            id=f"q_{uuid.uuid4().hex[:8]}",
            service_id=service_opd.id,
            name="General OPD Intake",
            prefix="A",
            current_token_number=12,
            average_service_time=4.0,
            status=QueueStatus.NORMAL,
            active_counters_count=3,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(queue_opd)

        for i in range(1, 4):
            counter = Counter(
                id=f"cnt_{uuid.uuid4().hex[:8]}",
                location_id=hospital.id,
                service_id=service_opd.id,
                name=f"Counter {i} — Station {chr(64 + i)}",
                counter_number=i,
                is_active=True,
                created_at=datetime.now(timezone.utc)
            )
            db.add(counter)

        db.commit()
        print("[QueueLess Seed] Seeding completed successfully.")

    except Exception as e:
        db.rollback()
        print(f"[QueueLess Seed] Error during seed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
