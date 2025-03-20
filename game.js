document.addEventListener('DOMContentLoaded', () => {
  // Check for WebGL support first
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  
  if (!gl) {
    // WebGL not supported, show error message
    const gameContainer = document.querySelector('.game-container');
    gameContainer.innerHTML = `
      <div style="color: #00ff00; background: rgba(0,0,0,0.8); padding: 20px; border-radius: 10px; text-align: center;">
        <h2>WebGL Not Supported</h2>
        <p>Your browser or device doesn't support WebGL, which is required to play this game.</p>
        <p>Please try a different browser or device.</p>
      </div>
    `;
    return;
  }
  
  // DOM Elements
  const gameCanvas = document.getElementById('game-canvas');
  const scoreElement = document.getElementById('score');
  const livesElement = document.getElementById('lives');
  const levelElement = document.getElementById('level');
  const startScreen = document.getElementById('start-screen');
  const pauseScreen = document.getElementById('pause-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const startButton = document.getElementById('start-button');
  const resumeButton = document.getElementById('resume-button');
  const restartButton = document.getElementById('restart-button');
  const playAgainButton = document.getElementById('play-again-button');
  const finalScoreElement = document.getElementById('final-score');
  const expressionDisplay = document.getElementById('expression-display');
  const gameOverlay = document.getElementById('game-overlay');

  // Game state
  let gameState = 'start'; // start, playing, paused, gameOver
  let score = 0;
  let lives = 3;
  let level = 1;
  let jumping = false;
  let currentExpression = 'Neutral';
  let clock = new THREE.Clock();
  let deltaTime = 0;
  let currentLane = 0;
  let safeZones = [];
  let obstacles = [];
  let lanes = [];
  let cameraHeight = 6.5;
  let globalLight;
  let defaultAlienScale = 0.3;
  
  // Expressions and paths
  const expressions = [
    'Amused',
    'Angry',
    'Chill',
    'Confused',
    'Curious',
    'Happy',
    'Sad',
    'Sour',
    'Surprised'
  ];
  
  const expressionImages = {};
  let expressionTimer = null;
  
  // Three.js setup
  let scene, camera, renderer;
  let alien, alienBody, alienHead, alienFace;
  
  // Game constants
  const LANE_WIDTH = 2;
  const LANE_LENGTH = 30;
  const JUMP_HEIGHT = 1;
  const JUMP_DURATION = 0.5;
  const OBSTACLE_SPEED_MIN = 3;
  const OBSTACLE_TYPES = ['ufo', 'asteroid', 'satellite'];
  const SAFE_ZONE_COUNT = 5;
  const LANE_COUNT = 4;
  const PLAYER_SPEED = 5;
  
  // Initialize the game
  function init() {
    // Load expression images
    loadExpressionImages();
    
    // Set up Three.js
    setupThreeJS();
    
    // Create game environment
    createEnvironment();
    
    // Create player (alien)
    createAlien();
    
    // Add event listeners
    setupEventListeners();
    
    // Initial screen
    showStartScreen();
    
    // Animation loop
    animate();
  }
  
  // Load all expression images
  function loadExpressionImages() {
    let loadedCount = 0;
    const totalImages = expressions.length;
    
    console.log('Loading expressions...');
    
    expressions.forEach(expression => {
      const img = new Image();
      
      img.onload = () => {
        loadedCount++;
        console.log(`Loaded expression: ${expression} (${loadedCount}/${totalImages})`);
        
        // Set default expression once all images are loaded
        if (loadedCount === totalImages) {
          console.log('All expressions loaded successfully');
          // Set initial expression after all images are loaded
          setTimeout(() => changeExpression('Curious', 0), 100);
        }
      };
      
      img.onerror = () => {
        console.error(`Failed to load expression: ${expression}`);
        // Create a placeholder for failed loads
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#33ff33';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#000';
        ctx.font = '16px Arial';
        ctx.fillText(expression, 20, 64);
        
        // Convert canvas to image
        const placeholderImg = new Image();
        placeholderImg.src = canvas.toDataURL();
        expressionImages[expression] = placeholderImg;
        
        loadedCount++;
      };
      
      img.src = `Assets/Expression/${expression}.png`;
      expressionImages[expression] = img;
    });
  }
  
  // Change alien expression
  function changeExpression(expression, duration = 2000) {
    // Clear any existing timer
    if (expressionTimer) {
      clearTimeout(expressionTimer);
      expressionTimer = null;
    }
    
    currentExpression = expression;
    
    // Clear the expression display
    while (expressionDisplay.firstChild) {
      expressionDisplay.removeChild(expressionDisplay.firstChild);
    }
    
    // Add the new expression
    const img = expressionImages[expression].cloneNode();
    expressionDisplay.appendChild(img);
    
    // Reset after duration
    if (duration > 0) {
      expressionTimer = setTimeout(() => {
        changeExpression('Chill', 0);
      }, duration);
    }
  }
  
  // Setup Three.js
  function setupThreeJS() {
    try {
      // Create scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000020);
      
      // Create camera
      camera = new THREE.PerspectiveCamera(
        75, 
        gameCanvas.clientWidth / gameCanvas.clientHeight, 
        0.1, 
        1000
      );
      camera.position.set(0, cameraHeight, 10);
      camera.lookAt(0, 0, 0);
      
      // Create renderer with error handling
      renderer = new THREE.WebGLRenderer({ 
        canvas: gameCanvas, 
        antialias: true,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false
      });
      
      renderer.setSize(gameCanvas.clientWidth, gameCanvas.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better shadows
      
      // Add lights
      const ambientLight = new THREE.AmbientLight(0x404040, 1);
      scene.add(ambientLight);
      
      globalLight = new THREE.DirectionalLight(0xffffff, 1);
      globalLight.position.set(10, 20, 10);
      globalLight.castShadow = true;
      
      // Optimize shadow settings
      globalLight.shadow.mapSize.width = 512;
      globalLight.shadow.mapSize.height = 512;
      globalLight.shadow.camera.near = 0.5;
      globalLight.shadow.camera.far = 50;
      scene.add(globalLight);
      
      // Handle window resize
      window.addEventListener('resize', onWindowResize);
      
      console.log("Three.js setup completed successfully");
      return true;
    } catch (error) {
      console.error("Error setting up Three.js:", error);
      
      // Show fallback message
      gameOverlay.innerHTML = `
        <div style="background: rgba(0,0,0,0.8); padding: 20px; border-radius: 10px; text-align: center;">
          <h2 style="color: #00ff00;">Graphics Error</h2>
          <p style="color: white;">There was a problem initializing the game graphics.</p>
          <p style="color: white;">Error: ${error.message}</p>
          <button id="retry-button" style="background: rgba(0, 255, 0, 0.2); color: #00ff00; border: 2px solid #00ff00; padding: 12px 30px; margin-top: 20px; cursor: pointer;">Retry</button>
        </div>
      `;
      
      document.getElementById('retry-button')?.addEventListener('click', () => {
        window.location.reload();
      });
      
      return false;
    }
  }
  
  // Handle window resize
  function onWindowResize() {
    camera.aspect = gameCanvas.clientWidth / gameCanvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(gameCanvas.clientWidth, gameCanvas.clientHeight);
  }
  
  // Create the game environment
  function createEnvironment() {
    // Create space background with stars
    createStars();
    
    // Create the game board
    createGameBoard();
    
    // Create safe zones
    createSafeZones();
    
    // Create lanes with obstacles
    createLanes();
  }
  
  // Create stars for background
  function createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
    });
    
    const starsCount = 1000;
    const starsPositions = new Float32Array(starsCount * 3);
    
    for (let i = 0; i < starsCount * 3; i += 3) {
      starsPositions[i] = (Math.random() - 0.5) * 100;
      starsPositions[i + 1] = (Math.random() - 0.5) * 100;
      starsPositions[i + 2] = (Math.random() - 0.5) * 100;
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
  }
  
  // Create the game board
  function createGameBoard() {
    const boardGeometry = new THREE.BoxGeometry(LANE_WIDTH * LANE_COUNT, 0.5, LANE_LENGTH);
    const boardMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x000040,
      shininess: 10,
      emissive: 0x000010
    });
    
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    board.position.y = -0.25;
    board.receiveShadow = true;
    scene.add(board);
  }
  
  // Create safe zones
  function createSafeZones() {
    safeZones = [];
    
    // First safe zone (starting point)
    const startZoneGeometry = new THREE.BoxGeometry(LANE_WIDTH * LANE_COUNT, 0.1, 2);
    const startZoneMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3
    });
    
    const startZone = new THREE.Mesh(startZoneGeometry, startZoneMaterial);
    startZone.position.set(0, 0.05, LANE_LENGTH / 2 - 1);
    scene.add(startZone);
    safeZones.push(startZone);
    
    // Safe zones across the board
    const safeZoneSpacing = LANE_LENGTH / (SAFE_ZONE_COUNT + 1);
    
    for (let i = 1; i <= SAFE_ZONE_COUNT - 1; i++) {
      const zoneGeometry = new THREE.BoxGeometry(LANE_WIDTH * LANE_COUNT, 0.1, 1);
      const zoneMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3
      });
      
      const zone = new THREE.Mesh(zoneGeometry, zoneMaterial);
      const zPos = LANE_LENGTH / 2 - (i * safeZoneSpacing);
      zone.position.set(0, 0.05, zPos);
      scene.add(zone);
      safeZones.push(zone);
    }
    
    // Final safe zone (goal)
    const goalZoneGeometry = new THREE.BoxGeometry(LANE_WIDTH * LANE_COUNT, 0.1, 2);
    const goalZoneMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5
    });
    
    const goalZone = new THREE.Mesh(goalZoneGeometry, goalZoneMaterial);
    goalZone.position.set(0, 0.05, -LANE_LENGTH / 2 + 1);
    scene.add(goalZone);
    safeZones.push(goalZone);
  }
  
  // Create lanes with obstacles
  function createLanes() {
    obstacles = [];
    lanes = [];
    
    const safeZoneSpacing = LANE_LENGTH / (SAFE_ZONE_COUNT + 1);
    
    for (let i = 0; i < SAFE_ZONE_COUNT; i++) {
      const laneStartZ = LANE_LENGTH / 2 - (i * safeZoneSpacing) - 0.5;
      const laneEndZ = laneStartZ - safeZoneSpacing + 1;
      
      // Create a lane between each safe zone
      const lane = {
        startZ: laneStartZ,
        endZ: laneEndZ,
        obstacles: []
      };
      
      // Create obstacles for the lane
      createObstaclesForLane(lane, i);
      
      lanes.push(lane);
    }
  }
  
  // Create obstacles for a lane
  function createObstaclesForLane(lane, laneIndex) {
    const laneLength = Math.abs(lane.endZ - lane.startZ);
    const obstacleCount = Math.min(3 + level, 6); // More obstacles as level increases
    
    for (let i = 0; i < obstacleCount; i++) {
      const obstacleType = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
      const obstacleSpeed = OBSTACLE_SPEED_MIN + (level * 0.5) + (Math.random() * 2);
      const laneNumber = Math.floor(Math.random() * LANE_COUNT);
      const direction = Math.random() > 0.5 ? 1 : -1;
      
      const obstacle = createObstacle(
        obstacleType, 
        laneNumber, 
        lane.startZ - (i * (laneLength / obstacleCount)), 
        obstacleSpeed * direction
      );
      
      lane.obstacles.push(obstacle);
      obstacles.push(obstacle);
    }
  }
  
  // Create an individual obstacle
  function createObstacle(type, laneNumber, zPosition, speed) {
    let geometry, material;
    
    switch (type) {
      case 'ufo':
        geometry = new THREE.CylinderGeometry(0.5, 0.8, 0.3, 16);
        material = new THREE.MeshPhongMaterial({ 
          color: 0xff00ff,
          emissive: 0x440044
        });
        break;
      case 'asteroid':
        geometry = new THREE.DodecahedronGeometry(0.6, 0);
        material = new THREE.MeshPhongMaterial({ 
          color: 0x8b4513,
          emissive: 0x1a0a02
        });
        break;
      case 'satellite':
        geometry = new THREE.BoxGeometry(0.4, 0.4, 1.2);
        material = new THREE.MeshPhongMaterial({ 
          color: 0xaaaaaa,
          emissive: 0x222222
        });
        break;
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    
    // Position in lane
    const xPos = -((LANE_COUNT - 1) * LANE_WIDTH / 2) + (laneNumber * LANE_WIDTH);
    mesh.position.set(xPos, 0.5, zPosition);
    
    scene.add(mesh);
    
    return {
      mesh,
      speed,
      type,
      lane: laneNumber,
      active: true
    };
  }
  
  // Create the alien player character
  function createAlien() {
    alien = new THREE.Group();
    
    // Alien body (using cylinder instead of capsule for compatibility)
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x33ff33,
      shininess: 30
    });
    
    alienBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
    alienBody.position.y = 0.6;
    alienBody.castShadow = true;
    
    // Alien head
    const headGeometry = new THREE.SphereGeometry(0.4, 32, 16);
    const headMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x33ff33,
      shininess: 30
    });
    
    alienHead = new THREE.Mesh(headGeometry, headMaterial);
    alienHead.position.y = 1.3;
    alienHead.castShadow = true;
    
    // Alien eyes
    const eyeGeometry = new THREE.SphereGeometry(0.1, 16, 8);
    const eyeMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x000000,
      shininess: 40
    });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15, 1.4, 0.3);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15, 1.4, 0.3);
    
    // Alien face (for expressions)
    alienFace = new THREE.Group();
    alienFace.add(leftEye);
    alienFace.add(rightEye);
    
    // Add all parts to the alien group
    alien.add(alienBody);
    alien.add(alienHead);
    alien.add(alienFace);
    
    // Scale the alien
    alien.scale.set(defaultAlienScale, defaultAlienScale, defaultAlienScale);
    
    // Position at start
    resetAlienPosition();
    
    scene.add(alien);
  }
  
  // Reset alien to starting position
  function resetAlienPosition() {
    alien.position.set(0, 0, LANE_LENGTH / 2 - 1);
    currentLane = Math.floor(LANE_COUNT / 2);
    updateAlienLane();
  }
  
  // Update alien lane position
  function updateAlienLane() {
    const xPos = -((LANE_COUNT - 1) * LANE_WIDTH / 2) + (currentLane * LANE_WIDTH);
    alien.position.x = xPos;
  }
  
  // Setup event listeners
  function setupEventListeners() {
    // Button event listeners
    startButton.addEventListener('click', startGame);
    resumeButton.addEventListener('click', resumeGame);
    restartButton.addEventListener('click', restartGame);
    playAgainButton.addEventListener('click', restartGame);
    
    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
  }
  
  // Handle keyboard input
  function handleKeyDown(event) {
    if (gameState !== 'playing') {
      if (event.key === ' ' || event.key === 'Enter') {
        if (gameState === 'start') startGame();
        if (gameState === 'paused') resumeGame();
        if (gameState === 'gameOver') restartGame();
      }
      return;
    }
    
    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        moveLeft();
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        moveRight();
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        moveForward();
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        moveBackward();
        break;
      case ' ':
        jump();
        break;
      case 'Escape':
      case 'p':
      case 'P':
        pauseGame();
        break;
    }
  }
  
  // Player movement functions
  function moveLeft() {
    if (currentLane > 0) {
      currentLane--;
      updateAlienLane();
      changeExpression('Curious', 1000);
    } else {
      changeExpression('Confused', 1000);
    }
  }
  
  function moveRight() {
    if (currentLane < LANE_COUNT - 1) {
      currentLane++;
      updateAlienLane();
      changeExpression('Curious', 1000);
    } else {
      changeExpression('Confused', 1000);
    }
  }
  
  function moveForward() {
    if (alien.position.z > -LANE_LENGTH / 2 + 1) {
      alien.position.z -= 2;
      checkSafeZone();
    }
  }
  
  function moveBackward() {
    if (alien.position.z < LANE_LENGTH / 2 - 1) {
      alien.position.z += 2;
    }
  }
  
  function jump() {
    if (!jumping) {
      jumping = true;
      const jumpUp = new TWEEN.Tween(alien.position)
        .to({ y: JUMP_HEIGHT }, JUMP_DURATION * 500)
        .easing(TWEEN.Easing.Quadratic.Out);
      
      const jumpDown = new TWEEN.Tween(alien.position)
        .to({ y: 0 }, JUMP_DURATION * 500)
        .easing(TWEEN.Easing.Quadratic.In)
        .onComplete(() => {
          jumping = false;
        });
      
      jumpUp.chain(jumpDown);
      jumpUp.start();
      
      changeExpression('Surprised', 1000);
    }
  }
  
  // Check if alien has reached a safe zone and update score
  function checkSafeZone() {
    let inSafeZone = false;
    
    // Check collision with safe zones
    for (let i = 0; i < safeZones.length; i++) {
      const zone = safeZones[i];
      const alienBB = new THREE.Box3().setFromObject(alien);
      const zoneBB = new THREE.Box3().setFromObject(zone);
      
      if (alienBB.intersectsBox(zoneBB)) {
        inSafeZone = true;
        
        // Final safe zone (goal)
        if (i === safeZones.length - 1) {
          completeLevel();
          return;
        }
        
        // Award points for reaching new safe zone
        if (i > 0) {
          score += i * 10;
          updateScore();
          changeExpression('Happy', 1500);
        }
        
        break;
      }
    }
    
    if (!inSafeZone) {
      // Change expression based on risk
      if (isNearObstacle()) {
        changeExpression('Surprised', 1000);
      } else {
        changeExpression('Chill', 0);
      }
    }
  }
  
  // Check if alien is near an obstacle
  function isNearObstacle() {
    for (const obstacle of obstacles) {
      if (!obstacle.active) continue;
      
      const distance = alien.position.distanceTo(obstacle.mesh.position);
      if (distance < 3) {
        return true;
      }
    }
    return false;
  }
  
  // Update score display
  function updateScore() {
    scoreElement.textContent = score;
  }
  
  // Update lives display
  function updateLives() {
    livesElement.textContent = lives;
  }
  
  // Update level display
  function updateLevel() {
    levelElement.textContent = level;
  }
  
  // Manage collisions
  function checkCollisions() {
    if (jumping) return; // No collisions while jumping
    
    const alienBB = new THREE.Box3().setFromObject(alien);
    
    for (const obstacle of obstacles) {
      if (!obstacle.active) continue;
      
      const obstacleBB = new THREE.Box3().setFromObject(obstacle.mesh);
      
      if (alienBB.intersectsBox(obstacleBB)) {
        obstacleHit(obstacle);
        return;
      }
    }
  }
  
  // Handle collision with obstacle
  function obstacleHit(obstacle) {
    lives--;
    updateLives();
    
    changeExpression('Angry', 2000);
    
    // Flash the obstacle
    flashObstacle(obstacle);
    
    if (lives <= 0) {
      gameOver();
    } else {
      // Reset position but keep score
      resetAlienPosition();
    }
  }
  
  // Visual feedback for collision
  function flashObstacle(obstacle) {
    const originalColor = obstacle.mesh.material.color.clone();
    const originalEmissive = obstacle.mesh.material.emissive.clone();
    
    obstacle.mesh.material.color.set(0xff0000);
    obstacle.mesh.material.emissive.set(0x330000);
    
    setTimeout(() => {
      obstacle.mesh.material.color.copy(originalColor);
      obstacle.mesh.material.emissive.copy(originalEmissive);
    }, 500);
  }
  
  // Complete the current level
  function completeLevel() {
    level++;
    score += 50 * level;
    updateLevel();
    updateScore();
    
    changeExpression('Happy', 3000);
    
    // Reset for next level
    resetAlienPosition();
    resetObstacles();
    
    // Increase difficulty
    increaseObstacleSpeeds();
  }
  
  // Reset obstacles for new level
  function resetObstacles() {
    // Remove existing obstacles
    for (const obstacle of obstacles) {
      scene.remove(obstacle.mesh);
    }
    
    obstacles = [];
    
    // Recreate lanes with new obstacles
    createLanes();
  }
  
  // Increase obstacle speeds for higher difficulty
  function increaseObstacleSpeeds() {
    for (const obstacle of obstacles) {
      const direction = obstacle.speed > 0 ? 1 : -1;
      obstacle.speed = (OBSTACLE_SPEED_MIN + (level * 0.5) + (Math.random() * 2)) * direction;
    }
  }
  
  // Game state functions
  function startGame() {
    console.log('Starting game!');
    gameState = 'playing';
    gameOverlay.style.display = 'none';
    clock.start();
    
    // Make sure the overlay is hidden
    startScreen.style.display = 'none';
    pauseScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    
    changeExpression('Happy', 1500);
  }
  
  function pauseGame() {
    gameState = 'paused';
    pauseScreen.style.display = 'flex';
    gameOverlay.style.display = 'flex';
    
    changeExpression('Confused', 0);
  }
  
  function resumeGame() {
    gameState = 'playing';
    gameOverlay.style.display = 'none';
    
    changeExpression('Chill', 1000);
  }
  
  function restartGame() {
    gameState = 'playing';
    score = 0;
    lives = 3;
    level = 1;
    
    updateScore();
    updateLives();
    updateLevel();
    
    resetAlienPosition();
    resetObstacles();
    
    gameOverlay.style.display = 'none';
    
    changeExpression('Happy', 1500);
  }
  
  function gameOver() {
    gameState = 'gameOver';
    finalScoreElement.textContent = score;
    gameOverScreen.style.display = 'flex';
    gameOverlay.style.display = 'flex';
    
    changeExpression('Sad', 0);
  }
  
  function showStartScreen() {
    startScreen.style.display = 'flex';
    pauseScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    
    changeExpression('Curious', 0);
  }
  
  // Update obstacles
  function updateObstacles(deltaTime) {
    for (const obstacle of obstacles) {
      if (!obstacle.active) continue;
      
      // Move obstacle
      obstacle.mesh.position.x += obstacle.speed * deltaTime;
      
      // Rotate obstacle
      obstacle.mesh.rotation.y += deltaTime * 2;
      if (obstacle.type === 'asteroid') {
        obstacle.mesh.rotation.x += deltaTime * 1.5;
      }
      
      // Handle bounds - wrap around
      const boundX = (LANE_COUNT * LANE_WIDTH / 2) + 1;
      if (obstacle.mesh.position.x > boundX) {
        obstacle.mesh.position.x = -boundX;
      } else if (obstacle.mesh.position.x < -boundX) {
        obstacle.mesh.position.x = boundX;
      }
    }
  }
  
  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    
    if (gameState === 'playing') {
      deltaTime = Math.min(clock.getDelta(), 0.1); // Cap delta time to prevent large jumps
      
      // Update obstacles
      updateObstacles(deltaTime);
      
      // Check collisions
      checkCollisions();
      
      // Update TWEEN animations
      if (typeof TWEEN !== 'undefined' && TWEEN.update) {
        TWEEN.update();
      }
    }
    
    // Render scene if renderer is available
    if (renderer) {
      try {
        renderer.render(scene, camera);
      } catch (e) {
        console.error("Render error:", e);
        // Don't crash the game on render errors
      }
    }
  }
  
  // Initialize the game when the page loads
  function initWithErrorHandling() {
    try {
      init();
      console.log("Game initialized successfully");
    } catch (error) {
      console.error("Error initializing game:", error);
      
      // Show error message to user
      gameOverlay.style.display = 'flex';
      gameOverlay.innerHTML = `
        <div style="background: rgba(0,0,0,0.8); padding: 20px; border-radius: 10px; text-align: center;">
          <h2 style="color: #00ff00;">Game Error</h2>
          <p style="color: white;">There was a problem starting the game:</p>
          <p style="color: white;">${error.message}</p>
          <button onclick="window.location.reload()" style="background: rgba(0, 255, 0, 0.2); color: #00ff00; border: 2px solid #00ff00; padding: 12px 30px; margin-top: 20px; cursor: pointer;">Reload Game</button>
        </div>
      `;
    }
  }
  
  // Start the game with error handling
  initWithErrorHandling();
});

// Listen for hamburger menu clicks
document.querySelector('.hamburger-menu').addEventListener('click', function() {
  this.classList.toggle('active');
  document.querySelector('.sidebar').classList.toggle('active');
});
