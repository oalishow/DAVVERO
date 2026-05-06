export const PASSWORD_STORAGE_KEY = "studentAdminPassword";
export const DEFAULT_ADMIN_PASSWORD = "ADMIN";
export const URL_STORAGE_KEY = "studentVerifierUrl";
export const DEFAULT_PUBLIC_URL = "https://davvero.netlify.app";
export const BACKUP_STORAGE_KEY = "davveroId_local_backup";
export const RESTORE_POINT_KEY = "davveroId_restore_point";
export const EMAIL_SETTINGS_KEY = "davveroId_email_settings";
export const DIRECTOR_NAME_KEY = "davveroId_director_name";
export const DEFAULT_DIRECTOR_NAME = "";
export const INSTITUTION_LOGO_KEY = "davveroId_institution_logo";
export const INSTITUTION_NAME_KEY = "davveroId_institution_name";
export const INSTITUTION_COLOR_KEY = "davveroId_institution_color";
export const DIRECTOR_SIGNATURE_KEY = "davveroId_director_signature";
export const CARD_LOGO_KEY = "davveroId_card_logo";
export const CARD_BACK_LOGO_KEY = "davveroId_card_back_logo";
export const CARD_FRONT_LOGO_CONFIG_KEY = "davveroId_card_front_logo_config";
export const CARD_BACK_LOGO_CONFIG_KEY = "davveroId_card_back_logo_config";
export const CARD_FRONT_TEXT_KEY = "davveroId_card_front_text";
export const CARD_BACK_TEXT_KEY = "davveroId_card_back_text";
export const CARD_VISIBLE_FIELDS_KEY = "davveroId_card_visible_fields";
export const CARD_BACK_IMAGE_KEY = "davveroId_card_back_image";
export const CARD_SIGNATURE_CONFIG_KEY = "davveroId_card_signature_config";
export const SECONDARY_BACK_LOGO_SCALE_KEY =
  "davveroId_secondary_back_logo_scale";
export const INSTITUTION_DESCRIPTION_KEY = "davveroId_institution_description";
export const CARD_DESCRIPTION_KEY = "davveroId_card_description";
export const CUSTOM_ROLES_KEY = "davveroId_custom_roles";
export const CUSTOM_COURSES_KEY = "davveroId_custom_courses";
export const APP_VERSION = "5.6";
export const SETTINGS_DOC_PATH = (appId: string) =>
  `artifacts/${appId}/public/data/students/_settings_global`;
export const ASSETS_DOC_PATH = (appId: string, assetType: string) =>
  `artifacts/${appId}/public/data/students/_asset_${assetType}`;
export const CHANGELOG = [
  "Versão 5.6.0 - Melhorias na Gestão de Conta e Configurações",
  "Adicionado painel 'Minha Conta' para edição de dados pessoais do aluno e ajustes na interface e sistema de backup do painel administrativo.",
  "Versão 5.5.0 - Atualização do Sistema",
  "Simplificação e Foco: Redução de campos obsoletos (RG) em formulários e otimização do modal de novidades.",
  "Versão 5.4.0 - Notificações Push e IA em Português",
  "Push Nativo: Receba avisos no celular e Windows mesmo fora do aplicativo. IA: Chat agora responde nativamente em Português.",
  "Versão 5.3.0 - Agendamentos e Trocas de Horário",
  "Atendimentos: Visualização de horários vagos e alteração de data/hora pelo aluno com notificação ao profissional.",
];
