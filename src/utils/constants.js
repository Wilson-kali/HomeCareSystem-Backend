module.exports = {
  USER_ROLES: {
    PATIENT: 'patient',
    CAREGIVER: 'caregiver',
    PRIMARY_PHYSICIAN: 'primary_physician',
    SYSTEM_MANAGER: 'system_manager',
    REGIONAL_MANAGER: 'regional_manager'
  },
  
  VERIFICATION_STATUS: {
    PENDING: 'pending',
    VERIFIED: 'verified',
    REJECTED: 'rejected'
  },
  
  APPOINTMENT_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },
  
  PATIENT_STATUS: {
    STABLE: 'stable',
    IMPROVING: 'improving',
    DETERIORATING: 'deteriorating',
    CRITICAL: 'critical',
    CURED: 'cured',
    DECEASED: 'deceased'
  },
  
  ALERT_SEVERITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  },
  
  PAYMENT_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  },
  
  SESSION_TYPE: {
    IN_PERSON: 'in_person',
    TELECONFERENCE: 'teleconference'
  },
  
  TIMESLOT_STATUS: {
    AVAILABLE: 'available',
    LOCKED: 'locked',
    BOOKED: 'booked'
  }
};
