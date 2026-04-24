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
}

export interface Attendance {
  id: string;
  eventId: string;
  studentId: string;
  status: "inscrito" | "presente";
  timestamp: string;
  member?: Member;
}
