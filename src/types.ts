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
  signature2Name?: string;
  signature2Role?: string;
  isApproved: boolean;
  backgroundImageUrl?: string;
  showFajopaDirectorSignature?: boolean;
  showSeminarRectorSignature?: boolean;
  fajopaDirectorName?: string;
  seminarRectorName?: string;
  fajopaDirectorSignatureUrl?: string;
  seminarRectorSignatureUrl?: string;
  hasCustomBg?: boolean;
  hasFajopaSignature?: boolean;
  hasRectorSignature?: boolean;
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
  organizationCertificateTemplate?: CertificateTemplate;
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
  status: "inscrito" | "presente" | "apto_para_certificado" | "cancelado";
  isOrganizer?: boolean;
  timestamp: string;
  member?: Member;
}

export interface Notification {
  id: string;
  recipientId: string; // The specific memberId or "admin"
  title: string;
  message: string;
  type: "carteirinha" | "inscricao" | "certificado" | "edicao" | "visitante" | "backup" | "sistema" | "evento";
  read: boolean;
  createdAt: string;
  actionUrl?: string;
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
