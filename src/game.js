import { Store } from '@tauri-apps/plugin-store';
import { getCurrentWindow } from '@tauri-apps/api/window';

// Persistent store shared with settings page
const store = new Store('game.json');

// F11 toggles fullscreen
document.addEventListener('keydown', async (e) => {
    if (e.key === 'F11') {
        e.preventDefault();
        const win = getCurrentWindow();
        await win.setFullscreen(!await win.isFullscreen());
    }
});

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

// Disable image smoothing for better performance
ctx.imageSmoothingEnabled = false;

// UI elements
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const gameOverScreen = document.getElementById('gameOver');
const welcomeScreen = document.getElementById('welcomeScreen');
const instructionsScreen = document.getElementById('instructions');
const welcomeBtn = document.getElementById('welcomeBtn');
const restartBtn = document.getElementById('restartBtn');
const timeLeftElement = document.getElementById('timeLeft');
const timeRemainingDiv = document.getElementById('timeRemaining');
const countdownElement = document.getElementById('countdown');
const timeDisplay = document.getElementById('timeDisplay');
const gameContainer = document.getElementById('gameContainer');

// Set background images
welcomeScreen.style.backgroundImage = 'url(page/welcome.webp)';
instructionsScreen.style.backgroundImage = 'url(page/instruction.webp)';

// Game state
let gameRunning = false;
let score = 0;
let collectedItems = 0;

// High score — load from Tauri Store async; use 0 until resolved
let highScore = 0;
highScoreElement.textContent = highScore;
store.get('highScore').then(val => {
    highScore = val ?? 0;
    highScoreElement.textContent = highScore;
}).catch(() => {});

// Web Audio API — all files pre-decoded at startup for zero-latency playback
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const audioBuffers = {};
const activeSources = {};

const audioReadyPromise = Promise.all([
    ['background', 'SOUNDTRACK/bg.mp3'],
    ['bomb',       'SOUNDTRACK/bomb effects.mp3'],
    ['collect',    'SOUNDTRACK/collect bird nest.mp3'],
    ['completed',  'SOUNDTRACK/completed.mp3'],
    ['countdown',  'SOUNDTRACK/countdownsound.mp3'],
    ['gameOver',   'SOUNDTRACK/game over .mp3'],
    ['gameWon',    'SOUNDTRACK/game won.mp3'],
    ['buzzer',     'SOUNDTRACK/long-buzzer.mp3'],
    ['select',     'SOUNDTRACK/select-sound.mp3'],
    ['wrongItem',  'SOUNDTRACK/wrong item.mp3']
].map(async ([name, url]) => {
    try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        audioBuffers[name] = await audioCtx.decodeAudioData(buf);
    } catch (e) { console.log('Audio load failed:', name); }
}));

function stopSound(name) {
    if (activeSources[name]) {
        try { activeSources[name].stop(); } catch (e) {}
        activeSources[name] = null;
    }
}

function playSound(name) {
    const buffer = audioBuffers[name];
    if (!buffer) return;
    stopSound(name);
    const gain = audioCtx.createGain();
    gain.gain.value = name === 'background' ? 0.3 : 1.0;
    gain.connect(audioCtx.destination);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    if (name === 'background') source.loop = true;
    source.connect(gain);
    source.start();
    activeSources[name] = source;
}

// Timer variables
const GAME_DURATION = 25; // seconds
let gameTimer = GAME_DURATION;
let gameStartTime = 0;

// Debug mode
let debugMode = false;

// Game settings with defaults (Medium difficulty)
let gameSettings = {
    initialSpeed: 7.2,
    maxSpeed: 21.6,
    jumpForce: 42,
    gravity: 1.8,
    jumpSensitivity: 7,
    fallSensitivity: 5,
    obstacleInterval: 120,
    fallMultiplier: 4.5,
    obstacleSpawnRate: 10,
    positiveCollectibleRate: 91,
    dropRate: 80,
    obstacleSize: 1.0,
    boneSize: 100,
    armSize: 100,
    bombSize: 160
};

