import { Store } from '@tauri-apps/plugin-store';

const store = new Store('game.json');

// Default settings (Medium difficulty)
const defaultSettings = {
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
        obstacleInterval: 140,
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

// Slider elements
const sliders = {
    speed: document.getElementById('speedSlider'),
    maxSpeed: document.getElementById('maxSpeedSlider'),
    jumpForce: document.getElementById('jumpForceSlider'),
    gravity: document.getElementById('gravitySlider'),
    sensitivity: document.getElementById('sensitivitySlider'),
    fallSensitivity: document.getElementById('fallSensitivitySlider'),
    fallMultiplier: document.getElementById('fallMultiplierSlider'),
    obstacleSpawn: document.getElementById('obstacleSpawnSlider'),
    positiveRate: document.getElementById('positiveRateSlider'),
    dropRate: document.getElementById('dropRateSlider'),
    obstacleSize: document.getElementById('obstacleSizeSlider'),
    boneSize: document.getElementById('boneSizeSlider'),
    armSize: document.getElementById('armSizeSlider'),
    bombSize: document.getElementById('bombSizeSlider')
};

// Value display elements
const displays = {
    speed: document.getElementById('speedValue'),
    maxSpeed: document.getElementById('maxSpeedValue'),
    jumpForce: document.getElementById('jumpForceValue'),
    gravity: document.getElementById('gravityValue'),
    sensitivity: document.getElementById('sensitivityValue'),
    fallSensitivity: document.getElementById('fallSensitivityValue'),
    fallMultiplier: document.getElementById('fallMultiplierValue'),
    obstacleSpawn: document.getElementById('obstacleSpawnValue'),
    positiveRate: document.getElementById('positiveRateValue'),
    dropRate: document.getElementById('dropRateValue'),
    obstacleSize: document.getElementById('obstacleSizeValue'),
    boneSize: document.getElementById('boneSizeValue'),
    armSize: document.getElementById('armSizeValue'),
    bombSize: document.getElementById('bombSizeValue')
};

// Load settings from Tauri Store
function loadSettings() {
    return store.get('gameSettings').then(saved => saved ?? { ...defaultSettings });
}

// Apply settings object to all UI sliders
function applySettingsToUI(settings) {
    sliders.speed.value = settings.initialSpeed;
    displays.speed.textContent = settings.initialSpeed;

    sliders.maxSpeed.value = settings.maxSpeed;
    displays.maxSpeed.textContent = settings.maxSpeed;

    sliders.jumpForce.value = settings.jumpForce;
    displays.jumpForce.textContent = settings.jumpForce;

    sliders.gravity.value = settings.gravity;
    displays.gravity.textContent = settings.gravity;

    sliders.sensitivity.value = settings.jumpSensitivity;
    displays.sensitivity.textContent = settings.jumpSensitivity;

    sliders.fallSensitivity.value = settings.fallSensitivity;
    displays.fallSensitivity.textContent = settings.fallSensitivity;

    sliders.fallMultiplier.value = settings.fallMultiplier;
    displays.fallMultiplier.textContent = settings.fallMultiplier;

    sliders.obstacleSpawn.value = settings.obstacleSpawnRate || 20;
    displays.obstacleSpawn.textContent = (settings.obstacleSpawnRate || 20) + '%';

    sliders.positiveRate.value = settings.positiveCollectibleRate || 91;
    displays.positiveRate.textContent = (settings.positiveCollectibleRate || 91) + '%';

    sliders.dropRate.value = settings.dropRate || 120;
    displays.dropRate.textContent = settings.dropRate || 120;

    sliders.obstacleSize.value = settings.obstacleSize ?? 1.0;
    displays.obstacleSize.textContent = (settings.obstacleSize ?? 1.0) + 'x';

    sliders.boneSize.value = settings.boneSize ?? 100;
    displays.boneSize.textContent = (settings.boneSize ?? 100) + 'px';

    sliders.armSize.value = settings.armSize ?? 100;
    displays.armSize.textContent = (settings.armSize ?? 100) + 'px';

    sliders.bombSize.value = settings.bombSize ?? 160;
    displays.bombSize.textContent = (settings.bombSize ?? 160) + 'px';
}

// Collect slider values and persist to Tauri Store
function saveSettings() {
    const settings = {
        initialSpeed: parseFloat(sliders.speed.value),
        maxSpeed: parseFloat(sliders.maxSpeed.value),
        jumpForce: parseFloat(sliders.jumpForce.value),
        gravity: parseFloat(sliders.gravity.value),
        jumpSensitivity: parseFloat(sliders.sensitivity.value),
        fallSensitivity: parseFloat(sliders.fallSensitivity.value),
        obstacleInterval: 120,
        fallMultiplier: parseFloat(sliders.fallMultiplier.value),
        obstacleSpawnRate: parseFloat(sliders.obstacleSpawn.value),
        positiveCollectibleRate: parseFloat(sliders.positiveRate.value),
        dropRate: parseFloat(sliders.dropRate.value),
        obstacleSize: parseFloat(sliders.obstacleSize.value),
        boneSize: parseFloat(sliders.boneSize.value),
        armSize: parseFloat(sliders.armSize.value),
        bombSize: parseFloat(sliders.bombSize.value)
    };
    store.set('gameSettings', settings).then(() => store.save()).catch(console.error);
    showSuccessMessage();
}

function showSuccessMessage() {
    const message = document.getElementById('successMessage');
    message.classList.add('show');
    setTimeout(() => message.classList.remove('show'), 2000);
}

function applyPreset(preset) {
    const settings = { ...difficultyPresets[preset] };
    applySettingsToUI(settings);
    // Update active button highlight
    document.querySelectorAll('.preset-buttons button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(preset + 'Btn').classList.add('active');
}

// Slider live-update displays
sliders.speed.addEventListener('input', (e) => { displays.speed.textContent = e.target.value; });
sliders.maxSpeed.addEventListener('input', (e) => { displays.maxSpeed.textContent = e.target.value; });
sliders.jumpForce.addEventListener('input', (e) => { displays.jumpForce.textContent = e.target.value; });
sliders.gravity.addEventListener('input', (e) => { displays.gravity.textContent = e.target.value; });
sliders.sensitivity.addEventListener('input', (e) => { displays.sensitivity.textContent = e.target.value; });
sliders.fallSensitivity.addEventListener('input', (e) => { displays.fallSensitivity.textContent = e.target.value; });
sliders.fallMultiplier.addEventListener('input', (e) => { displays.fallMultiplier.textContent = e.target.value; });
sliders.obstacleSpawn.addEventListener('input', (e) => { displays.obstacleSpawn.textContent = e.target.value + '%'; });
sliders.positiveRate.addEventListener('input', (e) => { displays.positiveRate.textContent = e.target.value + '%'; });
sliders.dropRate.addEventListener('input', (e) => { displays.dropRate.textContent = e.target.value; });
sliders.obstacleSize.addEventListener('input', (e) => { displays.obstacleSize.textContent = parseFloat(e.target.value).toFixed(1) + 'x'; });
sliders.boneSize.addEventListener('input', (e) => { displays.boneSize.textContent = e.target.value + 'px'; });
sliders.armSize.addEventListener('input', (e) => { displays.armSize.textContent = e.target.value + 'px'; });
sliders.bombSize.addEventListener('input', (e) => { displays.bombSize.textContent = e.target.value + 'px'; });

// Preset buttons
document.getElementById('easyBtn').addEventListener('click', () => applyPreset('easy'));
document.getElementById('mediumBtn').addEventListener('click', () => applyPreset('medium'));
document.getElementById('hardBtn').addEventListener('click', () => applyPreset('hard'));

// Action buttons
document.getElementById('saveBtn').addEventListener('click', () => saveSettings());
document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset all settings to default (Medium difficulty)?')) {
        applyPreset('medium');
        saveSettings();
    }
});
document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'index.html';
});

// Load saved settings on page load
loadSettings().then(savedSettings => applySettingsToUI(savedSettings));
