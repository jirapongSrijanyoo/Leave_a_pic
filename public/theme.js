document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const htmlElement = document.documentElement; // Use html element for class

    // SVG icons
    const sunIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
    `;

    const moonIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.11 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
    `;


    // Function to set the theme based on preference
    function setTheme(theme) {
        if (theme === 'light') {
            htmlElement.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
            if (themeToggleBtn) {
                themeToggleBtn.innerHTML = moonIcon; // Show moon icon in light mode
            }
        } else {
            htmlElement.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
            if (themeToggleBtn) {
                themeToggleBtn.innerHTML = sunIcon; // Show sun icon in dark mode
            }
        }
    }

    // Get saved theme from localStorage or detect system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

    if (savedTheme) {
        // Use saved theme
        setTheme(savedTheme);
    } else if (prefersLight) {
        // Use system preference if no saved theme
        setTheme('light');
    } else {
        // Default to dark theme
        setTheme('dark');
    }

    // Listen for button click to toggle theme
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = htmlElement.classList.contains('light-mode') ? 'light' : 'dark';
            setTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    }

    // Optional: Listen for system preference changes (if no saved theme)
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
        // Only update if no theme is explicitly saved by the user
        if (!localStorage.getItem('theme')) {
             setTheme(e.matches ? 'light' : 'dark');
        }
    });
});
