import { registerSW } from 'virtual:pwa-register';

export const setupPWA = () => {
    if ('serviceWorker' in navigator) {
        const updateSW = registerSW({
            onNeedRefresh() {
                // You can add a prompt to user here if needed
            },
            onOfflineReady() {
                console.log("App ready to work offline");
            },
        });
    }
};
