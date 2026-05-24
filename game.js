'use strict';

//getting the canvas na references
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

const scoreDisplay  = document.getElementById('scoreDisplay');
const livesDisplay  = document.getElementById('livesDisplay');
const levelDisplay  = document.getElementById('levelDisplay');
const startScreen   = document.getElementById('startScreen');
const gameOverScreen= document.getElementById('gameOverScreen');
const finalScore    = document.getElementById('finalScore');
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

//application stage starts here
let score, lives, level, gameRunning, animFrameId;
let asteroidSpawnTimer, lastTime;

//listener for the keyboard input
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  // Prevent spacebar scrolling the page
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup',  e => { keys[e.code] = false; });

// geometry stage starts here — star field setup for parallax background
const STAR_COUNT = 180;
const stars = [];

function initStars() {
  stars.length = 0;
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x:    Math.random() * canvas.width,   //spawn in random positions across the width
      y:    Math.random() * canvas.height,
      size: Math.random() * 1.8 + 0.2,      
      speed: Math.random() * 0.6 + 0.1,     
      alpha: Math.random() * 0.7 + 0.3,
    });
  }
}

//making the ship
function createShip() {
  return {
    x:      canvas.width  / 2,
    y:      canvas.height - 100,
    w:      35,
    h:      50,
    speed:  5,
    shootCooldown: 0, //mwanzo wa game
    invincible:    0, //how long the ship is invincible at the start of the game or after losing a life     
    thrustParticles: [],
  };
}

function createBullet(x, y) {
  return {
    x, y,
    vx: 0,  //adds an angle to the shots
    vy: -10,    // shoot from the front of the ship (upward in screen space)
    w: 4, h: 5,
    active: true,
  };
}

//asteroids - basically just polygons
function createAsteroid(x, y, radius, speed, angle) {
  const verts = [];
  const segments = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const r = radius * (0.7 + Math.random() * 0.5); // jagged silhouette
    verts.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r });
  }

  return {
    x, y,
    vx: Math.cos(angle) * speed,   // velocity vector components
    vy: Math.sin(angle) * speed,
    rotation:      0,
    rotationSpeed: (Math.random() - 0.5) * 0.04,  // angular velocity
    radius,
    verts,
    active: true,
    //score calculation based on asteroid size(ongeza more dynamics to it)
    points: Math.round(80 / radius * 10),
  };
}

//asteroid explosion particles
function createParticle(x, y, color) {
  const angle = Math.random() * Math.PI * 2;
  const spd   = Math.random() * 4 + 1;
  return {
    x, y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    life: 1.0,         
    decay: Math.random() * 0.03 + 0.015,
    size: Math.random() * 4 + 1,
    color,
  };
}

let ship, bullets, asteroids, particles;

//aplication stage, stariting game and main loop
function startGame() {
  score = 0; lives = 3; level = 1;
  asteroidSpawnTimer = 0;
  lastTime = null;
  gameRunning = true;

  ship      = createShip();
  bullets   = [];
  asteroids = [];
  particles = [];

  initStars();

    //hide overlays
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');

  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
  if (!gameRunning) return;

  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50 ms
  lastTime = timestamp;

  update(dt, timestamp);
  render();

  animFrameId = requestAnimationFrame(gameLoop);
}

