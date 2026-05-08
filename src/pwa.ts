import { registerSW } from 'virtual:pwa-register';

export const setupPWA = () => {
    if ('serviceWorker' in navigator) {
        const updateSW = registerSW({
            onNeedRefresh() {
                updateSW(true);
            },
            onOfflineReady() {
                console.log("App ready to work offline");
            },
        });

        const checkForUpdates = () => {
            navigator.serviceWorker.ready.then((registration) => {
                if (registration && registration.update) {
                    registration.update().catch(console.error);
                }
            });
        };

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkForUpdates();
            }
        });

        window.addEventListener('focus', checkForUpdates);
    }
};
