(function() {
  // We need to set some default styles on form elements for consistency when rendering to canvas
  var inputStyles = document.createElement("style");
  inputStyles.innerHTML = "input, select,textarea{border: 1px solid #000000;margin: 0;background-color: #ffffff;-webkit-appearance: none;}:-webkit-autofill {color: #fff !important;}input[type='checkbox']{width: 20px;height: 20px;display: inline-block;}input[type='radio']{width: 20px;height: 20px;display: inline-block;border-radius: 50%;}input[type='checkbox'][checked],input[type='radio'][checked]{background-color: #555555;}a-entity[htmlembed] img{display:inline-block}a-entity[htmlembed]{display:none}";
  var head = document.querySelector("head");
  head.insertBefore(inputStyles, head.firstChild);
})();

class HTMLCanvas {
  constructor(html, updateCallback, eventCallback) {
    if (!html) throw "Container Element is Required";

    this.updateCallback = updateCallback;
    this.eventCallback = eventCallback;

    // Create the canvas to be drawn to
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");

    // Set some basic styles for the embed HTML
    this.html = html;
    this.html.style.display = 'block';
    this.width = 0;
    this.height = 0;
    this.html.style.display = 'none';
    this.html.style.position = 'absolute';
    this.html.style.top = '0';
    this.html.style.left = '0';
    this.html.style.overflow = 'hidden';


    // We have to stop propergation of the mouse at the root of the embed HTML otherwise it may effect other elements of the page
    this.mousemovehtml = (e) => {
      e.stopPropagation();
    }
    this.html.addEventListener('mousemove', this.mousemovehtml);

    // We need to change targethack when windows has location changes
    this.hashChangeEvent = () => {
      this.hashChanged();
    }
    window.addEventListener('hashchange', this.hashChangeEvent, false);


    this.overElements = []; // Element currently in the hover state

    this.focusElement = null; // The element that currently has focus

    // Image used to draw SVG to the canvas element
    this.img = new Image;
    // When image content has changed render it to the canvas
    this.img.addEventListener("load", () => {
      this.render();
    });

    // Add css hacks to current styles to ensure that the styles can be rendered to canvas
    this.csshack();

    // Timer used to limit the re-renders due to DOM updates
    var timer;

    // Setup the mutation observer
    var callback = (mutationsList, observer) => {
      // Don't update if we are manipulating DOM for render
      if (this.nowatch) return;

      for (var i = 0; i < mutationsList.length; i++) {
        // Skip the emebed html element if attributes change
        if (mutationsList[i].target == this.html && mutationsList[i].type == "attributes") continue;

        // If a class changes has no style change then there is no need to rerender
        if (!mutationsList[i].target.styleRef || mutationsList[i].attributeName == "class") {
          var styleRef = this.csssig(mutationsList[i].target);
          if (mutationsList[i].target.styleRef == styleRef) {
            continue;
          }
          mutationsList[i].target.styleRef = styleRef;
        }

        // Limit render rate so if we get multiple updates per frame we only do once.
        if (!timer) {
          timer = setTimeout(() => {
            this.svgToImg();
            timer = false;
          });
        }
      }
    };

    var config = {
      attributes: true,
      childList: true,
      subtree: true
    };
    var observer = new MutationObserver(callback);
    observer.observe(this.html, config);
    this.observer = observer;

    this.cssgenerated = []; // Remeber what css sheets have already been passed
    this.cssembed = []; // The text of the css to included in the SVG to render

    this.serializer = new XMLSerializer();

    // Trigger an initially hash change to set up targethack classes
    this.hashChanged();
  }

  // Forces a complete rerender
  forceRender() {
    // Clear any class hash as this may have changed
    Array.from(document.querySelectorAll('*')).map((ele) => ele.classCache = {});
    // Load the svg to the image
    this.svgToImg();
  }