//app logic is here eg collisions, movements, scoring etc
function update(dt, timestamp) {

  if (keys['ArrowLeft']  || keys['KeyA']) ship.x -= ship.speed;
  if (keys['ArrowRight'] || keys['KeyD']) ship.x += ship.speed;
  if (keys['ArrowUp']    || keys['KeyW']) ship.y -= ship.speed;
  if (keys['ArrowDown']  || keys['KeyS']) ship.y += ship.speed;


  ship.x = Math.max(ship.w / 2, Math.min(canvas.width  - ship.w / 2, ship.x));
  ship.y = Math.max(ship.h / 2, Math.min(canvas.height - ship.h / 2, ship.y));


  if (ship.shootCooldown > 0) ship.shootCooldown -= dt;
  if ((keys['Space'] || keys['KeyZ']) && ship.shootCooldown <= 0) {
    bullets.push(createBullet(ship.x, ship.y - ship.h / 2));
    ship.shootCooldown = 0.2; // seconds between shots
  }


  if (ship.invincible > 0) ship.invincible -= dt;


  for (const b of bullets) {
    b.x += b.vx; 
    b.y += b.vy; 
    if (b.y + b.h < 0) b.active = false; 
  }

  //asteroid movements
  for (const a of asteroids) {
    a.x += a.vx;                  
    a.y += a.vy;                  
    a.rotation += a.rotationSpeed;


    if (a.y - a.radius > canvas.height + 20 ||
        a.x + a.radius < -20 ||
        a.x - a.radius > canvas.width + 20) {
      a.active = false;
    }
  }

//stars movement downwards
  for (const s of stars) {
    s.y += s.speed; // translate star down
    if (s.y > canvas.height) { // wrap around
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
  }


  ship.thrustParticles.push(...spawnThrustParticles(ship));
  for (const p of ship.thrustParticles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
  }
  ship.thrustParticles = ship.thrustParticles.filter(p => p.life > 0);

//asteroid spawning and difficulty levels
  asteroidSpawnTimer -= dt;
  const spawnInterval = Math.max(0.4, 1.8 - level * 0.12);
  if (asteroidSpawnTimer <= 0) {
    spawnAsteroid();
    asteroidSpawnTimer = spawnInterval;
  }

//level increase after every 200 points
  level = 1 + Math.floor(score / 200);
  updateHUD();

//collisions detection

  /* — Bullet ↔ Asteroid — */
  for (const b of bullets) {
    if (!b.active) continue;
    for (const a of asteroids) {
      if (!a.active) continue;


      const dx   = b.x - a.x;
      const dy   = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);  // Euclidean distance

      if (dist < a.radius + 4) { // 4 px = bullet radius proxy
        b.active = false;
        a.active = false;


        score += a.points;


        for (let i = 0; i < 18; i++) {
          particles.push(createParticle(a.x, a.y, pickExplosionColor()));
        }


        if (a.radius > 22) splitAsteroid(a);
        break;
      }
    }
  }

  /* — Ship ↔ Asteroid — */
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (!a.active) continue;
      const dx   = ship.x - a.x;
      const dy   = ship.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < a.radius + 16) { 

        lives--;
        ship.invincible = 2.5; // seconds of invincibility
        a.active = false;
        for (let i = 0; i < 28; i++) {
          particles.push(createParticle(ship.x, ship.y, '#00f5ff'));
        }
        if (lives <= 0) endGame();
        break;
      }
    }
  }

  for (const p of particles) {
    p.x   += p.vx;
    p.y   += p.vy;
    p.life -= p.decay;
  }


  bullets   = bullets.filter(b => b.active);
  asteroids = asteroids.filter(a => a.active);
  particles = particles.filter(p => p.life > 0);
}

function spawnAsteroid() {
  const x      = Math.random() * canvas.width;
  const y      = -40;
  const radius = 14 + Math.random() * 28;          // varied sizes
  const speed  = (1.2 + Math.random() * 1.5) + level * 0.15;

  const angle  = Math.PI / 2 + (Math.random() - 0.5) * 0.9;
  asteroids.push(createAsteroid(x, y, radius, speed, angle));
}

//asteroid splitting into smaller pieces when shot
function splitAsteroid(parent) {
  for (let i = 0; i < 2; i++) {
    const angle = Math.atan2(parent.vy, parent.vx) + (i === 0 ? -0.7 : 0.7);
    const speed = Math.sqrt(parent.vx ** 2 + parent.vy ** 2) * 1.2;
    asteroids.push(createAsteroid(
      parent.x, parent.y,
      parent.radius * 0.52,
      speed, angle
    ));
  }
}

function pickExplosionColor() {
  const palette = ['#ff6d00','#ffd600','#ff2d55','#ff9500','#e8e8e8'];
  return palette[Math.floor(Math.random() * palette.length)];
}

//thrust of ship's engines
function spawnThrustParticles(ship) {
  if (Math.random() > 0.5) return [];
  const p = createParticle(
    ship.x + (Math.random() - 0.5) * 10,
    ship.y + ship.h / 2,
    Math.random() > 0.5 ? '#ff6d00' : '#ffd600'
  );
  p.vy  = 2 + Math.random() * 2; 
  p.vx  = (Math.random() - 0.5);
  p.decay = 0.06;
  return [p];
}

//score and lives update
function updateHUD() {
  scoreDisplay.textContent = `SCORE: ${score}`;
  livesDisplay.textContent = `LIVES: ${'♥'.repeat(Math.max(0, lives))}`;
  levelDisplay.textContent = `LEVEL: ${level}`;
}

//game over logic
function endGame() {
  gameRunning = false;
  finalScore.textContent = `Score: ${score}`;
  gameOverScreen.classList.remove('hidden');
}

