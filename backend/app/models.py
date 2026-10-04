import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, Enum
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class UserRole(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    PROVIDER = "PROVIDER"
    ADMIN = "ADMIN"

class LocationType(str, enum.Enum):
    HOSPITAL = "HOSPITAL"
    BANK = "BANK"
    GOVERNMENT_OFFICE = "GOVERNMENT_OFFICE"
    DIAGNOSTIC_CENTER = "DIAGNOSTIC_CENTER"
    COLLEGE = "COLLEGE"
    SERVICE_CENTER = "SERVICE_CENTER"
    OTHER = "OTHER"

class QueueStatus(str, enum.Enum):
    NORMAL = "NORMAL"
    BUSY = "BUSY"
    DELAYED = "DELAYED"
    PAUSED = "PAUSED"
    CLOSED = "CLOSED"

class EntryStatus(str, enum.Enum):
    WAITING = "WAITING"
    CALLED = "CALLED"
    SERVING = "SERVING"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"
    MISSED = "MISSED"
    CANCELLED = "CANCELLED"

class NotificationType(str, enum.Enum):
    QUEUE_JOINED = "QUEUE_JOINED"
    QUEUE_UPDATED = "QUEUE_UPDATED"
    TURN_APPROACHING = "TURN_APPROACHING"
    YOUR_TURN = "YOUR_TURN"
    QUEUE_DELAYED = "QUEUE_DELAYED"
    SERVICE_RESUMED = "SERVICE_RESUMED"
    QUEUE_COMPLETED = "QUEUE_COMPLETED"

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    google_id = Column(String(128), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    profile_image = Column(String(512), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.CUSTOMER, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    queue_entries = relationship("QueueEntry", back_populates="customer")
    notifications = relationship("Notification", back_populates="user")

class ServiceLocation(Base):
    __tablename__ = "service_locations"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    address = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    type = Column(Enum(LocationType), default=LocationType.OTHER, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    services = relationship("Service", back_populates="location")
    counters = relationship("Counter", back_populates="location")

class Service(Base):
    __tablename__ = "services"

    id = Column(String(36), primary_key=True, index=True)
    location_id = Column(String(36), ForeignKey("service_locations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    average_service_time = Column(Float, default=5.0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    location = relationship("ServiceLocation", back_populates="services")
    queues = relationship("Queue", back_populates="service")

class Queue(Base):
    __tablename__ = "queues"

    id = Column(String(36), primary_key=True, index=True)
    service_id = Column(String(36), ForeignKey("services.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    prefix = Column(String(10), default="A", nullable=False)
    current_token_number = Column(Integer, default=0, nullable=False)
    average_service_time = Column(Float, default=5.0, nullable=False)
    status = Column(Enum(QueueStatus), default=QueueStatus.NORMAL, nullable=False)
    active_counters_count = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    service = relationship("Service", back_populates="queues")
    entries = relationship("QueueEntry", back_populates="queue")

class Counter(Base):
    __tablename__ = "counters"

    id = Column(String(36), primary_key=True, index=True)
    location_id = Column(String(36), ForeignKey("service_locations.id", ondelete="CASCADE"), nullable=False)
    service_id = Column(String(36), ForeignKey("services.id"), nullable=True)
    name = Column(String(100), nullable=False)
    counter_number = Column(Integer, nullable=False)
    assigned_provider_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    current_queue_entry_id = Column(String(36), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    location = relationship("ServiceLocation", back_populates="counters")

class QueueEntry(Base):
    __tablename__ = "queue_entries"

    id = Column(String(36), primary_key=True, index=True)
    queue_id = Column(String(36), ForeignKey("queues.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    customer_name = Column(String(255), nullable=False)
    customer_phone = Column(String(30), nullable=True)
    token_number = Column(String(20), nullable=False, index=True)
    raw_sequence = Column(Integer, nullable=False)
    status = Column(Enum(EntryStatus), default=EntryStatus.WAITING, nullable=False, index=True)
    is_away = Column(Boolean, default=False, nullable=False)
    position = Column(Integer, default=0, nullable=False)
    estimated_wait = Column(Integer, default=0, nullable=False)
    joined_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    called_at = Column(DateTime(timezone=True), nullable=True)
    served_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    missed_at = Column(DateTime(timezone=True), nullable=True)
    counter_id = Column(String(36), ForeignKey("counters.id"), nullable=True)
    priority_reason = Column(String(255), nullable=True)

    queue = relationship("Queue", back_populates="entries")
    customer = relationship("User", back_populates="queue_entries")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    queue_entry_id = Column(String(36), ForeignKey("queue_entries.id", ondelete="CASCADE"), nullable=True)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User", back_populates="notifications")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, index=True)
    actor_user_id = Column(String(36), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(36), nullable=False)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
