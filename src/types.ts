export interface Member {
  id: string;
  name: string;
  ra?: string;
  cpf?: string;
  rg?: string;
  birthdate?: string;
  email?: string;
  validityDate?: string;
  alphaCode?: string;
  photoUrl?: string | null;
  roles?: string[];
  course?: string;
  diocese?: string;
  isActive?: boolean;
  isApproved?: boolean;
  status?: "VALID" | "PENDING" | "REVOKED";
  createdAt?: string;
  deletedAt?: string | null;
  legacyId?: string;
  legacyQrCode?: string;
  pendingChanges?: any;
  hasPendingAction?: boolean;
}

export interface CertificateTemplate {
  bodyText: string;
  fontFamily: string;
  bgStyle: string;
  signatureName: string;
  signatureRole: string;
  isApproved: boolean;
}

export interface Event {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  format: "online" | "presencial";
  locationOrLink: string;
  description: string;
  hours?: string | number;
  maxParticipants: number;
  status: string;
  imageUrl?: string;
  certificateTemplate?: CertificateTemplate;
  registrationDeadline?: string;
  isRegistrationPaused?: boolean;
  deletedAt?: string;
  speaker?: string;
  schedulePdfUrl?: string;
}

export interface Attendance {
  id: string;
  eventId: string;
  studentId: string;
  status: "inscrito" | "presente";
  timestamp: string;
  member?: Member;
}

export type AvailabilityStatus = "LIVRE" | "OCUPADO" | "CANCELADO";

export interface Availability {
  id: string;
  professionalId: string;
  professionalName: string;
  date: string;       // Formato YYYY-MM-DD
  startTime: string;  // Formato HH:mm
  endTime: string;    // Formato HH:mm
  status: AvailabilityStatus;
  location?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Appointment {
  id: string;
  availabilityId: string; // Referência à Availability
  memberId: string;       // Referência ao Member (Seminarian)
  professionalId: string; // Desnormalizado para facilitar queries
  date: string;           // Desnormalizado
  startTime: string;      // Desnormalizado
  status: "CONFIRMADO" | "CANCELADO";
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}
