document.addEventListener('DOMContentLoaded', () => {
    const storageKey = 'buggy-booking-theme';
    const root = document.documentElement;
    const toggleButtons = document.querySelectorAll('#theme-toggle');
    const toggleLabels = document.querySelectorAll('#theme-toggle-text');

    const applyTheme = (theme) => {
        root.dataset.theme = theme;
        localStorage.setItem(storageKey, theme);

        toggleLabels.forEach((label) => {
            label.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
        });
    };

    const initialTheme = localStorage.getItem(storageKey) || 'light';
    applyTheme(initialTheme);

    toggleButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);
        });
    });
});
