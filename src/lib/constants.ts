export const PASSWORD_STORAGE_KEY = "studentAdminPassword";
export const DEFAULT_ADMIN_PASSWORD = "ADMIN";
export const URL_STORAGE_KEY = "studentVerifierUrl";
export const DEFAULT_PUBLIC_URL = "https://carteirinhafajopa.netlify.app";
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
export const APP_VERSION = "4.9.0";
export const SETTINGS_DOC_PATH = (appId: string) =>
  `artifacts/${appId}/public/data/students/_settings_global`;
export const ASSETS_DOC_PATH = (appId: string, assetType: string) =>
  `artifacts/${appId}/public/data/students/_asset_${assetType}`;
export const CHANGELOG = [
  "Versão 4.9.0 - Reforços Teológicos e Históricos",
  "Sobre: Inclusão do nome oficial do TCC ('E O VERBO SE FEZ I.A.?'), explicação do conceito de Vibe Coding, e expansão da reflexão teológica sobre a Inteligência Artificial e a pastoral.",
  "Versão 4.8.0 - Atualização da Identidade e História",
  "Sobre: Reformulação completa da seção da história do aplicativo, destacando a evolução desde o TCC até o DAVVERO-ID de forma colaborativa, além das referências e agradecimentos especiais detalhados.",
  "Versão 4.7.1 - Segurança e LGPD",
  "Privacidade: Implementação de máscara de PII para proteção de CPFs e informações de contato na listagem pública e cache offline.",
  "Segurança: Otimização das Regras do banco de dados para acesso estritamente anonimizado.",
  "Versão 4.7.0 - Organização de Eventos",
  "Navegação: Implementação de sub-abas (Próximos e Histórico) tanto no Portal do Aluno quanto na página principal de Eventos para facilitar a localização de atividades encerradas e futuras.",
  "Versão 4.6.10 - Ajuste de Performance",
  "Correção: Otimização no carregamento de ícones e fontes para tornar o carregamento inicial mais rápido.",
  "Versão 4.6.8 - Segurança Avançada",
  "Correção: O processo de 'Sair' ou 'Desvincular' a carteirinha agora encerra completamente a sessão e exibe a tela de login imediatamente. Ajuste no fluxo de Inscrição em Eventos, que agora exige login claro ('Minha ID') e evita erros com múltiplos cliques nos botões de inscrição.",
  "Versão 4.6.7 - Visitantes e Ajustes Múltiplos",
  "Base: Suporte aprimorado ao cadastro de visitantes com separação clara de papéis e regras. Adicionado busca por CPF para visitantes com emissão imediata de QR Code provisório no Check-in. Atualização nos recursos de Eventos com visualização e remoção ampla de inscrições/presenças.",
  "Versão 4.6.6 - Correções e Preparações",
  "Eventos: Correção de bug no cancelamento de inscrições e histórico. Adicionado suporte a imagens nos eventos. Otimização de sessão administrativa contínua nas abas do navegador.",
  "Versão 4.6.5 - Cancelamento de Inscrições e Listas Públicas",
  "Eventos: Adicionada opção para os administradores removerem inscrições indesejadas e preparação do sistema para visualização pública das listas de participantes.",
  "Versão 4.6.4 - Emissão de Certificados e Encerramento",
  "Eventos: Adicionado botão unificado para encerramento de eventos e libertação de certificados em PDF atualizados com o período, formato, horas e nome do aluno.",
  "Versão 4.6.3 - Check-in Offline e Seguro",
  "Eventos: Modo Check-in no Leitor acessível apenas via Administrador, com forte apoio offline (PWA) e sincronização com a nuvem.",
  "Versão 4.6.2 - Nova Aba de Eventos",
  "Navegação: Adicionada aba exclusiva para descoberta e gestão de eventos formativos no menu principal.",
  "Versão 4.6.1 - Gestão Detalhada de Eventos e Inscritos",
  "Eventos: Administradores agora podem editar eventos criados e visualizar a lista completa de alunos inscritos ou presentes num evento, facilitando o controlo.",
  "Versão 4.6.0 - Eventos Avançados",
  "Atualização: Base do sistema melhorada com suporte a controle rigoroso de datas, formato e locais para uma gestão avançada de eventos.",
  "Versão 4.5.8 - Certificados de Eventos",
  "Eventos: Funcionalidade para encerrar eventos e geração automática de certificados em PDF baseados na presença.",
  "Versão 4.5.7 - Check-in e Modo Offline",
  "Eventos: Adicionado modo Check-in de Evento com sincronização Offline no leitor de QR Code para registrar a presença dos alunos.",
  "Versão 4.5.6 - Portal de Inscrições",
  "Eventos: Alunos agora podem visualizar e inscrever-se em eventos disponíveis diretamente pelo portal.",
  "Versão 4.5.5 - Estabilidade na Gestão",
  "Correção: Resolução do aviso de permissões insuficientes ao salvar/obter eventos e presenças reorganizando a persistência no banco de dados para maior segurança.",
  "Versão 4.5.4 - Gestão de Eventos e Presenças",
  "Novo Painel: Adicionada aba exclusiva para criação e gestão de eventos.",
  "Versão 4.5.3 - Preparação para Gestão de Eventos",
  "Tipagem e Dados: Implementação de interfaces e funções para gerir eventos e presenças.",
  "Versão 4.5.2 - Correção de Impressão e UI",
  "Impressão Fiel: A impressão direta (Ctrl+P) agora utiliza o mesmo layout e escala do PDF exportado, garantindo paridade total.",
  "Correção de Modais: Ajustes no layout de títulos e texto para evitar que palavras sejam cortadas e garantir visibilidade do botão fechar.",
  "Estabilidade: Melhoria no suporte a quebra de palavras em telas pequenas.",
  "Versão 4.5.1 - Correções de Impressão e PDF",
  "Aviso de Download: Novo modal que confirma o download e orienta onde encontrar o arquivo no dispositivo.",
  "Estabilidade PDF: Correção de imagens 'sumidas' e falhas de CORS na geração do documento.",
  "Layout de Impressão: Otimização automática para papel A4 preservando o tamanho real da carteirinha.",
  "Versão 4.5.0 - Padronização Legal e UX",
];