  // Updates the targethack class when a Hash is changed
  hashChanged() {
    if (window.clearedHash != window.location.hash) {
      Array.from(document.querySelectorAll('*')).map((ele) => ele.classCache = {});
      var currentTarget = document.querySelector('.targethack');
      if (currentTarget) {
        currentTarget.classList.remove('targethack');
      }
      if (window.location.hash) {
        var newTarget = document.querySelector(window.location.hash);
        if (newTarget) {
          newTarget.classList.add('targethack');
        }
      }
    }
    window.clearedHash = window.location.hash;
    this.svgToImg();
  }

  // Cleans up all eventlistners, etc when they are no longer needed
  cleanUp() {
    // Stop observing for changes
    this.observer.disconnect();

    // Remove event listeners
    window.removeEventListener('hashchange', this.hashChangeEvent, );
    this.html.addEventListener('mousemove', this.mousrmovehtml);
  }

  // Add hack css rules to the page so they will update the css styles of the embed html
  csshack() {
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      try {
        var rules = sheets[i].cssRules;
        var toadd = [];
        for (var j = 0; j < rules.length; j++) {
          if (rules[j].cssText.indexOf(':hover') > -1) {
            toadd.push(rules[j].cssText.replace(new RegExp(":hover", "g"), ".hoverhack"))
          }
          if (rules[j].cssText.indexOf(':active') > -1) {
            toadd.push(rules[j].cssText.replace(new RegExp(":active", "g"), ".activehack"))
          }
          if (rules[j].cssText.indexOf(':focus') > -1) {
            toadd.push(rules[j].cssText.replace(new RegExp(":focus", "g"), ".focushack"))
          }
          if (rules[j].cssText.indexOf(':target') > -1) {
            toadd.push(rules[j].cssText.replace(new RegExp(":target", "g"), ".targethack"))
          }
          var idx = toadd.indexOf(rules[j].cssText);
          if (idx > -1) {
            toadd.splice(idx, 1);
          }
        }
        for (var j = 0; j < toadd.length; j++) {
          sheets[i].insertRule(toadd[j]);
        }
      } catch (e) {}
    }
  }

  // Simple hash function used for style signature
  dbj2(text) {
    var hash = 5381,
      c;
    for (var i = 0; i < text.length; i++) {
      c = text.charCodeAt(i);
      hash = ((hash << 5) + hash) + c;
    }
    return hash;
  }

  // Generate a singature for the current styles so we know if updated
  csssig(el) {
    if (!el.classCache) el.classCache = {};
    if (!el.classCache[el.className]) {
      var styles = getComputedStyle(el);
      var style = "";
      for (var i = 0; i < styles.length; i++) {
        style += styles[styles[i]];
      }
      el.classCache[el.className] = this.dbj2(style);
    }
    return el.classCache[el.className];
  }

  // Does what it says on the tin
  arrayBufferToBase64(bytes) {
    var binary = '';
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // Get an embeded version of the css for use in img svg
  // url - baseref of css so we know where to look up resourses
  // css - string content of the css
  embedCss(url, css) {
    return new Promise(resolve => {
      var found;
      var promises = [];

      // Add hacks to get selectors working on img
      css = css.replace(new RegExp(":hover", "g"), ".hoverhack");
      css = css.replace(new RegExp(":active", "g"), ".activehack");
      css = css.replace(new RegExp(":focus", "g"), ".focushack");
      css = css.replace(new RegExp(":target", "g"), ".targethack");

      // Replace all urls in the css
      const regEx = RegExp(/url\((?!['"]?(?:data):)['"]?([^'"\)]*)['"]?\)/gi);
      while (found = regEx.exec(css)) {
        promises.push(
          this.getDataURL(new URL(found[1], url)).then(((found) => {
            return url => {
              css = css.replace(found[1], url);
            };
          })(found))
        );
      }
      Promise.all(promises).then((values) => {
        resolve(css);
      });
    });
  }

  // Does what is says on the tin
  getURL(url) {
    url = (new URL(url, window.location)).href;
    return new Promise(resolve => {
      var xhr = new XMLHttpRequest();

      xhr.open('GET', url, true);

      xhr.responseType = 'arraybuffer';

      xhr.onload = () => {
        resolve(xhr);
      };

      xhr.send();

    })
  }

  // Generate the embed page CSS from all the page styles
  generatePageCSS() {
    // Fine all elements we are intrested in
    var elements = Array.from(document.querySelectorAll("style, link[type='text/css'],link[rel='stylesheet']"));
    var promises = [];
    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      if (this.cssgenerated.indexOf(element) == -1) {
        // Make sure all css hacks have been applied to the page
        this.csshack();
        // Get embed version of style elements
        var idx = this.cssgenerated.length;
        this.cssgenerated.push(element);
        if (element.tagName == "STYLE") {
          promises.push(
            this.embedCss(window.location, element.innerHTML).then(((element, idx) => {
              return css => {
                this.cssembed[idx] = css;
              }
            })(element, idx))
          );
        } else {
          // Get embeded version of externally link stylesheets
          promises.push(this.getURL(element.getAttribute("href")).then(((idx) => {
            return xhr => {
              var css = new TextDecoder("utf-8").decode(xhr.response);
              return this.embedCss(window.location, css).then(((element, idx) => {
                return css => {
                  this.cssembed[idx] = css;
                }
              })(element, idx))
            };
          })(idx))
          );
        }
      }
    }
    return Promise.all(promises);
  }

  // Generate and returns a dataurl for the given url
  getDataURL(url) {
    return new Promise(resolve => {
      this.getURL(url).then(xhr => {
        var arr = new Uint8Array(xhr.response);
        var contentType = xhr.getResponseHeader("Content-Type").split(";")[0];
        if (contentType == "text/css") {
          var css = new TextDecoder("utf-8").decode(arr);
          this.embedCss(url, css).then((css) => {
            var base64 = window.btoa(css);
            if (base64.length > 0) {
              var dataURL = 'data:' + contentType + ';base64,' + base64;
              resolve(dataURL);
            } else {
              resolve('');
            }
          });
        } else {
          var b64 = this.arrayBufferToBase64(arr);
          var dataURL = 'data:' + contentType + ';base64,' + b64;
          resolve(dataURL);
        }
      });
    });
  }

  // Embeds and externally linked elements for rendering to img
  embededSVG() {
    var promises = [];
    var elements = this.html.querySelectorAll("*");
    for (var i = 0; i < elements.length; i++) {

      // convert and xlink:href to standard href
      var link = elements[i].getAttributeNS("http://www.w3.org/1999/xlink", "href");
      if (link) {
        promises.push(this.getDataURL(link).then(((element) => {
          return dataURL => {
            element.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
            element.setAttribute("href", dataURL);
          };
        })(elements[i])));
      }

      // Convert and images to data url
      if (elements[i].tagName == "IMG" && elements[i].src.substr(0, 4) != "data") {
        promises.push(this.getDataURL(elements[i].src).then(((element) => {
          return dataURL => {
            element.setAttribute("src", dataURL);
          };
        })(elements[i])));
      }

      // If there is a style attribute make sure external references are converted to dataurl
      if (elements[i].namespaceURI == "http://www.w3.org/1999/xhtml" && elements[i].hasAttribute("style")) {
        var style = elements[i].getAttribute("style");
        promises.push(
          this.embedCss(window.location, style).then(((style, element) => {
            return (css) => {
              if (style != css) element.setAttribute("style", css);
            }
          })(style, elements[i]))
        );
      }
    }
    // If there are any inline style within the embeded html make sure they have the selector hacks
    var styles = this.html.querySelectorAll("style");
    for (var i = 0; i < styles.length; i++) {
      promises.push(
        this.embedCss(window.location, styles[i].innerHTML).then(((style) => {
          return (css) => {
            if (style.innerHTML != css) style.innerHTML = css;
          }
        })(styles[i]))
      );
    }
    return Promise.all(promises)
  }

  // Override elements focus and blur functions as these do not perform as expected when embeded html is not being directly displayed
  updateFocusBlur() {
    var allElements = this.html.querySelectorAll("*");
    for (var i = 0; i < allElements.length; i++) {
      var element = allElements[i];
      if (element.tabIndex > -1) {
        if (!element.hasOwnProperty('focus')) {
          element.focus = ((element) => {
            return () => this.setFocus(element);
          })(element)
        }
        if (!element.hasOwnProperty('blur')) {
          element.blur = ((element) => {
            return () => this.focusElement == element ? this.setBlur() : false;
          })(element)
        }
      } else {
        delete(element.focus);
        delete(element.blur);
      }
    }
  }

  // Get all parents of the embeded html as these can effect the resulting styles
  getParents() {
    var opens = [];
    var closes = [];
    var parent = this.html.parentNode;
    do {
      var tag = parent.tagName.toLowerCase();
      if (tag.substr(0, 2) == 'a-') tag = 'div'; // We need to replace A-Frame tags with div as they're not valid xhtml so mess up the rendering of images
      var open = '<' + (tag == 'body' ? 'body xmlns="http://www.w3.org/1999/xhtml"' : tag) + ' style="transform: none;left: 0;top: 0;position:static;display: block" class="' + parent.className + '"' + (parent.id ? ' id="' + parent.id + '"' : '') + '>';
      opens.unshift(open);
      var close = '</' + tag + '>';
      closes.push(close);
      if (tag == 'body') break;
    } while (parent = parent.parentNode)
    return [opens.join(''), closes.join('')];
  }

  // If an element is checked make sure it has a checked attribute so it renders to the canvas
  updateCheckedAttributes() {
    var inputElements = this.html.getElementsByTagName("input");
    for (var i = 0; i < inputElements.length; i++) {
      var element = inputElements[i];
      if (element.hasAttribute("checked")) {
        if (!element.checked) element.removeAttribute("checked");
      } else {
        if (element.checked) element.setAttribute("checked", "");
      }
    }
  }

  // Set the src to be rendered to the Image
  svgToImg() {
    this.updateFocusBlur();
    Promise.all([this.embededSVG(), this.generatePageCSS()]).then(() => {
      // Make sure the element is visible before processing
      this.html.style.display = 'block';
      // If embeded html elements dimensions have change then update the canvas
      if (this.width != this.html.offsetWidth || this.height != this.html.offsetHeight) {
        this.width = this.html.offsetWidth;
        this.height = this.html.offsetHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        if (this.eventCallback) this.eventCallback('resized'); // Notify a resize has happened
      }
      var docString = this.serializer.serializeToString(this.html);
      var parent = this.getParents();
      docString = '<svg width="' + this.width + '" height="' + this.height + '" xmlns="http://www.w3.org/2000/svg"><defs><style type="text/css"><![CDATA[a[href]{color:#0000EE;text-decoration:underline;}' + this.cssembed.join('') + ']]></style></defs><foreignObject x="0" y="0" width="' + this.width + '" height="' + this.height + '">' + parent[0] + docString + parent[1] + '</foreignObject></svg>';
      this.img.src = "data:image/svg+xml;utf8," + encodeURIComponent(docString);
      // Hide the html after processing
      this.html.style.display = 'none';
    });
  }

  // Renders the image containing the SVG to the Canvas
  render() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.img, 0, 0);
    if (this.updateCallback) this.updateCallback();
    if (this.eventCallback) this.eventCallback('rendered');
  }

  // Transforms a point into an elements frame of reference
  transformPoint(elementStyles, x, y, offsetX, offsetY) {
    // Get the elements tranform matrix
    var transformcss = elementStyles["transform"];
    if (transformcss.indexOf("matrix(") == 0) {
      var transform = new THREE.Matrix4();
      var mat = transformcss.substring(7, transformcss.length - 1).split(", ").map(parseFloat);
      transform.elements[0] = mat[0];
      transform.elements[1] = mat[1];
      transform.elements[4] = mat[2];
      transform.elements[5] = mat[3];
      transform.elements[12] = mat[4];
      transform.elements[13] = mat[5];
    } else if (transformcss.indexOf("matrix3d(") == 0) {
      var transform = new THREE.Matrix4();
      var mat = transformcss.substring(9, transformcss.length - 1).split(", ").map(parseFloat);
      transform.elements = mat;
    } else {
      return [x, y, z]
    }
    // Get the elements tranform origin
    var origincss = elementStyles["transform-origin"];
    origincss = origincss.replace(new RegExp("px", "g"), "").split(" ").map(parseFloat);

    // Apply the transform to the origin
    var ox = offsetX + origincss[0];
    var oy = offsetY + origincss[1];
    var oz = 0;
    if (origincss[2]) oz += origincss[2];

    var T1 = new THREE.Matrix4().makeTranslation(-ox, -oy, -oz);
    var T2 = new THREE.Matrix4().makeTranslation(ox, oy, oz);

    transform = T2.multiply(transform).multiply(T1)

    // Inverse the transform so we can go from page space to element space
    var inverse = new THREE.Matrix4().getInverse(transform);

    // Calculate a ray in the direction of the plane
    var v1 = new THREE.Vector3(x, y, 0);
    var v2 = new THREE.Vector3(x, y, -1);
    v1.applyMatrix4(inverse);
    v2.applyMatrix4(inverse);
    var dir = v2.sub(v1).normalize();

    // If ray is parallel to the plane then there is no intersection
    if (dir.z == 0) {
      return false;
    }

    // Get the point of intersection on the element plane
    var result = dir.multiplyScalar(-v1.z / dir.z).add(v1);

    return [result.x, result.y];
  }

  // Get the absolute border radii for each corner
  getBorderRadii(element, style) {
    var properties = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'];
    var result;
    // Parse the css results
    var corners = [];
    for (var i = 0; i < properties.length; i++) {
      var borderRadiusString = style[properties[i]];
      var reExp = /(\d*)([a-z%]{1,3})/gi;
      var rec = [];
      while (result = reExp.exec(borderRadiusString)) {
        rec.push({
          value: result[1],
          unit: result[2]
        });
      }
      if (rec.length == 1) rec.push(rec[0]);
      corners.push(rec);
    }

    // Convertion values
    const unitConv = {
      'px': 1,
      '%': element.offsetWidth / 100
    };

    // Convert all corners into pixels
    var pixelCorners = [];
    for (var i = 0; i < corners.length; i++) {
      var corner = corners[i];
      var rec = []
      for (var j = 0; j < corner.length; j++) {
        rec.push(corner[j].value * unitConv[corner[j].unit]);
      }
      pixelCorners.push(rec);
    }

    // Initial corner point scales
    var c1scale = 1;
    var c2scale = 1;
    var c3scale = 1;
    var c4scale = 1;

    // Change scales of top left and top right corners based on offsetWidth
    var borderTop = pixelCorners[0][0] + pixelCorners[1][0];
    if (borderTop > element.offsetWidth) {
      var f = 1 / borderTop * element.offsetWidth;
      c1scale = Math.min(c1scale, f);
      c2scale = Math.min(c2scale, f);
    }

    // Change scales of bottom right and top right corners based on offsetHeight
    var borderLeft = pixelCorners[1][1] + pixelCorners[2][1];
    if (borderLeft > element.offsetHeight) {
      f = 1 / borderLeft * element.offsetHeight;
      c3scale = Math.min(c3scale, f);
      c2scale = Math.min(c2scale, f);
    }

    // Change scales of bottom left and bottom right corners based on offsetWidth
    var borderBottom = pixelCorners[2][0] + pixelCorners[3][0];
    if (borderBottom > element.offsetWidth) {
      f = 1 / borderBottom * element.offsetWidth;
      c3scale = Math.min(c3scale, f);
      c4scale = Math.min(c4scale, f);
    }

    // Change scales of bottom left and top right corners based on offsetHeight
    var borderRight = pixelCorners[0][1] + pixelCorners[3][1];
    if (borderRight > element.offsetHeight) {
      f = 1 / borderRight * element.offsetHeight;
      c1scale = Math.min(c1scale, f);
      c4scale = Math.min(c4scale, f);
    }

    // Scale the corners to fix within the confines of the element
    pixelCorners[0][0] = pixelCorners[0][0] * c1scale;
    pixelCorners[0][1] = pixelCorners[0][1] * c1scale;
    pixelCorners[1][0] = pixelCorners[1][0] * c2scale;
    pixelCorners[1][1] = pixelCorners[1][1] * c2scale;
    pixelCorners[2][0] = pixelCorners[2][0] * c3scale;
    pixelCorners[2][1] = pixelCorners[2][1] * c3scale;
    pixelCorners[3][0] = pixelCorners[3][0] * c4scale;
    pixelCorners[3][1] = pixelCorners[3][1] * c4scale;

    return pixelCorners;
  }

  // Check that the element is with the confines of rounded corners
  checkInBorder(element, style, x, y, left, top) {
    if (style['border-radius'] == "0px") return true;
    var width = element.offsetWidth;
    var height = element.offsetHeight;
    var corners = this.getBorderRadii(element, style);

    // Check top left corner
    if (x < corners[0][0] + left && y < corners[0][1] + top) {
      var x1 = (corners[0][0] + left - x) / corners[0][0];
      var y1 = (corners[0][1] + top - y) / corners[0][1];
      if (x1 * x1 + y1 * y1 > 1) {
        return false;
      }
    }
    // Check top right corner
    if (x > left + width - corners[1][0] && y < corners[1][1] + top) {
      var x1 = (x - (left + width - corners[1][0])) / corners[1][0];
      var y1 = (corners[1][1] + top - y) / corners[1][1];
      if (x1 * x1 + y1 * y1 > 1) {
        return false;
      }
    }
    // Check bottom right corner
    if (x > left + width - corners[2][0] && y > top + height - corners[2][1]) {
      var x1 = (x - (left + width - corners[2][0])) / corners[2][0];
      var y1 = (y - (top + height - corners[2][1])) / corners[2][1];
      if (x1 * x1 + y1 * y1 > 1) {
        return false;
      }
    }
    // Check bottom left corner
    if (x < corners[3][0] + left && y > top + height - corners[3][1]) {
      var x1 = (corners[3][0] + left - x) / corners[3][0];
      var y1 = (y - (top + height - corners[3][1])) / corners[3][1];
      if (x1 * x1 + y1 * y1 > 1) {
        return false;
      }
    }
    return true;
  }

  // Check if element it under the current position
  // x,y - the position to check
  // offsetx, offsety - the current left and top offsets
  // offsetz - the current z offset on the current z-index
  // level - the current z-index
  // element - element being tested
  // result - the final result of the hover target
  checkElement(x, y, offsetx, offsety, offsetz, level, element, result) {
    // Return if this element isn't visible
    if (!element.offsetParent) return;

    var style = window.getComputedStyle(element);

    // Calculate absolute position and dimensions
    var left = element.offsetLeft + offsetx;
    var top = element.offsetTop + offsety;
    var width = element.offsetWidth;
    var height = element.offsetHeight;

    var zIndex = style['z-index'];
    if (zIndex != 'auto') {
      offsetz = 0;
      level = parseInt(zIndex);
    }

    // If the element isn't static the increment the offsetz
    if (style['position'] != 'static' && element != this.html) {
      if (zIndex == 'auto') offsetz += 1;
    }
    // If there is a transform then transform point
    if ((style['display'] == "block" || style['display'] == "inline-block") && style['transform'] != 'none') {
      // Apply css transforms to click point
      var newcoord = this.transformPoint(style, x, y, left, top);
      if (!newcoord) return;
      x = newcoord[0];
      y = newcoord[1];
      if (zIndex == 'auto') offsetz += 1;
    }
    // Check if in confines of bounding box
    if (x > left && x < left + width && y > top && y < top + height) {
      // Check if in confines of rounded corders
      if (this.checkInBorder(element, style, x, y, left, top)) {
        //check if above other elements
        if ((offsetz >= result.zIndex || level > result.level) && level >= result.level && style['pointer-events'] != "none") {
          result.zIndex = offsetz;
          result.ele = element;
          result.level = level;
        }
      }
    } else if (style['overflow'] != 'visible') {
      // If the element has no overflow and the point is outsize then skip it's children
      return;
    }
    // Check each of the child elements for intersection of the point
    var child = element.firstChild;
    if (child)
      do {
        if (child.nodeType == 1) {
          if (child.offsetParent == element) {
            this.checkElement(x, y, offsetx + left, offsety + top, offsetz, level, child, result);
          } else {
            this.checkElement(x, y, offsetx, offsety, offsetz, level, child, result);
          }
        }
      } while (child = child.nextSibling);
  }

  // Gets the element under the given x,y coordinates
  elementAt(x, y) {
    this.html.style.display = 'block';
    var result = {
      zIndex: 0,
      ele: null,
      level: 0
    };
    this.checkElement(x, y, 0, 0, 0, 0, this.html, result);
    this.html.style.display = 'none';
    return result.ele;
  }

  // Process a movment of the mouse
  moveMouse() {
    var x = this.moveX;
    var y = this.moveY;
    var button = this.moveButton;
    var mouseState = {
      screenX: x,
      screenY: y,
      clientX: x,
      clientY: y,
      button: button ? button : 0,
      bubbles: true,
      cancelable: true
    };
    var mouseStateHover = {
      clientX: x,
      clientY: y,
      button: button ? button : 0,
      bubbles: false
    };

    var ele = this.elementAt(x, y);
    // If the element under cusor isn't the same as lasttime then update hoverstates and fire off events
    if (ele != this.lastEle) {
      if (ele) {
        // If the element has a tabIndex then notify of a focusable enter
        if (ele.tabIndex > -1) {
          if (this.eventCallback) this.eventCallback('focusableenter', {
            target: ele
          });
        }
        // If the element has a tabIndex then notify of a focusable leave
        if (this.lastEle && this.lastEle.tabIndex > -1) {
          if (this.eventCallback) this.eventCallback('focusableleave', {
            target: this.lastEle
          });
        }
        var parents = [];
        var current = ele;
        if (this.lastEle) this.lastEle.dispatchEvent(new MouseEvent('mouseout', mouseState));
        ele.dispatchEvent(new MouseEvent('mouseover', mouseState));
        // Update overElements and fire corresponding events
        do {
          if (current == this.html) break;
          if (this.overElements.indexOf(current) == -1) {
            if (current.classList) current.classList.add("hoverhack");
            current.dispatchEvent(new MouseEvent('mouseenter', mouseStateHover));
            this.overElements.push(current);
          }
          parents.push(current);
        } while (current = current.parentNode);

        for (var i = 0; i < this.overElements.length; i++) {
          var element = this.overElements[i];
          if (parents.indexOf(element) == -1) {
            if (element.classList) element.classList.remove("hoverhack");
            element.dispatchEvent(new MouseEvent('mouseleave', mouseStateHover));
            this.overElements.splice(i, 1);
            i--;
          }
        }
      } else {
        while (element = this.overElements.pop()) {
          if (element.classList) element.classList.remove("hoverhack");
          element.dispatchEvent(new MouseEvent('mouseout', mouseState));
        }
      }
    }
    if (ele && this.overElements.indexOf(ele) == -1) this.overElements.push(ele);
    this.lastEle = ele;
    if (ele) ele.dispatchEvent(new MouseEvent('mousemove', mouseState));
    this.moveTimer = false;
  }

  // Move the mouse on the html element
  mousemove(x, y, button) {
    this.moveX = x;
    this.moveY = y;
    this.moveButton = button;
    // Limit frames rate of mouse move for performance
    if (this.moveTimer) return;
    this.moveTimer = setTimeout(this.moveMouse.bind(this), 20);
  }

  // Mouse down on the HTML Element
  mousedown(x, y, button) {
    var mouseState = {
      screenX: x,
      screenY: y,
      clientX: x,
      clientY: y,
      button: button ? button : 0,
      bubbles: true,
      cancelable: true
    };
    var ele = this.elementAt(x, y);
    if (ele) {
      this.activeElement = ele;
      ele.classList.add("activehack");
      ele.classList.remove("hoverhack");
      ele.dispatchEvent(new MouseEvent('mousedown', mouseState));
    }
    this.mousedownElement = ele;
  }

  // Sets the element that currently has focus
  setFocus(ele) {
    ele.dispatchEvent(new FocusEvent('focus'));
    ele.dispatchEvent(new CustomEvent('focusin', {
      bubbles: true,
      cancelable: false
    }));
    ele.classList.add('focushack');
    this.focusElement = ele;
  }

  // Blurs the element that currently has focus
  setBlur() {
    if (this.focusElement) {
      this.focusElement.classList.remove("focushack");
      this.focusElement.dispatchEvent(new FocusEvent('blur'));
      this.focusElement.dispatchEvent(new CustomEvent('focusout', {
        bubbles: true,
        cancelable: false
      }));
    }
  }

  // Clear all hover states
  clearHover() {
    if (this.moveTimer) {
      clearTimeout(this.moveTimer);
      this.moveTimer = false;
    }
    var element;
    while (element = this.overElements.pop()) {
      if (element.classList) element.classList.remove("hoverhack");
      element.dispatchEvent(new MouseEvent('mouseout', {
        bubbles: true,
        cancelable: true
      }));
    }
    if (this.lastEle) this.lastEle.dispatchEvent(new MouseEvent('mouseleave', {
      bubbles: true,
      cancelable: true
    }));
    this.lastEle = null;
    var activeElement = document.querySelector(".activeElement");
    if (activeElement) {
      activeElement.classList.remove("activehack");
      this.activeElement = null;
    }
  }

  // Mouse up on the HTML Element
  mouseup(x, y, button) {
    var mouseState = {
      screenX: x,
      screenY: y,
      clientX: x,
      clientY: y,
      button: button ? button : 0,
      bubbles: true,
      cancelable: true
    };
    var ele = this.elementAt(x, y);
    if (this.activeElement) {
      this.activeElement.classList.remove("activehack");
      if(ele){
        ele.classList.add("hoverhack");
        if(this.overElements.indexOf(ele)==-1) this.overElements.push(ele);
      }
      this.activeElement = null;
    }
    if (ele) {
      ele.dispatchEvent(new MouseEvent('mouseup', mouseState));
      if (ele != this.focusElement) {
        this.setBlur();
        if (ele.tabIndex > -1) {
          this.setFocus(ele);
        } else {
          this.focusElement = null;
        }
      }

      if (ele == this.mousedownElement) {
        ele.dispatchEvent(new MouseEvent('click', mouseState));
        if (ele.tagName == "INPUT") this.updateCheckedAttributes();
        // If the element requires some sort of keyboard interaction then notify of an input requirment
        if (ele.tagName == "INPUT" || ele.tagName == "TEXTAREA" || ele.tagName == "SELECT") {
          if (this.eventCallback) this.eventCallback('inputrequired', {
            target: ele
          });
        }
      }
    } else {
      if (this.focusElement) this.focusElement.dispatchEvent(new FocusEvent('blur'));
      this.focusElement = null;
    }
  }
}

module.exports = HTMLCanvas;
