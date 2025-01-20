document.addEventListener('DOMContentLoaded', () => {
  // Hamburger menu functionality
  const hamburgerMenu = document.querySelector('.hamburger-menu');
  const sidebar = document.querySelector('.sidebar');
  
  if (hamburgerMenu && sidebar) {
    hamburgerMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      hamburgerMenu.classList.toggle('active');
      sidebar.classList.toggle('active');
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !hamburgerMenu.contains(e.target) && sidebar.classList.contains('active')) {
        hamburgerMenu.classList.remove('active');
        sidebar.classList.remove('active');
      }
    });
  }

  // Enhanced carousel functionality
  function initializeCarousel(carousel, navButtons) {
    if (!carousel) return;

    let currentIndex = 0;
    let autoplayInterval;
    const items = carousel.querySelectorAll('.carousel-item');
    const prevBtn = navButtons.querySelector('.prev');
    const nextBtn = navButtons.querySelector('.next');

    // For home page NFT carousel, create items dynamically
    if (!carousel.classList.contains('expressions-carousel')) {
      const totalNFTs = 50;
      carousel.innerHTML = '';
      for (let i = 1; i <= totalNFTs; i++) {
        const item = document.createElement('div');
        item.className = `carousel-item ${i === 1 ? 'active' : ''}`;
        item.innerHTML = `<img src="Artwork/${i}.png" alt="Just Aliens NFT #${i}">`;
        carousel.appendChild(item);
      }
    }

    function initializeCarouselFunctionality() {
      function showSlide(index) {
        items[currentIndex].classList.remove('active');
        currentIndex = (index + items.length) % items.length;
        items[currentIndex].classList.add('active');
      }

      function nextSlide() {
        showSlide(currentIndex + 1);
      }

      function prevSlide() {
        showSlide(currentIndex - 1);
      }

      // Navigation button handlers
      if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
          prevSlide();
          resetAutoplay();
        });

        nextBtn.addEventListener('click', () => {
          nextSlide();
          resetAutoplay();
        });
      }

      // Touch support
      let touchStartX = 0;
      let touchEndX = 0;

      carousel.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, false);

      carousel.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
      }, false);

      function handleSwipe() {
        const swipeThreshold = 50;
        const difference = touchStartX - touchEndX;

        if (Math.abs(difference) > swipeThreshold) {
          if (difference > 0) {
            nextSlide();
          } else {
            prevSlide();
          }
          resetAutoplay();
        }
      }

      // Autoplay functionality
      function startAutoplay() {
        autoplayInterval = setInterval(nextSlide, 5000);
      }

      function resetAutoplay() {
        clearInterval(autoplayInterval);
        startAutoplay();
      }

      // Start autoplay
      startAutoplay();

      // Pause autoplay when hovering over carousel
      carousel.addEventListener('mouseenter', () => clearInterval(autoplayInterval));
      carousel.addEventListener('mouseleave', startAutoplay);
    }

    initializeCarouselFunctionality();
  }

  // Initialize all carousels on the page
  const carousels = document.querySelectorAll('.carousel');
  carousels.forEach(carousel => {
    const navButtons = carousel.nextElementSibling;
    if (navButtons && navButtons.classList.contains('carousel-nav')) {
      initializeCarousel(carousel, navButtons);
    }
  });
});
