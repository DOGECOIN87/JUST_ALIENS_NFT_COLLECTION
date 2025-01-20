class MatrixEffect {
  constructor() {
    this.canvas = document.getElementById('matrixCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    this.initialize();
    
    window.addEventListener('resize', () => this.resizeCanvas());
    this.animate();
  }

  resizeCanvas() {
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
    this.initialize();
  }

  initialize() {
    this.fontSize = 16;
    this.columns = Math.floor(this.canvas.width / this.fontSize);
    this.drops = Array(this.columns).fill(1);
    this.letters = "TBA".split("");
  }

  draw() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = '#0F0';
    this.ctx.font = `${this.fontSize}px monospace`;

    for (let i = 0; i < this.drops.length; i++) {
      const text = this.letters[Math.floor(Math.random() * this.letters.length)];
      this.ctx.fillText(text, i * this.fontSize, this.drops[i] * this.fontSize);

      if (this.drops[i] * this.fontSize > this.canvas.height && Math.random() > 0.975) {
        this.drops[i] = 0;
      }
      this.drops[i]++;
    }
  }

  animate() {
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('matrixCanvas')) {
    new MatrixEffect();
  }
});