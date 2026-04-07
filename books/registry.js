window.BOOK_REGISTRY = window.BOOK_REGISTRY || {};

window.BOOK_SOURCES = [
    "./books/resume-master-book/index.js",
    "./books/interview-script-book/index.js",
    "./books/workbook-kit/index.js"
];

window.loadBookRegistry = async function loadBookRegistry() {
    const sources = window.BOOK_SOURCES || [];
    const loaders = sources.map((source) => new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = source;
        script.async = false;
        script.onload = () => resolve(source);
        script.onerror = () => reject(new Error(`Failed to load book source: ${source}`));
        document.head.appendChild(script);
    }));

    await Promise.all(loaders);
    return window.BOOK_REGISTRY;
};