// Difficulty presets
const difficultyPresets = {
    easy: {
        initialSpeed: 4.8,
        maxSpeed: 14.4,
        jumpForce: 37,
        gravity: 1.5,
        jumpSensitivity: 8,
        fallSensitivity: 6,
        obstacleInterval: 150,
        fallMultiplier: 4.0,
        obstacleSpawnRate: 5,
        positiveCollectibleRate: 95,
        dropRate: 70
    },
    medium: {
        initialSpeed: 7.2,
        maxSpeed: 21.6,
        jumpForce: 42,
        gravity: 1.8,
        jumpSensitivity: 7,
        fallSensitivity: 5,
        obstacleInterval: 120,
        fallMultiplier: 4.5,
        obstacleSpawnRate: 10,
        positiveCollectibleRate: 91,
        dropRate: 80
    },
    hard: {
        initialSpeed: 9.6,
        maxSpeed: 28.8,
        jumpForce: 47,
        gravity: 2.1,
        jumpSensitivity: 5,
        fallSensitivity: 4,
        obstacleInterval: 100,
        fallMultiplier: 5.0,
        obstacleSpawnRate: 15,
        positiveCollectibleRate: 85,
        dropRate: 70
    }
};

// Load settings from Tauri Store
function loadSettings() {
    store.get('gameSettings').then(saved => {
        if (saved) Object.assign(gameSettings, saved);
        applySettingsToPlayer();
    }).catch(() => {});
}

// Save settings to Tauri Store
function saveSettings() {
    store.set('gameSettings', gameSettings).then(() => store.save()).catch(console.error);
}

// Apply settings to UI sliders (UI lives on the settings page)
function applySettingsToUI() {}

// Apply preset difficulty
function applyPreset(preset) {
    gameSettings = { ...difficultyPresets[preset] };
    saveSettings();
}

// Initialize settings
loadSettings();

// Load character sprites
const runningSprite = new Image();
runningSprite.src = 'running.webp';
const jumpingSprite = new Image();
jumpingSprite.src = 'jumping.webp';

// Load obstacle sprites
const obstacleImages = [];
const obstacleFiles = ['0014_rock01.webp', '0014_rock02.png', '0015_cube.webp'];

obstacleFiles.forEach(file => {
    const img = new Image();
    img.src = 'obstacles/' + file;
    obstacleImages.push(img);
});

// Load point collectible images
const collectibleImages = {};
collectibleImages.bone = new Image();
collectibleImages.bone.src = 'points/bone.webp';
collectibleImages.arm = new Image();
collectibleImages.arm.src = 'points/arm.webp';
collectibleImages.bomb = new Image();
collectibleImages.bomb.src = 'points/bomb.webp';

let imagesLoaded = 0;
const totalImages = 2 + obstacleFiles.length + 3 + 1; // sprites + obstacles + collectibles + floor

let resolveImages;
const imageReadyPromise = new Promise(resolve => { resolveImages = resolve; })

runningSprite.onload = () => { imagesLoaded++; checkImagesLoaded(); };
jumpingSprite.onload = () => { imagesLoaded++; checkImagesLoaded(); };
obstacleImages.forEach(img => { img.onload = () => { imagesLoaded++; checkImagesLoaded(); }; });
collectibleImages.bone.onload = () => { imagesLoaded++; checkImagesLoaded(); };
collectibleImages.arm.onload = () => { imagesLoaded++; checkImagesLoaded(); };
collectibleImages.bomb.onload = () => { imagesLoaded++; checkImagesLoaded(); };

let assetsReady = false;
function checkImagesLoaded() {
    if (imagesLoaded === totalImages) {
        resolveImages();
    }
}

// Mouse tracking (fallback for non-locked mode)
let lastMouseY = 0;
let currentMouseY = 0;

