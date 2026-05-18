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

// Load sound effects
const sounds = {
    background: new Audio('SOUNDTRACK/bg.mp3'),
    bomb: new Audio('SOUNDTRACK/bomb effects.mp3'),
    collect: new Audio('SOUNDTRACK/collect bird nest.mp3'),
    completed: new Audio('SOUNDTRACK/completed.mp3'),
    countdown: new Audio('SOUNDTRACK/countdownsound.mp3'),
    gameOver: new Audio('SOUNDTRACK/game over .mp3'),
    gameWon: new Audio('SOUNDTRACK/game won.mp3'),
    buzzer: new Audio('SOUNDTRACK/long-buzzer.mp3'),
    select: new Audio('SOUNDTRACK/select-sound.mp3'),
    wrongItem: new Audio('SOUNDTRACK/wrong item.mp3')
};

// Configure background music to loop
sounds.background.loop = true;
sounds.background.volume = 0.3;

// Helper function to play sound
function playSound(soundName) {
    if (sounds[soundName]) {
        sounds[soundName].currentTime = 0;
        sounds[soundName].play().catch(e => console.log('Audio play failed:', e));
    }
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
    jumpForce: 20,
    gravity: 0.5,
    jumpSensitivity: 7,
    fallSensitivity: 5,
    obstacleInterval: 120,
    fallMultiplier: 2.5,
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
        jumpForce: 19,
        gravity: 0.45,
        jumpSensitivity: 8,
        fallSensitivity: 6,
        obstacleInterval: 150,
        fallMultiplier: 2,
        obstacleSpawnRate: 5,
        positiveCollectibleRate: 95,
        dropRate: 70
    },
    medium: {
        initialSpeed: 7.2,
        maxSpeed: 21.6,
        jumpForce: 20,
        gravity: 0.5,
        jumpSensitivity: 7,
        fallSensitivity: 5,
        obstacleInterval: 120,
        fallMultiplier: 2.5,
        obstacleSpawnRate: 10,
        positiveCollectibleRate: 91,
        dropRate: 80
    },
    hard: {
        initialSpeed: 9.6,
        maxSpeed: 28.8,
        jumpForce: 22,
        gravity: 0.6,
        jumpSensitivity: 5,
        fallSensitivity: 4,
        obstacleInterval: 100,
        fallMultiplier: 3,
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
const totalImages = 2 + obstacleFiles.length + 3; // sprites + obstacles + collectibles

runningSprite.onload = () => { imagesLoaded++; checkImagesLoaded(); };
jumpingSprite.onload = () => { imagesLoaded++; checkImagesLoaded(); };
obstacleImages.forEach(img => { img.onload = () => { imagesLoaded++; checkImagesLoaded(); }; });
collectibleImages.bone.onload = () => { imagesLoaded++; checkImagesLoaded(); };
collectibleImages.arm.onload = () => { imagesLoaded++; checkImagesLoaded(); };
collectibleImages.bomb.onload = () => { imagesLoaded++; checkImagesLoaded(); };

let assetsReady = false;
function checkImagesLoaded() {
    if (imagesLoaded === totalImages) {
        assetsReady = true;
        if (floorImage.complete && floorImage.naturalWidth > 0) {
            floorPattern = ctx.createPattern(floorImage, 'repeat');
        }
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
const groundY = canvas.height * 0.67;
player.y = groundY - player.height;

// Load floor image
const floorImage = new Image();
floorImage.src = 'floor.webp';
let floorPattern = null;

floorImage.onload = function () {
    floorPattern = ctx.createPattern(floorImage, 'repeat');
};

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

// Show floating point popup at a canvas position
function showPointPopup(x, y, points) {
    const popup = document.createElement('div');
    popup.className = 'point-popup';

    if (points < 0) {
        popup.classList.add('negative');
        popup.textContent = points;
    } else {
        popup.textContent = '+' + points;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    popup.style.left = (rect.left + x * scaleX) + 'px';
    popup.style.top = (rect.top + y * scaleY) + 'px';
    document.getElementById('gameContainer').appendChild(popup);

    setTimeout(() => popup.remove(), 1000);
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
function updatePlayer() {
    const gravityForce = player.isFastFalling
        ? player.gravity * player.fastFallMultiplier
        : player.gravity;

    player.velocityY += gravityForce;
    player.y += player.velocityY;

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
function updateObstacles(deltaTime, effectiveSpeed = gameSpeed) {
    obstacleTimer++;

    const currentDropRate = gameSettings.dropRate || obstacleInterval;

    if (obstacleTimer > currentDropRate && obstacles.length < 12) {
        createObstacle();
        obstacleTimer = 0;
        obstacleInterval = Math.max(85, obstacleInterval - 0.2);
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.x -= effectiveSpeed;

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
    const getCenterBox = (rect, isPlayer) => {
        const s = isPlayer ? 0.48 : 0.7;
        const w = rect.width * s;
        const h = rect.height * s;
        return {
            x: rect.x + (rect.width - w) / 2,
            y: rect.y + (rect.height - h) / 2,
            width: w,
            height: h
        };
    };
    const a = getCenterBox(rect1, true);
    const b = getCenterBox(rect2, false);
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
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
                canvas.classList.add('shake');
                setTimeout(() => canvas.classList.remove('shake'), 200);
                canvas.classList.add('red-border');
                setTimeout(() => canvas.classList.remove('red-border'), 200);

                showPointPopup(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, -2);
                obstacles = obstacles.filter(obs => obs !== obstacle);
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
                    canvas.classList.add('shake');
                    setTimeout(() => canvas.classList.remove('shake'), 200);
                    canvas.classList.add('red-border');
                    setTimeout(() => canvas.classList.remove('red-border'), 200);
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
        ctx.drawImage(sprite, drawX, drawY, drawW, drawH);
    } else {
        ctx.fillStyle = player.color;
        ctx.fillRect(drawX, drawY, drawW, drawH);
    }
}

function drawObstacles() {
    for (const obstacle of obstacles) {
        if (obstacle.type === 'ground') {
            const img = obstacleImages[obstacle.imageIndex];
            if (img?.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            } else {
                ctx.fillStyle = obstacle.color;
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            }
        } else if (!obstacle.collected) {
            const img = collectibleImages[obstacle.collectibleType];
            if (img?.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
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
        ctx.drawImage(floorImage, -floorScrollOffset, groundY, fw, fh);
        ctx.drawImage(floorImage, fw - floorScrollOffset, groundY, fw, fh);
    } else {
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
    }
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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

        const timeDisplay = document.getElementById('timeDisplay');
        timeDisplay.style.background = gameTimer <= 5 ? '#ff6b6b' : '#1B4F91';
    }
    frameCount++;

    if (gameTimer <= 0) {
        playSound('completed');
        setTimeout(() => {
            sounds.completed.pause();
            sounds.completed.currentTime = 0;
        }, 2000);
        endGame();
        return;
    }

    const speedMultiplier = elapsed < 10 ? 1.5 : 1;
    const currentEffectiveSpeed = gameSpeed * speedMultiplier;

    updatePlayer();
    updateObstacles(cappedDelta, currentEffectiveSpeed);
    checkGameOver();
    if (gameSpeed < maxSpeed) gameSpeed += speedIncrement;

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

        let attempts = 0;
        while (!assetsReady && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
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

    sounds.countdown.pause();
    sounds.countdown.currentTime = 0;

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
    sounds.background.pause();
    sounds.background.currentTime = 0;

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

// Wire onclick="startGame()" used in the HTML
window.startGame = startGame;

// Keyboard fallback (Space / ArrowUp to jump)
window.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
    }
});
