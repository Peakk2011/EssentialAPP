export const setupLazyLoading = () => {
    const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                element.style.visibility = 'visible';
                observer.unobserve(element);
            }
        });
    });

    document.querySelectorAll('.lazy-load').forEach(el => {
        el.style.visibility = 'hidden';
        lazyLoadObserver.observe(el);
    });
};