// Player object
const player = {
    x: 100,
    y: 0,
    width: 240,
    height: 300,
    velocityY: 0,
    gravity: 0.2,
    jumpForce: -180,
    fastFallMultiplier: 2.5,
    isJumping: false,
    isFastFalling: false,
    color: '#ff6b6b'
};

// Apply current settings to player physics
function applySettingsToPlayer() {
    player.gravity = gameSettings.gravity;
    player.jumpForce = -gameSettings.jumpForce;
    player.fastFallMultiplier = gameSettings.fallMultiplier;
}

applySettingsToPlayer();

// Ground — floor occupies bottom 33% of screen
const groundY = canvas.height * 0.67 - 40;
player.y = groundY - player.height;

// Load floor image
const floorImage = new Image();
floorImage.src = 'floor.webp';
let floorPattern = null;

floorImage.onload = function () {
    floorPattern = ctx.createPattern(floorImage, 'repeat');
    imagesLoaded++;
    checkImagesLoaded();
};

// Resolves when every image AND every audio file is fully decoded
const assetsReadyPromise = Promise.all([imageReadyPromise, audioReadyPromise])
    .then(() => { assetsReady = true; });

// Show countdown
function showCountdown(number) {
    return new Promise((resolve) => {
        countdownElement.textContent = number === 0 ? 'JOM!' : number;
        countdownElement.style.display = 'block';
        playSound('countdown');

        // Force reflow to restart CSS animation
        countdownElement.style.animation = 'none';
        countdownElement.offsetHeight;
        countdownElement.style.animation = 'countdownPulse 1s ease-in-out';

        setTimeout(() => {
            if (number === 0) countdownElement.style.display = 'none';
            resolve();
        }, 1000);
    });
}

// Cached canvas rect for popup positioning — avoids forced layout reflow on every collectible
let cachedCanvasRect = canvas.getBoundingClientRect();
let cachedScaleX = cachedCanvasRect.width / canvas.width;
let cachedScaleY = cachedCanvasRect.height / canvas.height;
window.addEventListener('resize', () => {
    cachedCanvasRect = canvas.getBoundingClientRect();
    cachedScaleX = cachedCanvasRect.width / canvas.width;
    cachedScaleY = cachedCanvasRect.height / canvas.height;
});

// Pre-allocated popup pool — avoids createElement + DOM insert/remove on every collectible
const POPUP_POOL_SIZE = 5;
const popupPool = Array.from({ length: POPUP_POOL_SIZE }, () => {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;opacity:0;pointer-events:none;';
    gameContainer.appendChild(el);
    return { el, inUse: false, timer: null };
});

// Show floating point popup at a canvas position
function showPointPopup(x, y, points) {
    const item = popupPool.find(p => !p.inUse) ?? popupPool[0];
    if (item.timer) clearTimeout(item.timer);
    item.inUse = true;

    const popup = item.el;
    popup.className = points < 0 ? 'point-popup negative' : 'point-popup';
    popup.textContent = points < 0 ? String(points) : '+' + points;
    popup.style.left = (cachedCanvasRect.left + x * cachedScaleX) + 'px';
    popup.style.top  = (cachedCanvasRect.top  + y * cachedScaleY) + 'px';

    // Restart CSS animation without forced reflow
    popup.style.animation = 'none';
    requestAnimationFrame(() => { popup.style.animation = ''; });

    item.timer = setTimeout(() => { item.inUse = false; }, 1100);
}

// Obstacles array
let obstacles = [];
let obstacleTimer = 0;
let obstacleInterval = 120;

// Game speed
let gameSpeed = gameSettings.initialSpeed;
let maxSpeed = gameSettings.maxSpeed;
const speedIncrement = 0.0016;

// Performance timing
let lastTime = performance.now();

// Reset timing when tab regains focus
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && gameRunning) lastTime = performance.now();
});

// Background scroll offsets
let scrollOffset = 0;
let floorScrollOffset = 0;

