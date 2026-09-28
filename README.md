# Mimik

A real-time facial expression detection demo built with JavaScript and face-api.js. Runs entirely in the browser, keeping camera footage on your device.

## Features

- Start and stop your webcam with a single button.
- Detect one face and draw its bounding box.
- Show scores for seven facial expression classes.
- Stop the camera when you leave the tab.
- Process video locally without recording or uploading it.

Expression predictions are experimental and do not indicate how a person actually feels. Model scores are not accuracy measurements.

## Run locally

With Python 3 installed, run from the project folder:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000 and allow camera access. A deployed version must use HTTPS for camera access.

No build step or training dataset is required. Pretrained model files are included.

## Project structure

- `dist/index.html`: page structure and text
- `dist/style.css`: layout and styling
- `dist/app.js`: camera controls, inference and results
- `dist/models/`: pretrained face detection and expression model weights
- `dist/vendor/`: bundled face-api.js library and its license

## Technology and credits

Uses HTML, CSS, JavaScript and [face-api.js](https://github.com/justadudewhohacks/face-api.js) 0.22.2, built on TensorFlow.js. Face detection uses Tiny Face Detector; expression classification uses Face Expression Net.

The bundled face-api.js license is preserved in `dist/vendor/LICENSE.face-api.txt`. Pretrained weights originate from the face-api.js repository.