//rasterization stage starts here, all drawing happens in this function
function render() {

  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0,   '#050811');
  bgGrad.addColorStop(0.5, '#060d1a');
  bgGrad.addColorStop(1,   '#04080e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height); // rasterize: fill every pixel


  for (const s of stars) {
    ctx.save();
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();

    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill(); 
    ctx.restore();
  }

  for (const p of ship.thrustParticles) {
    ctx.save();
    ctx.globalAlpha = p.life * 0.9;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const b of bullets) {
    ctx.save();
    ctx.shadowBlur  = 14;
    ctx.shadowColor = '#00f5ff';
    ctx.fillStyle   = 'rgba(0, 245, 255, 0.6)';
    ctx.beginPath();
    const r = b.w / 2;
    ctx.roundRect(b.x - r, b.y, b.w, b.h, r);
    ctx.fill();
    ctx.shadowBlur  = 4;
    ctx.fillStyle   = '#ffffff';
    ctx.fillRect(b.x - 1, b.y, 2, b.h);
    ctx.restore();
  }

  for (const a of asteroids) {
    ctx.save();
    ctx.translate(a.x, a.y);   
    ctx.rotate(a.rotation);    

    ctx.beginPath();
    ctx.moveTo(a.verts[0].x, a.verts[0].y); 
    for (let i = 1; i < a.verts.length; i++) {
      ctx.lineTo(a.verts[i].x, a.verts[i].y);
    }
    ctx.closePath();


    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, a.radius);
    grad.addColorStop(0, 'rgba(150, 130, 100, 0.9)');
    grad.addColorStop(1, 'rgba(60,  50,  35, 0.95)');
    ctx.fillStyle = grad;
    ctx.fill();  

    ctx.strokeStyle = 'rgba(200, 170, 110, 0.7)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();  

    ctx.restore(); 
  }


  drawShip(ship);
}

function drawShip(ship) {
  ctx.save();

//frame skip in invincibility
  if (ship.invincible > 0 && Math.floor(ship.invincible * 10) % 2 === 0) {
    ctx.restore();
    return;
  }


  ctx.translate(ship.x, ship.y);

  const hw = ship.w / 2; 
  const hh = ship.h / 2; 



  ctx.fillStyle = '#1a3a5c';
  ctx.fillRect(-hw - 6, hh * 0.1, 8, hh * 0.8);   
  ctx.fillRect( hw - 2, hh * 0.1, 8, hh * 0.8);   



  ctx.shadowBlur  = 12;
  ctx.shadowColor = '#ff6d00';
  ctx.fillStyle   = '#ff9500';
  ctx.beginPath();
  ctx.arc(-hw - 2, hh * 0.9, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc( hw + 2, hh * 0.9, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;


  ctx.beginPath();
  ctx.moveTo(0,   -hh);         
  ctx.lineTo( hw,  hh * 0.6);
  ctx.lineTo( hw * 0.5,  hh);
  ctx.lineTo(-hw * 0.5,  hh);  
  ctx.lineTo(-hw,  hh * 0.6);  
  ctx.closePath();

  const hullGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
  hullGrad.addColorStop(0,   '#2a7fc1');
  hullGrad.addColorStop(0.5, '#1a5a8a');
  hullGrad.addColorStop(1,   '#0e3356');
  ctx.fillStyle   = hullGrad;
  ctx.shadowBlur  = 18;
  ctx.shadowColor = '#00f5ff';
  ctx.fill();    

  ctx.strokeStyle = '#00f5ff';
  ctx.lineWidth   = 1.5;
  ctx.stroke();  

  ctx.shadowBlur  = 10;
  ctx.shadowColor = '#00f5ff';
  const cockpitGrad = ctx.createRadialGradient(-3, -hh * 0.2, 1, 0, -hh * 0.1, 11);
  cockpitGrad.addColorStop(0,   'rgba(200,240,255,0.9)');
  cockpitGrad.addColorStop(0.6, 'rgba(0,180,220,0.6)');
  cockpitGrad.addColorStop(1,   'rgba(0,80,130,0.4)');
  ctx.fillStyle = cockpitGrad;
  ctx.beginPath();
  ctx.arc(0, -hh * 0.15, 11, 0, Math.PI * 2);
  ctx.fill();  


  ctx.shadowBlur  = 6;
  ctx.shadowColor = '#00f5ff';
  ctx.strokeStyle = 'rgba(0, 245, 255, 0.45)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0,  -hh * 0.3);
  ctx.lineTo( hw * 0.85, hh * 0.55);
  ctx.moveTo(0,  -hh * 0.3);
  ctx.lineTo(-hw * 0.85, hh * 0.55);
  ctx.stroke();  

  ctx.restore(); 
}

(function renderTitleFrame() {
  ctx.fillStyle = '#050811';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  initStars();
  ctx.globalAlpha = 0.5;
  for (const s of stars) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
})();