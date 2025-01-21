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
    let items; // Declare items but don't initialize yet
    const prevBtn = navButtons.querySelector('.prev');
    const nextBtn = navButtons.querySelector('.next');

    // For home page NFT carousel, create items dynamically
    if (carousel.classList.contains('main-carousel')) {
      const totalNFTs = 50;
      carousel.innerHTML = ''; // Clear existing content
      const fragment = document.createDocumentFragment();
      
      for (let i = 1; i <= totalNFTs; i++) {
        const item = document.createElement('div');
        item.className = `carousel-item ${i === 1 ? 'active' : ''}`;
        const img = document.createElement('img');
        img.src = `Artwork/${i}.png`;
        img.alt = `Just Aliens NFT #${i}`;
        img.loading = 'lazy'; // Add lazy loading
        item.appendChild(img);
        fragment.appendChild(item);
      }
      
      carousel.appendChild(fragment);
      // Initialize items after dynamic creation
      items = carousel.querySelectorAll('.carousel-item');
    } else {
      // For non-dynamic carousels, initialize items directly
      items = carousel.querySelectorAll('.carousel-item');
    }

    // Ensure we have items before initializing functionality
    if (!items || items.length === 0) return;

    function initializeCarouselFunctionality() {
      function showSlide(index) {
        const nextIndex = (index + items.length) % items.length;
        
        // Remove active class from current slide
        items[currentIndex].classList.remove('active');
        
        // Force a reflow to ensure transitions work
        void items[nextIndex].offsetWidth;
        
        // Update current index and add active class to next slide
        currentIndex = nextIndex;
        items[currentIndex].classList.add('active');
        
        // Preload next image
        const nextNextIndex = (currentIndex + 1) % items.length;
        const nextImg = items[nextNextIndex].querySelector('img');
        if (nextImg && !nextImg.complete) {
          nextImg.loading = 'eager';
        }
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

      // Start autoplay with a slight delay to ensure initial render
      setTimeout(startAutoplay, 100);

      // Pause autoplay when hovering over carousel
      carousel.addEventListener('mouseenter', () => clearInterval(autoplayInterval));
      carousel.addEventListener('mouseleave', startAutoplay);
    }

    initializeCarouselFunctionality();
  }

  // Initialize regular carousels
  const carousels = document.querySelectorAll('.carousel');
  carousels.forEach(carousel => {
    // Find the carousel-nav within the same container
    const container = carousel.closest('.carousel-container') || carousel.closest('.hero');
    const navButtons = container?.querySelector('.carousel-nav');
    
    if (navButtons) {
      initializeCarousel(carousel, navButtons);
    }
  });

  // Initialize rare carousel
  function initializeRareCarousel() {
    const rareCarousel = document.querySelector('.rare-carousel');
    if (!rareCarousel) return;

    const slides = rareCarousel.querySelectorAll('.rare-slide');
    const prevBtn = rareCarousel.parentElement.querySelector('.rare-prev');
    const nextBtn = rareCarousel.parentElement.querySelector('.rare-next');
    let currentIndex = 0;
    let autoplayInterval;

    function showSlide(index) {
      slides[currentIndex].classList.remove('active');
      currentIndex = (index + slides.length) % slides.length;
      slides[currentIndex].classList.add('active');
    }

    function nextSlide() {
      showSlide(currentIndex + 1);
    }

    function prevSlide() {
      showSlide(currentIndex - 1);
    }

    function startAutoplay() {
      autoplayInterval = setInterval(nextSlide, 5000);
    }

    function resetAutoplay() {
      clearInterval(autoplayInterval);
      startAutoplay();
    }

    // Navigation
    prevBtn.addEventListener('click', () => {
      prevSlide();
      resetAutoplay();
    });

    nextBtn.addEventListener('click', () => {
      nextSlide();
      resetAutoplay();
    });

    // Touch support
    let touchStartX = 0;
    rareCarousel.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    rareCarousel.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const difference = touchStartX - touchEndX;
      if (Math.abs(difference) > 50) {
        if (difference > 0) nextSlide();
        else prevSlide();
        resetAutoplay();
      }
    }, { passive: true });

    // Start autoplay
    startAutoplay();

    // Pause on hover
    rareCarousel.addEventListener('mouseenter', () => clearInterval(autoplayInterval));
    rareCarousel.addEventListener('mouseleave', startAutoplay);
  }

  // Initialize all carousels
  initializeRareCarousel();

  // Log initialization status
  console.log('Carousels initialized:', document.querySelectorAll('.carousel').length);
  console.log('Rare carousel initialized:', !!document.querySelector('.rare-carousel'));
});
