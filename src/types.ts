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
}