// ─── Mouse / PointerLock Controls ─────────────────────────────────────────────
// With Pointer Lock active, movementY is the raw delta (positive = down).
// Without it, we fall back to clientY delta tracking.
window.addEventListener('mousemove', (e) => {
    if (!gameRunning) return;

    let deltaY;
    if (document.pointerLockElement === canvas) {
        // movementY > 0 means moving down; negate for "upward = positive" convention
        deltaY = -e.movementY;
    } else {
        currentMouseY = e.clientY;
        deltaY = lastMouseY !== 0 ? lastMouseY - currentMouseY : 0;
        lastMouseY = currentMouseY;
    }

    // Jump: mouse moved UP beyond threshold
    if (deltaY > 3 && !player.isJumping) {
        jump();
    }

    // Fast fall: mouse moved DOWN beyond threshold
    if (deltaY < -gameSettings.fallSensitivity && player.isJumping) {
        player.isFastFalling = true;
    } else {
        player.isFastFalling = false;
    }
});

// Seed lastMouseY on first move (fallback mode)
window.addEventListener('mousemove', (e) => {
    if (lastMouseY === 0) lastMouseY = e.clientY;
}, { once: true });

// Re-request pointer lock if unexpectedly lost mid-game
document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && gameRunning) {
        canvas.requestPointerLock().catch(() => {});
    }
});

// ─── Jump ─────────────────────────────────────────────────────────────────────
function jump() {
    const distanceFromGround = (groundY - player.height) - player.y;
    if (distanceFromGround >= -30 && distanceFromGround <= 10) {
        player.velocityY = player.jumpForce;
        player.isJumping = true;
        playSound('select');
    }
}

// ─── Obstacle / Collectible Factory ───────────────────────────────────────────
function createObstacle() {
    const rand = Math.random() * 100;
    const obstacleRate = gameSettings.obstacleSpawnRate || 20;

    if (rand < obstacleRate) {
        // Ground obstacle
        const sizeMultiplier = gameSettings.obstacleSize ?? 1.0;
        const obstacle = {
            x: canvas.width,
            width: (120 + Math.random() * 80) * sizeMultiplier,
            height: (160 + Math.random() * 100) * sizeMultiplier,
            color: '#2c3e50',
            type: 'ground',
            imageIndex: Math.floor(Math.random() * obstacleImages.length)
        };
        obstacle.y = groundY - obstacle.height + 20;
        obstacles.push(obstacle);
    } else {
        // Collectible
        const positiveRate = gameSettings.positiveCollectibleRate || 91;
        const isPositive = Math.random() * 100 < positiveRate;
        const collectibleTypes = isPositive ? ['bone', 'arm'] : ['bomb'];
        const pointValues = { bone: 5, arm: 5, bomb: -2 };
        const collectibleSizes = {
            bone: gameSettings.boneSize ?? 100,
            arm: gameSettings.armSize ?? 100,
            bomb: gameSettings.bombSize ?? 160
        };
        const randomType = collectibleTypes[Math.floor(Math.random() * collectibleTypes.length)];
        const itemSize = collectibleSizes[randomType];

        const collectible = {
            x: canvas.width,
            width: itemSize,
            height: itemSize,
            type: 'collectible',
            collected: false,
            collectibleType: randomType,
            pointValue: pointValues[randomType]
        };

        const heightRand = Math.random();
        if (heightRand < 0.33) {
            collectible.y = groundY - collectible.height;
        } else if (heightRand < 0.66) {
            collectible.y = groundY - 200 - collectible.height;
        } else {
            collectible.y = groundY - 350 - collectible.height;
        }
        obstacles.push(collectible);
    }
}

