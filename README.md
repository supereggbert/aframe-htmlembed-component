
# HTML Embed Component

HTML Embed is a component created for [A-Frame](https://aframe.io/). The HTML Embed component allows for arbitrary html to be inserted into your aframe scene. It allows you to update the display within A-Frame simply by manipulating the DOM as you normally would. 

In addition to rendering the html to the A-Frame scene it allows for interaction. Most css pseudo selectors such as hover, active, focus and target should work with interactivity enabled without any modifications to your css. Mouse events can be attached to the html elements as usual.

## Limitations

* All styles and images must be in the same origin or allow access via CORS; this allows the component to embed all of the assets required to render the html properly to the canvas via the foreignObject element. 
* transform-style css is limited to flat. This is mainly due to it not being rendered properly to canvas so element bounding for preserve-3d has not yet been implemented. If the rendering is fixed as some point I may go back and get it working as well.
* "a-" tags do not render correctly as XHTML embeded into SVG, so any parent "a-" elements of the embed html will be converted to div tags for rendering. This may mean your css will require modification.
* Elements that require rendering outside of the DOM such as the iframe and canvas element will not work.
* :before and :after pseudo elements can't be accessed via the DOM so they can't be used in the element to determine the object bounds. As such, use them with caution. 
* Form elements are not consistently rendered to the canvas element so some basic default styles are included for consistency. 
* Currently there is no support for css transitions.


## Properties
| Property | Default | Description |
|----------|---------|-------------|
| ppu | 256 | number of pixels to display per unit of the aframescene. |

## Methods

| Method | Description |
|--------|-------------|
| forceRender | Forces the htmlembed component to be re-redner |


## Events

| Name | Event Type | Description |
|------|-------|-------------|
|focusableenter | [FocusableEvent](#focusablervent) |  Dispatched when the cursor is moved over a focusable element. Useful for providing visual/haptic feedback to the user letting them know that the element is clickable. |
| focusableleave | [FocusableEvent](#focusablervent) |  Dispatched when the cursor is moved out of a focusable element. |
| inputrequired | [InputrequiredEvent](#inputrequiredevent) |  Dispatched when an element that requires keyboard input or a user selection is clicked. Can be used to bring up a custom keyboard. |
| resized | N/A |  Dispatched when the embed html content size is changed. |
| rendered | N/A |  Dispatched when the embedded HTML content is rendered to the A-Frame Scene. |
<a name="focusablevent"></a>
### FocusableEvent

| Property | Description |
|----------|-------------|
| target   | The target element that the cursor is over. |
<a name="inputrequiredevent"></a>
### InputrequiredEvent

| Property | Description |
|----------|-------------|
| target   | The input element that the user selected. ||


## How to Use

To use the component you just add the component to the A-Frame entity containing the html.  For example:
```html
<a-scene>
  <a-entity htmlembed position="0 0 -5">
    <h1>An Example</h1>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
    <img src="myImages.png" alt="image">
  </a-entity>
</a-scene>
```

## Interactivity

### Using CSS

HTML Embed allows you to add interactivity by adding standard css interactions such as hover:
```css
.button{
	display: inline-block;
	border-radius: 5px;
	background-color: #dddddd;
	color: #000000;
}
.button:hover{
	background-color: #000000;
	color: #ffffff;
}
```
```html
<a-scene>
	<a-entity htmlembed>
		<a href="#home" class="button">Home</a>
	</a-entity>
</a-scene>
```
### Using Javascript

You can add javascript interactivity in the standard way either by events on the elements themselves or alternatively by adding event listeners to the DOM.

```html
<a-scene>
	<a-entity htmlembed>
		<div id="clickme" onclick="console.log('do something')">Click Me</div>
	</a-entity>
</a-scene>
```
```javascript
document.querySelector('#clickme').addEventListener('click',function(e){
	console.log('do something else');
});
```

## Interactions

Interactions are achived though the normal cursor and laser-controls components and allow you to interacte with the html as if you where using a mouse. If an element is clicked that requires keyboard input the inputrequired event is dispatched so a keyboard overlay can be invoked.

## Installation

### Browser

Install and use by directly including the  browser files:
```html
<head>
  <title>My A-Frame Scene</title>
  <script src="https://aframe.io/releases/0.9.2/aframe.min.js"></script>
  <script src="http://supereggbert.github.io/aframe-htmlembed-component/dist/build.js"></script>
</head>

<body>
  <a-scene>
    <a-entity htmlembed>
		<p>My HTML</p>
	</a-entity>
  </a-scene>
</body>
	
```

### npm

Install via npm:

*npm install aframe-htmlembed-component*

Then register and use.
```js
require('aframe');
require('aframe-htmlembed-component');
```

## Building

-   Install  [Node.js](https://nodejs.org/).
    
-   Clone the project to your file system:
    
```
git clone https://github.com/supereggbert/aframe-htmlembed-component.git
```
*   enter the aframe-htmlembed-component directory.

```cd ./aframe-htmlembed-component```

*   Install build dependencies

```npm install```

*   Run the build script.

```npm run build```

The compiled file is at  `aframe-htmlembed-component/dist/build.js`

