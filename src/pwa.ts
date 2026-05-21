import { registerSW } from 'virtual:pwa-register';

export const setupPWA = () => {
    if ('serviceWorker' in navigator) {
        const updateSW = registerSW({
            onNeedRefresh() {
                console.log("Novo conteúdo detectado. Forçando atualização do Service Worker...");
                updateSW(true);
            },
            onOfflineReady() {
                console.log("Aplicativo pronto para funcionar offline.");
            },
        });

        // Procurar por atualizações de forma proativa
        navigator.serviceWorker.ready.then((registration) => {
            // 1. Procurar por novas versões do Service Worker assim que carregar o app
            registration.update().catch(err => console.warn("Erro ao buscar atualizações no carregamento:", err));

            // 2. Procurar por novas versões quando o usuário focar o app (ex: abrir celular, voltar para aba)
            window.addEventListener('focus', () => {
                registration.update().catch(err => console.warn("Erro ao buscar atualizações ao focar a tela:", err));
            });

            // 3. Procurar por novas versões a cada 10 minutos para garantir atualização em tempo de execução
            setInterval(() => {
                registration.update().catch(err => console.warn("Erro ao buscar atualizações automáticas:", err));
            }, 10 * 60 * 1000);
        });

        // Ouvinte de mudança de controlador: Recarrega a página assim que o novo SW estiver ativo e controlando a página
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            console.log("Novo Service Worker ativado. Recarregando a aplicação para carregar a versão mais recente...");
            window.location.reload();
        });
    }
};