// ─── Update Player ─────────────────────────────────────────────────────────────
function updatePlayer(dt60) {
    const gravityForce = player.isFastFalling
        ? player.gravity * player.fastFallMultiplier
        : player.gravity;

    player.velocityY += gravityForce * dt60;
    player.y += player.velocityY * dt60;

    const groundLevel = groundY - player.height;
    if (player.y >= groundLevel) {
        player.y = groundLevel;
        player.velocityY = 0;
        player.isJumping = false;
        player.isFastFalling = false;
    }

    if (player.y < 0) {
        player.y = 0;
        player.velocityY = 0;
    }
}

// ─── Update Obstacles ─────────────────────────────────────────────────────────
function updateObstacles(dt60, effectiveSpeed = gameSpeed) {
    obstacleTimer += dt60;

    const currentDropRate = gameSettings.dropRate || obstacleInterval;

    if (obstacleTimer > currentDropRate && obstacles.length < 12) {
        createObstacle();
        obstacleTimer = 0;
        obstacleInterval = Math.max(85, obstacleInterval - 0.2);
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.x -= effectiveSpeed * dt60;

        if (obstacle.x + obstacle.width < player.x && !obstacle.passed && obstacle.type === 'ground') {
            obstacle.passed = true;
            score += 10;
            scoreElement.textContent = score;
        }

        if (obstacle.x + obstacle.width < -100) {
            obstacles.splice(i, 1);
        }
    }
}

// ─── Collision Detection (AABB, center-scaled hitboxes) ───────────────────────
function checkCollision(rect1, rect2) {
    const aw = rect1.width * 0.48;
    const ah = rect1.height * 0.48;
    const ax = rect1.x + (rect1.width - aw) / 2;
    const ay = rect1.y + (rect1.height - ah) / 2;
    const bw = rect2.width * 0.7;
    const bh = rect2.height * 0.7;
    const bx = rect2.x + (rect2.width - bw) / 2;
    const by = rect2.y + (rect2.height - bh) / 2;
    return ax < bx + bw &&
           ax + aw > bx &&
           ay < by + bh &&
           ay + ah > by;
}

// ─── Check Collisions ─────────────────────────────────────────────────────────
function checkGameOver() {
    for (const obstacle of obstacles) {
        if (obstacle.type === 'ground' && !obstacle.hit) {
            const playerBottom = player.y + player.height;
            const obstacleTop = obstacle.y;

            if (playerBottom > obstacleTop + 80 && checkCollision(player, obstacle)) {
                obstacle.hit = true;
                score = Math.max(0, score - 2);
                scoreElement.textContent = score;

                playSound('bomb');
                canvas.classList.add('shake', 'red-border');
                setTimeout(() => canvas.classList.remove('shake', 'red-border'), 200);

                showPointPopup(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, -2);
                const hitIdx = obstacles.indexOf(obstacle);
                if (hitIdx !== -1) obstacles.splice(hitIdx, 1);
                return;
            }
        } else if (obstacle.type === 'collectible' && !obstacle.collected) {
            if (checkCollision(player, obstacle)) {
                obstacle.collected = true;
                collectedItems++;
                const points = obstacle.pointValue;
                score = Math.max(0, score + points);
                scoreElement.textContent = score;

                if (obstacle.collectibleType === 'bomb') {
                    playSound('bomb');
                    canvas.classList.add('shake', 'red-border');
                    setTimeout(() => canvas.classList.remove('shake', 'red-border'), 200);
                } else if (points < 0) {
                    playSound('wrongItem');
                } else {
                    playSound('collect');
                }

                showPointPopup(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, points);
            }
        }
    }
}

// ─── Draw Functions ───────────────────────────────────────────────────────────
function drawPlayer() {
    const sprite = player.isJumping ? jumpingSprite : runningSprite;
    let drawX = player.x, drawY = player.y, drawW = player.width, drawH = player.height;
    if (player.isJumping) {
        drawW = player.width * 1.2;
        drawH = player.height * 1.2;
        drawX = player.x + (player.width - drawW) / 2;
        drawY = player.y + player.height - drawH;
    }
    if (sprite.complete && sprite.naturalWidth > 0) {
        ctx.drawImage(sprite, Math.round(drawX), Math.round(drawY), Math.round(drawW), Math.round(drawH));
    } else {
        ctx.fillStyle = player.color;
        ctx.fillRect(Math.round(drawX), Math.round(drawY), Math.round(drawW), Math.round(drawH));
    }
}

