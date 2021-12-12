
# Notations

Notations is a Typescript library for rendering Carnatic music.  Notations comes with:

1. An API for representing and rendering carnatic music.
2. A DSL and an accompanying parser for representing music in a simpler and intuitive way.

# Getting Started

## Installation

```
# Install Typescript
npm i typescript

# Install the library (in a folder that already contains your package.json file).
npm install --save notations

```

## Example

```
import { NotationView } from notations;

const element = document.getElementById("mydiv");
const notationView = new NotationView(element);
notationView.add(new Note("Ga"), new Space(),
                 new Note("Ga"), new Space(),
                 new Note("Ri"), new Space(),
                 new Note("Ri"), new Space(),
                 new Note("Sa"), new Note("Sa"), 
                 new Note("Ri"), new Note("Ri"), 
                 new Note("Ga"), new Note("Ga"), 
                 new Note("Ri"), new Note("Ri"));
```

