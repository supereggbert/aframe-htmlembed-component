if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

const HTMLCanvas = require('./htmlcanvas.js');

AFRAME.registerComponent('htmlembed', {
  schema: {
    ppu: {
      type: 'number',
      default: 256
    }
  },
  init: function() {
    var htmlcanvas = new HTMLCanvas(this.el, () => {
      if (texture) texture.needsUpdate = true;
    }, (event, data) => {
      switch (event) {
        case 'resize':
          this.el.emit("resize");
          break;
        case 'rendered':
          this.el.emit("rendered");
          break;
        case 'focusableenter':
          this.el.emit("focusableenter", data);
          break;
        case 'focusableleave':
          this.el.emit("focusableleave", data);
          break;
        case 'inputrequired':
          this.el.emit("inputrequired", data);
          break;
      }
    });
    this.htmlcanvas = htmlcanvas;
    var texture = new THREE.CanvasTexture(htmlcanvas.canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true
    });
    var geometry = new THREE.PlaneGeometry();
    var screen = new THREE.Mesh(geometry, material);
    this.el.setObject3D('screen', screen);
    this.screen = screen;

    this.el.addEventListener('raycaster-intersected', evt => {
      this.raycaster = evt.detail.el;
    });
    this.el.addEventListener('raycaster-intersected-cleared', evt => {
      this.htmlcanvas.clearHover();
      this.raycaster = null;
    });
    this.el.addEventListener('mousedown', evt => {
      if (evt instanceof CustomEvent) {
        this.htmlcanvas.mousedown(this.lastX, this.lastY);
      } else {
        evt.stopPropagation();
      }
    });
    this.el.addEventListener('mouseup', evt => {
      if (evt instanceof CustomEvent) {
        this.htmlcanvas.mouseup(this.lastX, this.lastY);
      } else {
        evt.stopPropagation();
      }
    });
    this.resize();
  },
  resize() {
    this.width = this.htmlcanvas.width / this.data.ppu;
    this.height = this.htmlcanvas.height / this.data.ppu;
    this.screen.scale.x = this.width;
    this.screen.scale.y = this.height;
  },
  update() {
    this.resize();
  },
  forceRender() {
    this.htmlcanvas.forceRender();
  },
  tick: function() {
    this.resize();
    if (!this.raycaster) {
      return;
    }

    var intersection = this.raycaster.components.raycaster.getIntersection(this.el);
    if (!intersection) {
      return;
    }
    var localPoint = intersection.point;
    this.el.object3D.worldToLocal(localPoint);
    var w = this.width / 2;
    var h = this.height / 2;
    var x = Math.round((localPoint.x + w) / this.width * this.htmlcanvas.canvas.width);
    var y = Math.round((1 - (localPoint.y + h) / this.height) * this.htmlcanvas.canvas.height);
    if (this.lastX != x || this.lastY != y) {
      this.htmlcanvas.mousemove(x, y);
    }
    this.lastX = x;
    this.lastY = y;
  },
  remove: function() {
    this.el.removeObject3D('screen');
  }
});