function drawObstacles() {
    for (const obstacle of obstacles) {
        if (obstacle.type === 'ground') {
            const img = obstacleImages[obstacle.imageIndex];
            if (img?.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, Math.round(obstacle.x), Math.round(obstacle.y), obstacle.width, obstacle.height);
            } else {
                ctx.fillStyle = obstacle.color;
                ctx.fillRect(Math.round(obstacle.x), Math.round(obstacle.y), obstacle.width, obstacle.height);
            }
        } else if (!obstacle.collected) {
            const img = collectibleImages[obstacle.collectibleType];
            if (img?.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, Math.round(obstacle.x), Math.round(obstacle.y), obstacle.width, obstacle.height);
            } else {
                const cx = obstacle.x + obstacle.width / 2;
                const cy = obstacle.y + obstacle.height / 2;
                ctx.fillStyle = obstacle.collectibleType === 'bomb' ? '#333' : '#fff';
                ctx.beginPath();
                ctx.arc(cx, cy, obstacle.width / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

function drawGround(deltaTime, effectiveSpeed = gameSpeed) {
    if (floorImage.complete) {
        floorScrollOffset += effectiveSpeed;
        const fw = floorImage.width;
        const fh = canvas.height - groundY;
        if (floorScrollOffset >= fw) floorScrollOffset = 0;
        ctx.drawImage(floorImage, Math.round(-floorScrollOffset), groundY, fw, fh);
        ctx.drawImage(floorImage, Math.round(fw - floorScrollOffset), groundY, fw, fh);
    } else {
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
    }
}

// Pre-rendered background bitmap — drawn once to an offscreen canvas,
// then blitted each frame with a single fast GPU copy (no gradient recalc)
const bgCanvas = new OffscreenCanvas(canvas.width, canvas.height);
const bgCtx = bgCanvas.getContext('2d');
const bgGradient = bgCtx.createLinearGradient(0, 0, 0, canvas.height);
bgGradient.addColorStop(0, '#87CEEB');
bgGradient.addColorStop(1, '#E0F6FF');
bgCtx.fillStyle = bgGradient;
bgCtx.fillRect(0, 0, canvas.width, canvas.height);

function drawBackground() {
    ctx.drawImage(bgCanvas, 0, 0);
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
let frameCount = 0;
function gameLoop(currentTime) {
    if (!gameRunning) return;

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    const cappedDelta = Math.min(deltaTime, 0.1);
    const elapsed = (currentTime - gameStartTime) / 1000;

    if (frameCount % 6 === 0) {
        gameTimer = Math.max(0, GAME_DURATION - elapsed);
        const timeFormatted = Math.ceil(gameTimer).toString().padStart(2, '0');
        timeLeftElement.textContent = '00:' + timeFormatted;

        timeDisplay.style.background = gameTimer <= 5 ? '#ff6b6b' : '#1B4F91';
    }
    frameCount++;

    if (gameTimer <= 0) {
        playSound('completed');
        setTimeout(() => {
            stopSound('completed');
        }, 2000);
        endGame();
        return;
    }

    const dt60 = cappedDelta * 60;
    const speedMultiplier = elapsed < 10 ? 1.5 : 1;
    const currentEffectiveSpeed = gameSpeed * speedMultiplier;

    updatePlayer(dt60);
    updateObstacles(dt60, currentEffectiveSpeed);
    checkGameOver();
    if (gameSpeed < maxSpeed) gameSpeed += speedIncrement * dt60;

    drawBackground();
    drawObstacles();
    drawGround(cappedDelta, currentEffectiveSpeed);
    drawPlayer();

    requestAnimationFrame(gameLoop);
}

// ─── Screen Flow ──────────────────────────────────────────────────────────────
function showInstructions() {
    welcomeScreen.style.display = 'none';
    instructionsScreen.style.display = 'flex';
}

async function startGame() {
    playSound('select');

    if (!assetsReady) {
        countdownElement.textContent = 'Memuatkan...';
        countdownElement.style.display = 'block';
        countdownElement.style.animation = 'none';
        await assetsReadyPromise;
        countdownElement.style.display = 'none';
    }

    welcomeScreen.style.display = 'none';
    instructionsScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    document.getElementById('settingsBtn').style.display = 'none';

    // Reset state
    score = 0;
    collectedItems = 0;
    gameSpeed = gameSettings.initialSpeed;
    maxSpeed = gameSettings.maxSpeed;
    obstacles = [];
    obstacleTimer = 0;
    obstacleInterval = gameSettings.obstacleInterval;
    player.y = groundY - player.height;
    player.velocityY = 0;
    player.isJumping = false;
    scrollOffset = 0;
    floorScrollOffset = 0;
    gameTimer = GAME_DURATION;

    applySettingsToPlayer();

    scoreElement.textContent = score;
    timeLeftElement.textContent = GAME_DURATION;
    document.getElementById('timeDisplay').style.display = 'flex';
    document.getElementById('totalDisplay').style.display = 'flex';
    timeRemainingDiv.style.display = 'none';
    timeRemainingDiv.classList.remove('warning');

    await showCountdown(3);
    await showCountdown(2);
    await showCountdown(1);
    await showCountdown(0);

    stopSound('countdown');

    gameRunning = true;
    lastTime = performance.now();
    gameStartTime = performance.now();

    // Lock the cursor to the window for precise air-mouse tracking
    canvas.requestPointerLock().catch(() => {});

    playSound('background');
    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameRunning = false;
    stopSound('background');

    // Release pointer lock
    if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
    }

    // Persist high score to Tauri Store
    if (score > highScore) {
        highScore = score;
        store.set('highScore', highScore).then(() => store.save()).catch(console.error);
        highScoreElement.textContent = highScore;
    }

    document.getElementById('scoreNumber').textContent = score;

    const restartButton = document.getElementById('restartBtn');
    const scoreNumber = document.getElementById('scoreNumber');
    if (score < 50) {
        restartButton.textContent = 'MULA LAGI';
        gameOverScreen.style.backgroundImage = "url('page/failed.webp')";
        scoreNumber.style.display = 'none';
        restartButton.style.bottom = '150px';
    } else {
        restartButton.textContent = 'SELESAI';
        gameOverScreen.style.backgroundImage = "url('page/score.webp')";
        scoreNumber.style.display = 'block';
        restartButton.style.bottom = '480px';
    }

    gameOverScreen.style.display = 'flex';
    document.getElementById('timeDisplay').style.display = 'none';
    document.getElementById('totalDisplay').style.display = 'none';
    timeRemainingDiv.style.display = 'none';
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
welcomeBtn.addEventListener('click', () => { playSound('select'); showInstructions(); });
restartBtn.addEventListener('click', () => { playSound('select'); location.reload(); });

// Hover-to-click (1 second hover triggers click) for air-mouse UX
function addHoverClick(button) {
    let timer = null;
    button.addEventListener('mouseenter', () => {
        timer = setTimeout(() => button.click(), 1000);
    });
    button.addEventListener('mouseleave', () => {
        if (timer) { clearTimeout(timer); timer = null; }
    });
}

[welcomeBtn, restartBtn].forEach(addHoverClick);

// Hover-to-click on the instruction text
const instructionText = document.getElementById('instructionText');
addHoverClick(instructionText);

instructionText.addEventListener('click', startGame);

// Keyboard fallback (Space / ArrowUp to jump)
window.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
    }
});
