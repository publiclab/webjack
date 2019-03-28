/**
 * @name Frequency Spectrum
 * @description <p>Visualize the frequency spectrum of live audio input.</p>
 * <p><em><span class="small"> To run this example locally, you will need the
 * <a href="http://p5js.org/reference/#/libraries/p5.sound">p5.sound library</a>
 * and a running <a href="https://github.com/processing/p5.js/wiki/Local-server">local server</a>.</span></em></p>
 */
var mic, fft,
  labelScale = 3, 
  userInteracted = false; // need to wait for user interaction before using WebAudio https://developers.google.com/web/updates/2017/09/autoplay-policy-changes#webaudio

function setupEqualizer() {
  createCanvas(350, 100);
  noFill();
  $('.equalizer').append($('.p5Canvas').remove()) 
  $('.eq-btn').hide() 

  userInteracted = true;

  mic = new p5.AudioIn();
  mic.start();
  fft = new p5.FFT();
  fft.setInput(mic);
}

function draw() {
  if (userInteracted) {
    var scale = 1;
    background(200);
 
    text(parseInt(map(mouseX, 0, width, 20, 15000 / scale)) + " Hz", mouseX - 10, mouseY - 20);
    var spectrum = fft.analyze();
 
    beginShape();
    vertex(0, height * 0.9);
    for (i = 0; i < spectrum.length / scale; i++) {
      vertex(i * scale, map(spectrum[i], 0, 255, height * 0.8, 0));
    }
    vertex(width, height * 0.9);
    endShape();
 
    var freq
    // draw labels
    for (i = 0; i < spectrum.length / scale; i += width / labelScale) {
      freq = parseInt(map(i, 0, 1024, 20, 15000));
      text(freq, map(i, 0, 1024 / scale, 0, width), height * 0.97);
      fill(0, 100);
    }
  }
}
